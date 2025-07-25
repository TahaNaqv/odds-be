import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Raffle, RaffleStatus } from '../entities/raffle.entity';
import { Ticket, TicketGroup } from '../entities/ticket.entity';
import { User } from '../entities/user.entity';
import { PurchaseTicketDto } from './dto/purchase-ticket.dto';
import { AutoEnrollDto } from './dto/auto-enroll.dto';
import { ReferralService } from '../referral/referral.service';
import { ReferralCode } from '../entities/referral-code.entity';
import { ContractService } from '../contract/contract.service';
import { ContractTransactionDto } from './dto/contract-transaction.dto';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

// Define the UserActivity interface to match frontend expectations
interface UserActivity {
  id: string;
  type: 'purchase' | 'win';
  raffleId: string;
  timestamp: string;
  ticketCount?: number;
  totalSpent?: number;
  token?: 'USDC' | 'USDT' | 'mUSDC';
  prize?: number;
  winningTicket?: number;
  tickets: Ticket[];
  referralCode?: string;
  isAutoEnrolled?: boolean;
  autoEnrollId?: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED';
}

@Injectable()
export class RaffleService {
  private readonly logger = new Logger(RaffleService.name);

  constructor(
    @InjectRepository(Raffle)
    private raffleRepository: Repository<Raffle>,
    @InjectRepository(Ticket)
    private ticketRepository: Repository<Ticket>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ReferralCode)
    private referralCodeRepository: Repository<ReferralCode>,
    private referralService: ReferralService,
    private contractService: ContractService,
    private configService: ConfigService,
  ) {}

  async getCurrentRaffle() {
    const currentRaffle = await this.raffleRepository.findOne({
      where: { status: RaffleStatus.ACTIVE },
      relations: ['tickets'],
      order: { id: 'ASC' }, // Order by ID ascending to get the minimum ID
    });

    if (!currentRaffle) {
      throw new NotFoundException('No active raffle found');
    }

    return currentRaffle;
  }

  async getPastRaffles(page: number = 1, limit: number = 10) {
    const [raffles, total] = await this.raffleRepository.findAndCount({
      where: { status: RaffleStatus.COMPLETED },
      relations: ['tickets', 'tickets.owner'],
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      raffles,
      total,
      page,
      limit,
    };
  }

  async getRaffleById(id: string) {
    const raffle = await this.raffleRepository.findOne({
      where: { id: parseInt(id) },
      relations: ['tickets'],
    });

    if (!raffle) {
      throw new NotFoundException(`Raffle with ID ${id} not found`);
    }

    return raffle;
  }

  async purchaseTicket(
    userId: number,
    raffleId: number,
    ticketCount: number,
    autoEntry: number,
    referralCode: string,
    walletAddress: string,
  ): Promise<{
    tickets: Ticket[];
    userReferralCode?: string;
    contractTx: {
      approveTx: ContractTransactionDto;
      buyTx: ContractTransactionDto;
    };
    raffleIds: number[];
    ticketCount: number;
  }> {
    // 📊 Performance monitoring
    const startTime = Date.now();
    const totalTicketsToCreate = ticketCount * autoEntry;
    this.logger.log(
      `🎫 Starting ticket purchase: ${totalTicketsToCreate} tickets (${ticketCount} × ${autoEntry} raffles) for user ${userId}`,
    );
    // 🚀 Use database transaction for atomicity and performance
    return await this.raffleRepository.manager.transaction(async (manager) => {
      // 🚀 Parallel queries instead of sequential - MAJOR PERFORMANCE BOOST
      const [referralCodeEntity, currentRaffle, user] = await Promise.all([
        manager.findOne(ReferralCode, {
          where: { code: referralCode.toLowerCase() },
          relations: ['owner'],
        }),
        manager.findOne(Raffle, {
          where: { id: raffleId },
        }),
        manager.findOne(User, {
          where: { id: userId },
          relations: ['referralCode'],
        }),
      ]);

      // Validation
      if (!referralCodeEntity) {
        throw new BadRequestException('Invalid referral code');
      }
      if (referralCodeEntity.owner && referralCodeEntity.owner.id === userId) {
        throw new BadRequestException('You cannot use your own referral code');
      }
      if (!currentRaffle) {
        throw new NotFoundException('Raffle not found');
      }
      if (currentRaffle.status !== RaffleStatus.ACTIVE) {
        throw new BadRequestException('Raffle is not active');
      }

      // 🚀 Get future raffles with take limit - avoid slice after query
      const futureRaffles = await manager.find(Raffle, {
        where: {
          status: RaffleStatus.ACTIVE,
          id: MoreThan(currentRaffle.id),
        },
        order: { id: 'ASC' },
        take: Math.max(0, autoEntry - 1), // Database-level limit
      });

      const allRaffles = [currentRaffle, ...futureRaffles];

      if (allRaffles.length < autoEntry) {
        throw new BadRequestException(
          `Not enough future raffles available for ${autoEntry} auto-entries`,
        );
      }

      // 🚀 Prepare all tickets for BULK insert instead of individual saves
      const ticketsToCreate: Partial<Ticket>[] = [];
      const raffleUpdates: Array<{ id: number; totalTickets: number }> = [];
      const raffleIds: number[] = [];
      let totalTicketsCreated = 0;

      for (const raffle of allRaffles) {
        const remainingTickets = raffle.maxTickets - raffle.totalTickets;
        if (remainingTickets < ticketCount) {
          throw new BadRequestException(
            `Only ${remainingTickets} tickets available for raffle ${raffle.id}`,
          );
        }

        // 🚀 Prepare tickets for bulk insert - NO INDIVIDUAL SAVES
        for (let i = 0; i < ticketCount; i++) {
          ticketsToCreate.push({
            ticketNumber: raffle.totalTickets + i + 1,
            owner: { id: userId } as User,
            raffle: { id: raffle.id } as Raffle,
            referralCode: referralCodeEntity,
          });
        }

        raffleIds.push(raffle.id);
        raffleUpdates.push({
          id: raffle.id,
          totalTickets: raffle.totalTickets + ticketCount,
        });
        totalTicketsCreated += ticketCount;
      }

      // 🚀 Execute ALL operations in parallel - MASSIVE PERFORMANCE GAIN
      const [createdTickets, contractTx] = await Promise.all([
        // Bulk insert ALL tickets at once
        manager.save(Ticket, ticketsToCreate),

        // Create contract transaction in parallel
        this.contractService.createUnsignedBuyTicketsTx(
          walletAddress,
          raffleIds,
          ticketCount,
        ),

        // Batch update all raffles in parallel
        Promise.all(
          raffleUpdates.map((update) =>
            manager.update(Raffle, update.id, {
              totalTickets: update.totalTickets,
            }),
          ),
        ),

        // Update referral code usage (single update)
        manager.update(ReferralCode, referralCodeEntity.id, {
          totalUses: referralCodeEntity.totalUses + totalTicketsCreated,
        }),

        // Update user's total tickets purchased (single update)
        manager.update(User, userId, {
          totalTicketsPurchased: () =>
            `totalTicketsPurchased + ${totalTicketsCreated}`,
        }),
      ]);

      // 🚀 Handle referral code generation if needed
      let userReferralCode: string | undefined = user?.referralCode?.code;
      if (user && !user.referralCode) {
        const newReferralCode =
          await this.referralService.generateUserReferralCode(user);
        userReferralCode = newReferralCode.code;
      }

      // 📊 Performance logging
      const endTime = Date.now();
      const duration = endTime - startTime;
      this.logger.log(
        `✅ Ticket purchase completed: ${totalTicketsToCreate} tickets created in ${duration}ms (${((totalTicketsToCreate / duration) * 1000).toFixed(0)} tickets/sec)`,
      );

      return {
        tickets: createdTickets,
        userReferralCode,
        contractTx,
        raffleIds,
        ticketCount,
      };
    });
  }

  async getUserActivity(walletAddress: string): Promise<UserActivity[]> {
    this.logger.log(
      `[DIAGNOSTIC] Starting getUserActivity for ${walletAddress}`,
    );

    // Get user by wallet address
    const user = await this.userRepository.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      this.logger.warn(
        `[DIAGNOSTIC] User not found for wallet: ${walletAddress}`,
      );
      return [];
    }
    this.logger.log(`[DIAGNOSTIC] Found user ID: ${user.id}`);

    // Use QueryBuilder to fetch only the necessary raw data for the specific user
    const rawTickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoin('ticket.raffle', 'raffle')
      .leftJoin('ticket.referralCode', 'referralCode')
      .select([
        'ticket.id as id',
        'ticket.ownerId as ownerid', // Explicitly select ownerId for validation
        'ticket.ticketNumber as ticketnumber',
        'ticket.groupNumber as groupnumber',
        'ticket.prizeAmount as prizeamount',
        'ticket.isDistributed as isdistributed',
        'ticket.transactionHash as transactionhash',
        'ticket.createdAt as createdat',
        'ticket.updatedAt as updatedat',
        'raffle.id as raffleid',
        'referralCode.code as referralcode',
      ])
      .where('ticket.ownerId = :userId', { userId: user.id })
      .orderBy('ticket.createdAt', 'DESC')
      .getRawMany();

    this.logger.log(
      `[DIAGNOSTIC] Query returned ${rawTickets.length} tickets.`,
    );

    // ================== [DIAGNOSTIC CHECK] ==================
    let MismatchFound = false;
    for (const ticket of rawTickets) {
      if (ticket.ownerid !== user.id) {
        this.logger.error(
          `[CRITICAL ERROR] Mismatch found! Query for user ${user.id} returned a ticket for user ${ticket.ownerid}. Ticket ID: ${ticket.id}`,
        );
        MismatchFound = true;
      }
    }
    if (!MismatchFound) {
      this.logger.log(
        `[DIAGNOSTIC] SUCCESS: All ${rawTickets.length} tickets belong to user ${user.id}.`,
      );
    }
    // =========================================================

    const activities: UserActivity[] = [];

    // Group tickets by raffle and by day (YYYY-MM-DD)
    const ticketGroups: Record<string, any[]> = {};
    for (const ticket of rawTickets) {
      if (!ticket.createdat || isNaN(new Date(ticket.createdat).getTime())) {
        this.logger.warn(
          `Ticket ${ticket.id} has an invalid createdAt value, skipping.`,
        );
        continue;
      }
      const raffleId = ticket.raffleid;
      const day = new Date(ticket.createdat).toISOString().slice(0, 10);
      const key = `${raffleId}-${day}`;
      if (!ticketGroups[key]) {
        ticketGroups[key] = [];
      }
      ticketGroups[key].push(ticket);
    }

    // Prepare UserActivity response
    for (const [key, groupTickets] of Object.entries(ticketGroups)) {
      if (!groupTickets.length || !groupTickets[0]) continue;
      const firstDash = key.indexOf('-');
      const raffleId = key.substring(0, firstDash);
      const day = key.substring(firstDash + 1);
      const timestamp = new Date(day).toISOString();

      const userTickets = groupTickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketnumber,
        groupNumber: ticket.groupnumber,
        prizeAmount: ticket.prizeamount,
        isDistributed: ticket.isdistributed,
        transactionHash: ticket.transactionhash,
        createdAt: ticket.createdat,
        updatedAt: ticket.updatedat,
        raffle: { id: ticket.raffleid },
        referralCode: ticket.referralcode
          ? { code: ticket.referralcode }
          : undefined,
      }));

      activities.push({
        id: `purchase-${raffleId}-${timestamp}`,
        type: 'purchase',
        raffleId: String(raffleId),
        timestamp,
        ticketCount: userTickets.length,
        totalSpent: userTickets.length * 1,
        token: 'USDC',
        tickets: userTickets as any,
        referralCode: userTickets[0]?.referralCode?.code,
        status: 'COMPLETED',
      });

      const winningTicket = groupTickets.find(
        (t) => t.groupnumber === TicketGroup.GROUP_1,
      );
      if (winningTicket) {
        if (
          !winningTicket.updatedat ||
          isNaN(new Date(winningTicket.updatedat).getTime())
        ) {
          this.logger.warn(
            `Winning ticket ${winningTicket.id} has an invalid updatedAt value, skipping.`,
          );
          continue;
        }
        const winTicket = {
          id: winningTicket.id,
          ticketNumber: winningTicket.ticketnumber,
          groupNumber: winningTicket.groupnumber,
          prizeAmount: winningTicket.prizeamount,
          isDistributed: winningTicket.isdistributed,
          transactionHash: winningTicket.transactionhash,
          createdAt: winningTicket.createdat,
          updatedAt: winningTicket.updatedat,
          raffle: { id: winningTicket.raffleid },
          referralCode: winningTicket.referralcode
            ? { code: winningTicket.referralcode }
            : undefined,
        };
        activities.push({
          id: `win-${raffleId}-${winningTicket.id}`,
          type: 'win',
          raffleId: String(raffleId),
          timestamp: new Date(winningTicket.updatedat).toISOString(),
          prize: parseFloat(winningTicket.prizeamount.toString()),
          winningTicket: winningTicket.ticketnumber,
          tickets: [winTicket] as any,
          status: 'COMPLETED',
        });
      }
    }
    this.logger.log(
      `[DIAGNOSTIC] Returning ${activities.length} activity groups.`,
    );
    // Using JSON.stringify to get a clean log of the final data structure
    this.logger.log(
      `[DIAGNOSTIC] Final activities object: ${JSON.stringify(activities, null, 2)}`,
    );

    return activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  async getUserActivityStats(walletAddress: string) {
    const activities = await this.getUserActivity(walletAddress);

    // Calculate statistics
    const totalTickets = activities
      .filter((activity) => activity.type === 'purchase')
      .reduce((sum, activity) => sum + (activity.tickets?.length || 0), 0);

    const totalSpent = activities
      .filter((activity) => activity.type === 'purchase')
      .reduce((sum, activity) => sum + (activity.totalSpent || 0), 0);

    const totalWins = activities.filter(
      (activity) => activity.type === 'win',
    ).length;

    const totalWon = activities
      .filter((activity) => activity.type === 'win')
      .reduce((sum, activity) => sum + (activity.prize || 0), 0);

    // Calculate win rate
    const totalPurchases = activities.filter(
      (activity) => activity.type === 'purchase',
    ).length;
    const winRate = totalPurchases > 0 ? (totalWins / totalPurchases) * 100 : 0;

    // Find most active day
    const activitiesByDay = activities.reduce(
      (acc, activity) => {
        const date = new Date(activity.timestamp).toDateString();
        if (!acc[date]) {
          acc[date] = 0;
        }
        if (activity.type === 'purchase') {
          acc[date] += activity.ticketCount || 0;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const mostTicketsDay =
      Object.entries(activitiesByDay).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      'N/A';

    return {
      totalTickets,
      totalSpent,
      totalWins,
      totalWon,
      winRate,
      mostTicketsDay,
    };
  }

  async getRaffleTickets(id: string, page: number = 1, limit: number = 10) {
    const [tickets, total] = await this.ticketRepository.findAndCount({
      where: { raffle: { id: parseInt(id) } },
      relations: ['owner'],
      order: { ticketNumber: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        owner: ticket.owner.walletAddress,
        isWinning: ticket.isDistributed,
      })),
      total,
      page,
      limit,
    };
  }

  async getRaffleWinner(id: string) {
    const raffle = await this.raffleRepository.findOne({
      where: { id: parseInt(id), status: RaffleStatus.COMPLETED },
      relations: ['tickets'],
    });

    if (!raffle) {
      throw new NotFoundException(`Completed raffle with ID ${id} not found`);
    }

    const winningTicket = raffle.tickets.find((ticket) => ticket.isDistributed);
    if (!winningTicket) {
      throw new NotFoundException(`No winning ticket found for raffle ${id}`);
    }

    return {
      raffleId: raffle.id,
      winningTicketId: winningTicket.id,
      ticketNumber: winningTicket.ticketNumber,
      winnerAddress: winningTicket.owner.walletAddress,
      prizeAmount: winningTicket.prizeAmount,
    };
  }

  async updateRaffle(id: number, updateData: Partial<Raffle>) {
    return this.raffleRepository.update(id, updateData);
  }

  async updateTicket(id: number, updateData: Partial<Ticket>) {
    return this.ticketRepository.update(id, updateData);
  }

  async updateTicketUsingTicketNumber(
    ticketNumber: number,
    raffleId: number,
    updateData: Partial<Ticket>,
  ): Promise<void> {
    const result = await this.ticketRepository.update(
      {
        ticketNumber,
        raffle: { id: raffleId }, // Ensure we update the right ticket in the right raffle
      },
      updateData,
    );

    if (result.affected === 0) {
      throw new NotFoundException(
        `Ticket ${ticketNumber} not found in raffle ${raffleId}`,
      );
    }
  }

  async updateTicketsBatchUsingTicketNumbers(
    updates: Array<{
      ticketNumber: number;
      raffleId: number;
      updates: Partial<Ticket>;
    }>,
  ): Promise<void> {
    if (updates.length === 0) return;

    await this.ticketRepository.manager.transaction(async (manager) => {
      // 🚀 Batch update using Promise.all for parallel execution
      await Promise.all(
        updates.map(({ ticketNumber, raffleId, updates: updateData }) =>
          manager.update(
            Ticket,
            {
              ticketNumber,
              raffle: { id: raffleId },
            },
            updateData,
          ),
        ),
      );
    });
  }

  async getActiveRaffles() {
    return this.raffleRepository.find({
      where: { status: RaffleStatus.ACTIVE },
      order: { id: 'ASC' },
    });
  }
}
