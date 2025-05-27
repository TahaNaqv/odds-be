import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Raffle } from '../entities/raffle.entity';
import { ContractModule } from '../contract/contract.module';
import { CronService } from './cron.service';

@Module({
  imports: [TypeOrmModule.forFeature([Raffle]), ContractModule],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
