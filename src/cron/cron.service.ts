import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Raffle, RaffleStatus } from '../entities/raffle.entity';
import { ContractService } from '../contract/contract.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @InjectRepository(Raffle)
    private raffleRepository: Repository<Raffle>,
    private contractService: ContractService,
  ) { }

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

      // Ensure we have exactly 10 active raffles
      await this.ensureRaffles();

      // Complete raffles that have sold all tickets
      await this.completeRaffle();
    } catch (error) {
      this.logger.error('Error managing raffle states:', error);
    }
  }

  /**
   * Ensures there are exactly 10 active raffles in the database and smart contract.
   * If there are fewer than 10 active raffles, it creates new ones.
   */
  private async ensureRaffles() {
    try {
      // Get all active raffles
      const activeRaffles = await this.raffleRepository.find({
        where: { status: RaffleStatus.ACTIVE },
      });

      this.logger.debug(`Found ${activeRaffles.length} active raffles`);

      // If we have exactly 10 active raffles, no action needed
      if (activeRaffles.length === 10) {
        this.logger.debug('Already have 10 active raffles, no action needed');
        return;
      }

      // If we have more than 10 active raffles (shouldn't happen, but just in case)
      if (activeRaffles.length > 10) {
        this.logger.warn(`Found ${activeRaffles.length} active raffles, which is more than the required 10`);
        return;
      }

      // Calculate how many new raffles we need to create
      const neededRaffles = 10 - activeRaffles.length;
      this.logger.debug(`Need to create ${neededRaffles} new raffles`);

      // Check if we have enough pending raffles to activate
      const pendingRaffles = await this.raffleRepository.find({
        where: { status: RaffleStatus.PENDING },
        order: { id: 'ASC' },
        take: neededRaffles,
      });

      this.logger.debug(`Found ${pendingRaffles.length} pending raffles`);

      // Activate pending raffles
      for (const raffle of pendingRaffles) {
        raffle.status = RaffleStatus.ACTIVE;
        await this.raffleRepository.save(raffle);
        this.logger.log(`Activated raffle ${raffle.id}`);
      }

      // If we still need more raffles after activating all pending ones
      const remainingNeeded = neededRaffles - pendingRaffles.length;
      if (remainingNeeded > 0) {
        this.logger.debug(`Need to create ${remainingNeeded} new raffles`);
        const newRaffles: Raffle[] = [];

        // Create new raffles
        for (let i = 0; i < remainingNeeded; i++) {
          const now = new Date();
          const raffle = this.raffleRepository.create({
            title: `Raffle ${now.toISOString()}`,
            description: `Raffle created at ${now.toISOString()}`,
            maxTickets: 1000,
            totalTickets: 0,
            ticketPrice: 1,
            status: RaffleStatus.ACTIVE,
            totalPrizeAmount: 1000,
            platformFee: 50,
            referralRewards: 50,
            distributedAmount: 0,
            isDistributed: false,
          });

          newRaffles.push(raffle);
        }

        // Save new raffles to database
        const savedRaffles = await this.raffleRepository.save(newRaffles);

        // Create lotteries in smart contract for each new raffle
        for (const raffle of savedRaffles) {
          await this.contractService.createLottery(
            raffle.id,
            raffle.maxTickets,
          );
          this.logger.log(`Created new active raffle ${raffle.id} with lottery in smart contract`);
        }
      }

      // Verify we now have exactly 10 active raffles
      const finalActiveRaffles = await this.raffleRepository.find({
        where: { status: RaffleStatus.ACTIVE },
      });

      this.logger.log(`Now have ${finalActiveRaffles.length} active raffles`);
    } catch (error) {
      this.logger.error('Error ensuring active raffles:', error);
      throw error;
    }
  }

  /**
   * Completes raffles that have sold all tickets.
   * Updates the raffle status in the database and ends the lottery in the smart contract.
   */
  private async completeRaffle() {
    try {
      // Find active raffles
      const activeRaffles = await this.raffleRepository.find({
        where: {
          status: RaffleStatus.ACTIVE,
        },
      });

      this.logger.debug(`Checking ${activeRaffles.length} active raffles for completion`);

      for (const raffle of activeRaffles) {
        try {
          // Check if all tickets are sold
          if (raffle.totalTickets >= raffle.maxTickets) {
            this.logger.log(`Raffle ${raffle.id} has sold all tickets (${raffle.totalTickets}/${raffle.maxTickets}), completing it`);

            // Check lottery state in contract first
            const lottery = await this.contractService.getLottery(raffle.id);

            if (!lottery) {
              this.logger.warn(`Lottery ${raffle.id} does not exist in contract`);
              continue;
            }

            if (!lottery.isActive) {
              this.logger.warn(`Lottery ${raffle.id} is not active in contract`);
              // Update raffle status in database to match contract state
              await this.raffleRepository.update(raffle.id, {
                status: RaffleStatus.COMPLETED,
                isDistributed: lottery.isDrawn,
              });
              continue;
            }

            // Update raffle status in database
            raffle.status = RaffleStatus.COMPLETED;
            await this.raffleRepository.save(raffle);
            this.logger.log(`Completed raffle ${raffle.id} in database`);

            // End lottery in smart contract
            const txHash = await this.contractService.endLottery(raffle.id);
            this.logger.log(
              `Ended lottery for raffle ${raffle.id} in contract. Transaction: ${txHash}`,
            );
          } else {
            this.logger.debug(`Raffle ${raffle.id} has not sold all tickets yet (${raffle.totalTickets}/${raffle.maxTickets})`);
          }
        } catch (error) {
          this.logger.error(`Error processing raffle ${raffle.id}:`, error);
          // Continue with other raffles even if one fails
        }
      }
    } catch (error) {
      this.logger.error('Error completing raffles:', error);
      throw error;
    }
  }
}
