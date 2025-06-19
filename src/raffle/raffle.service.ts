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
      relations: ['tickets'],
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
    // Validate referral code
    const referralCodeEntity = await this.referralCodeRepository.findOne({
      where: { code: referralCode.toLowerCase() },
      relations: ['owner'],
    });

    if (!referralCodeEntity) {
      throw new BadRequestException('Invalid referral code');
    }

    // Check if user is trying to use their own referral code
    if (referralCodeEntity.owner.id === userId) {
      throw new BadRequestException('You cannot use your own referral code');
    }

    // Get current and future raffles for auto-entry
    const currentRaffle = await this.raffleRepository.findOne({
      where: { id: raffleId },
    });

    if (!currentRaffle) {
      throw new NotFoundException('Raffle not found');
    }

    if (currentRaffle.status !== RaffleStatus.ACTIVE) {
      throw new BadRequestException('Raffle is not active');
    }

    // Get future raffles for auto-entry
    const futureRaffles = (
      await this.raffleRepository.find({
        where: {
          status: RaffleStatus.ACTIVE,
          id: MoreThan(currentRaffle.id),
        },
        order: { id: 'ASC' },
      })
    ).slice(0, Math.max(0, autoEntry - 1)); // Limit the results after fetching

    // Combine current and future raffles
    const allRaffles = [currentRaffle, ...futureRaffles];

    // Validate we have enough raffles for auto-entry
    if (allRaffles.length < autoEntry) {
      throw new BadRequestException(
        `Not enough future raffles available for ${autoEntry} auto-entries`,
      );
    }

    // Create tickets for each raffle
    const createdTickets: Ticket[] = [];

    const raffleIds: number[] = [];
    for (const raffle of allRaffles) {
      // Check if enough tickets are available
      const remainingTickets = raffle.maxTickets - raffle.totalTickets;
      if (remainingTickets < ticketCount) {
        throw new BadRequestException(
          `Only ${remainingTickets} tickets available for raffle ${raffle.id}`,
        );
      }

      // Create tickets for this raffle
      for (let i = 0; i < ticketCount; i++) {
        const ticket = this.ticketRepository.create({
          ticketNumber: raffle.totalTickets + i + 1,
          owner: { id: userId },
          raffle: { id: raffle.id },
          referralCode: referralCodeEntity,
        });

        const savedTicket = await this.ticketRepository.save(ticket);
        createdTickets.push(savedTicket);
      }

      // Update raffle ticket count
      await this.raffleRepository.update(raffle.id, {
        totalTickets: raffle.totalTickets + ticketCount,
      });

      raffleIds.push(raffle.id);

      // Update referral code usage
      await this.referralCodeRepository.update(referralCodeEntity.id, {
        totalUses: referralCodeEntity.totalUses + ticketCount,
      });

      // Update user's total tickets purchased
      await this.userRepository.update(userId, {
        totalTicketsPurchased: () => `totalTicketsPurchased + ${ticketCount}`,
      });
    }

    // Create unsigned transactions for contract
    const contractTx = await this.contractService.createUnsignedBuyTicketsTx(
      walletAddress,
      raffleIds,
      ticketCount,
    );

    // Check if this is the user's first purchase and generate referral code if needed
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['referralCode'],
    });

    let userReferralCode: string | undefined = user?.referralCode?.code;
    if (user && !user.referralCode) {
      const newReferralCode =
        await this.referralService.generateUserReferralCode(user);
      userReferralCode = newReferralCode.code;
    }

    return {
      tickets: createdTickets,
      userReferralCode,
      contractTx,
      raffleIds,
      ticketCount,
    };
  }

  async getUserActivity(walletAddress: string): Promise<UserActivity[]> {
    // Get user by wallet address
    const user = await this.userRepository.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      return [];
    }

    // Get all tickets for the user
    const raffles = await this.raffleRepository.find({
      where: { tickets: { owner: { id: user.id } } },
      relations: ['tickets', 'tickets.owner', 'tickets.referralCode'],
      order: { createdAt: 'DESC' },
    });

    const activities: UserActivity[] = [];

    // Group tickets by raffle and by day (YYYY-MM-DD)
    const ticketGroups: Record<string, Ticket[]> = {};
    for (const raffle of raffles) {
      for (const ticket of raffle.tickets) {
        if (ticket.owner && ticket.owner.id === user.id) {
          const day = ticket.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
          const key = `${raffle.id}-${day}`;
          if (!ticketGroups[key]) {
            ticketGroups[key] = [];
          }
          ticketGroups[key].push(ticket);
        }
      }
    }

    // Prepare UserActivity response
    for (const [key, tickets] of Object.entries(ticketGroups)) {
      if (!tickets.length || !tickets[0]) continue; // Guard clause
      const firstDash = key.indexOf('-');
      const raffleId = key.substring(0, firstDash);
      const day = key.substring(firstDash + 1);
      const timestamp = new Date(day).toISOString(); // Start of the day in ISO
      activities.push({
        id: `purchase-${raffleId}-${timestamp}`,
        type: 'purchase',
        raffleId: String(raffleId),
        timestamp,
        ticketCount: tickets.length,
        totalSpent: tickets.length * 1, // $1 per ticket
        token: 'USDC',
        tickets: tickets,
        referralCode: tickets[0].referralCode?.code,
        status: 'COMPLETED',
      });

      // Win activity if any ticket in this group is a winner
      const winningTicket = tickets.find(
        (t) => t.groupNumber == TicketGroup.GROUP_1,
      );
      if (winningTicket) {
        activities.push({
          id: `win-${raffleId}-${winningTicket.id}`,
          type: 'win',
          raffleId: String(raffleId),
          timestamp: winningTicket.updatedAt.toISOString(),
          prize: parseFloat(winningTicket.prizeAmount.toString()),
          winningTicket: winningTicket.ticketNumber,
          tickets: [winningTicket],
          status: 'COMPLETED',
        });
      }
    }

    // Sort by timestamp descending (most recent first)
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

  async getActiveRaffles() {
    return this.raffleRepository.find({
      where: { status: RaffleStatus.ACTIVE },
      order: { id: 'ASC' },
    });
  }
}
