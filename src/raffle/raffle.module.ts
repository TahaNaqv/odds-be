import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RaffleController } from './raffle.controller';
import { RaffleService } from './raffle.service';
import { RaffleSchedulerService } from './raffle-scheduler.service';
import { Raffle } from '../entities/raffle.entity';
import { Ticket } from '../entities/ticket.entity';
import { User } from '../entities/user.entity';
import { Transaction } from '../entities/transaction.entity';
import { ReferralCode } from '../entities/referral-code.entity';
import { ReferralService } from '../referral/referral.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Raffle, Ticket, User, Transaction, ReferralCode]),
  ],
  controllers: [RaffleController],
  providers: [RaffleService, RaffleSchedulerService, ReferralService],
  exports: [RaffleService, ReferralService],
})
export class RaffleModule {}
