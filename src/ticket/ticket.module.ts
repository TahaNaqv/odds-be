import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../entities/ticket.entity';
import { User } from '../entities/user.entity';
import { Raffle } from '../entities/raffle.entity';
import { ReferralCode } from '../entities/referral-code.entity';
import { TicketService } from './ticket.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, User, Raffle, ReferralCode])],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}
