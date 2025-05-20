import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Raffle, RaffleStatus } from '../entities/raffle.entity';

@Injectable()
export class RaffleSchedulerService {
  private readonly logger = new Logger(RaffleSchedulerService.name);

  constructor(
    @InjectRepository(Raffle)
    private raffleRepository: Repository<Raffle>,
  ) {}

  // Run every minute to manage raffle states
  @Cron(CronExpression.EVERY_MINUTE)
  async manageRaffleStates() {
    try {
      const now = new Date();
      this.logger.debug(
        `Running raffle state management at ${now.toISOString()}`,
      );

      // First ensure we have enough pending raffles
      await this.ensureInactiveRaffles();

      // Then complete any expired raffles
      await this.completeExpiredRaffles();

      // Finally activate the next raffle
      await this.activateNextRaffle();
    } catch (error) {
      this.logger.error('Error managing raffle states:', error);
    }
  }

  private async completeExpiredRaffles() {
    const now = new Date();

    // Find active raffles that have expired
    const expiredRaffles = await this.raffleRepository.find({
      where: {
        status: RaffleStatus.ACTIVE,
        endDate: LessThan(now),
      },
    });

    for (const raffle of expiredRaffles) {
      raffle.status = RaffleStatus.COMPLETED;
      await this.raffleRepository.save(raffle);
      this.logger.log(`Completed expired raffle ${raffle.id}`);
    }
  }

  private async activateNextRaffle() {
    const now = new Date();

    // Check if we have any active raffles
    const activeRaffle = await this.raffleRepository.findOne({
      where: { status: RaffleStatus.ACTIVE },
    });

    // If no active raffle exists, find and activate the next one
    if (!activeRaffle) {
      const nextRaffle = await this.raffleRepository.findOne({
        where: {
          status: RaffleStatus.PENDING,
          startDate: LessThan(now),
        },
        order: { startDate: 'ASC' },
      });

      if (nextRaffle) {
        nextRaffle.status = RaffleStatus.ACTIVE;
        await this.raffleRepository.save(nextRaffle);
        this.logger.log(
          `Activated raffle ${nextRaffle.id} for ${nextRaffle.startDate}`,
        );
      } else {
        this.logger.warn('No pending raffles found to activate');
      }
    } else {
      this.logger.log('Active raffle already exists');
    }
  }

  private async ensureInactiveRaffles() {
    try {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      // Set time to start of today (00:00:00)
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      // Set time to end of today (23:59:59)
      const todayEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      );

      // Check if we have a raffle for today
      const todayRaffle = await this.raffleRepository.findOne({
        where: {
          status: RaffleStatus.PENDING,
          startDate: LessThan(todayEnd),
          endDate: MoreThan(todayStart),
        },
      });

      if (!todayRaffle) {
        this.logger.log('No raffle found for today, creating one');
        const newRaffle = this.raffleRepository.create({
          title: `Daily Raffle ${todayStart.toLocaleDateString()}`,
          description: `Daily raffle for ${todayStart.toLocaleDateString()}`,
          maxTickets: 1000,
          totalTickets: 0,
          ticketPrice: 1,
          startDate: todayStart,
          endDate: todayEnd,
          status: RaffleStatus.PENDING,
          totalPrizeAmount: 1000,
          platformFee: 50,
          referralRewards: 50,
          distributedAmount: 0,
          isDistributed: false,
        });

        await this.raffleRepository.save(newRaffle);
        this.logger.log('Created raffle for today');
      }

      // Get all pending raffles within next 30 days
      const pendingRaffles = await this.raffleRepository.find({
        where: {
          status: RaffleStatus.PENDING,
          startDate: LessThan(thirtyDaysFromNow),
        },
        order: { startDate: 'ASC' },
      });

      // Create a map of existing raffle dates
      const existingDates = new Set(
        pendingRaffles.map((raffle) =>
          new Date(raffle.startDate).toDateString(),
        ),
      );

      // Create new raffles for missing dates
      let currentDate = new Date(todayStart);
      currentDate.setDate(currentDate.getDate() + 1); // Start from tomorrow

      const newRaffles: Raffle[] = [];

      while (currentDate <= thirtyDaysFromNow) {
        const dateString = currentDate.toDateString();

        if (!existingDates.has(dateString)) {
          const startDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate(),
          );
          const endDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate(),
            23,
            59,
            59,
          );

          const raffle = this.raffleRepository.create({
            title: `Daily Raffle ${startDate.toLocaleDateString()}`,
            description: `Daily raffle for ${startDate.toLocaleDateString()}`,
            maxTickets: 1000,
            totalTickets: 0,
            ticketPrice: 1,
            startDate,
            endDate,
            status: RaffleStatus.PENDING,
            totalPrizeAmount: 1000,
            platformFee: 50,
            referralRewards: 50,
            distributedAmount: 0,
            isDistributed: false,
          });

          newRaffles.push(raffle);
          existingDates.add(dateString);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (newRaffles.length > 0) {
        await this.raffleRepository.save(newRaffles);
        this.logger.log(
          `Successfully created ${newRaffles.length} new pending raffles`,
        );
      }
    } catch (error) {
      this.logger.error('Error ensuring inactive raffles:', error);
      throw error;
    }
  }
}
