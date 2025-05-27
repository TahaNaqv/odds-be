import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './entities/user.entity';
import { Ticket } from './entities/ticket.entity';
import { Raffle } from './entities/raffle.entity';
import { Transaction } from './entities/transaction.entity';
import { AuthModule } from './auth/auth.module';
import { RaffleModule } from './raffle/raffle.module';
import { ReferralCode } from './entities/referral-code.entity';
import { ContractModule } from './contract/contract.module';
import { WebhookModule } from './webhook/webhook.module';
import { CronModule } from './cron/cron.module';
import { TicketModule } from './ticket/ticket.module';
import { ReferralModule } from './referral/referral.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [Raffle, Ticket, User, ReferralCode, Transaction],
        synchronize: configService.get('DB_SYNCHRONIZE'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    RaffleModule,
    ContractModule,
    WebhookModule,
    CronModule,
    TicketModule,
    ReferralModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
