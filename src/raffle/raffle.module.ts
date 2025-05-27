import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RaffleController } from './raffle.controller';
import { RaffleService } from './raffle.service';
import { Raffle } from '../entities/raffle.entity';
import { Ticket } from '../entities/ticket.entity';
import { User } from '../entities/user.entity';
import { Transaction } from '../entities/transaction.entity';
import { ReferralCode } from '../entities/referral-code.entity';
import { ReferralService } from '../referral/referral.service';
import { ContractModule } from '../contract/contract.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Raffle, Ticket, User, Transaction, ReferralCode]),
    forwardRef(() => ContractModule),
  ],
  controllers: [RaffleController],
  providers: [RaffleService, ReferralService],
  exports: [RaffleService, ReferralService],
})
export class RaffleModule {}
