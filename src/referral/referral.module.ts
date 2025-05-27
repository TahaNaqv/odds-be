import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralService } from './referral.service';
import { ReferralCode } from '../entities/referral-code.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReferralCode, User])],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
