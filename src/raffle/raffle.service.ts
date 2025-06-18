import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Raffle, RaffleStatus } from '../entities/raffle.entity';
import { Ticket } from '../entities/ticket.entity';
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
  ticketIds?: number[];
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
      raffles: raffles.map(this.formatRaffleResponse),
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

    return this.formatRaffleResponse(raffle);
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
    const userTickets = await this.ticketRepository.find({
      where: { owner: { id: user.id } },
      relations: ['raffle', 'referralCode'],
      order: { createdAt: 'DESC' },
    });

    const activities: UserActivity[] = [];

    // Group tickets by raffle
    const ticketsByRaffle = userTickets.reduce(
      (acc, ticket) => {
        if (!acc[ticket.raffle.id]) {
          acc[ticket.raffle.id] = [];
        }
        acc[ticket.raffle.id].push(ticket);
        return acc;
      },
      {} as Record<number, any[]>,
    );

    // Create purchase activities for each raffle
    for (const [raffleId, tickets] of Object.entries(ticketsByRaffle)) {
      const ticketIds = tickets.map((t) => t.ticketNumber);
      const winningTicket = tickets.find((t) => t.isDistributed);

      activities.push({
        id: `purchase-${raffleId}-${user.id}`,
        type: 'purchase',
        raffleId: raffleId,
        timestamp: tickets[0].createdAt.toISOString(),
        ticketCount: tickets.length,
        totalSpent: tickets.length * 1, // $1 per ticket
        token: 'USDC',
        ticketIds: ticketIds,
        referralCode: tickets[0].referralCode?.code,
        status: 'COMPLETED',
      });

      // If there's a winning ticket, create a win activity
      if (winningTicket) {
        activities.push({
          id: `win-${raffleId}-${user.id}`,
          type: 'win',
          raffleId: raffleId,
          timestamp: winningTicket.updatedAt.toISOString(),
          prize: parseFloat(winningTicket.prizeAmount.toString()),
          winningTicket: winningTicket.ticketNumber,
          ticketIds: [winningTicket.ticketNumber],
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
      .reduce((sum, activity) => sum + (activity.ticketCount || 0), 0);

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

  private formatRaffleResponse(raffle: Raffle) {
    if (!raffle) {
      return null;
    }

    return {
      id: raffle.id,
      ticketsSold: raffle.totalTickets,
      maxTickets: raffle.maxTickets,
      targetAmount: raffle.totalPrizeAmount,
      prizePool: raffle.distributedAmount,
      progress: (raffle.totalTickets / raffle.maxTickets) * 100,
      ticketPrice: raffle.ticketPrice,
      status: raffle.status,
    };
  }
}
