import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Raffle, RaffleStatus } from '../entities/raffle.entity';
import { ContractService } from '../contract/contract.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @InjectRepository(Raffle)
    private raffleRepository: Repository<Raffle>,
    private contractService: ContractService,
  ) {}

  // Run every minute to manage raffle states
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'manageRaffleStates',
    waitForCompletion: true,
  })
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
      try {
        // Update raffle status in database
        raffle.status = RaffleStatus.COMPLETED;
        await this.raffleRepository.save(raffle);
        this.logger.log(`Completed expired raffle ${raffle.id} in database`);

        // End lottery in smart contract
        const txHash = await this.contractService.endLottery(raffle.id);
        this.logger.log(
          `Ended lottery for raffle ${raffle.id} in contract. Transaction: ${txHash}`,
        );
      } catch (error) {
        this.logger.error(`Error completing raffle ${raffle.id}:`, error);
        // Continue with other raffles even if one fails
      }
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
      const tenDaysFromNow = new Date(now);
      tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);

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

      // Get all raffles within next 10 days
      const existingRaffles = await this.raffleRepository.find({
        where: {
          startDate: LessThan(tenDaysFromNow),
        },
        order: { startDate: 'ASC' },
      });

      // Create a map of existing raffle dates
      const existingDates = new Map<string, Raffle>();
      existingRaffles.forEach((raffle) => {
        const dateString = new Date(raffle.startDate).toDateString();
        existingDates.set(dateString, raffle);
      });

      // Check and create raffle for today
      const todayDateString = todayStart.toDateString();
      if (!existingDates.has(todayDateString)) {
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

        const savedRaffle = await this.raffleRepository.save(newRaffle);
        // Create lottery in smart contract
        await this.contractService.createLottery(
          savedRaffle.id,
          savedRaffle.maxTickets,
        );
        existingDates.set(todayDateString, savedRaffle);
        this.logger.log('Created raffle for today');
      }

      // Create new raffles for missing dates
      let currentDate = new Date(todayStart);
      currentDate.setDate(currentDate.getDate() + 1); // Start from tomorrow
      const newRaffles: Raffle[] = [];

      while (currentDate <= tenDaysFromNow) {
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
          existingDates.set(dateString, raffle);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (newRaffles.length > 0) {
        const savedRaffles = await this.raffleRepository.save(newRaffles);
        // Create lotteries in smart contract for each new raffle
        for (const raffle of savedRaffles) {
          await this.contractService.createLottery(
            raffle.id,
            raffle.maxTickets,
          );
        }
        this.logger.log(
          `Successfully created ${newRaffles.length} new pending raffles for next 10 days`,
        );
      } else {
        this.logger.log('All raffles for next 10 days are already created');
      }

      // Verify we have exactly one raffle per day
      const allDates = new Set<string>();
      existingRaffles.forEach((raffle) => {
        const dateString = new Date(raffle.startDate).toDateString();
        if (allDates.has(dateString)) {
          this.logger.warn(`Multiple raffles found for date: ${dateString}`);
        }
        allDates.add(dateString);
      });
    } catch (error) {
      this.logger.error('Error ensuring inactive raffles:', error);
      throw error;
    }
  }
}
