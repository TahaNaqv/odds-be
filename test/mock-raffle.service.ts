import { Injectable } from '@nestjs/common';
import { RaffleService } from '../src/raffle/raffle.service';
import { Repository, UpdateResult } from 'typeorm';
import { Raffle } from '../src/entities/raffle.entity';
import { Ticket } from '../src/entities/ticket.entity';
import { User } from '../src/entities/user.entity';
import { Transaction } from '../src/entities/transaction.entity';
import { ReferralCode } from '../src/entities/referral-code.entity';
import { ReferralService } from '../src/referral/referral.service';
import { ContractService } from '../src/contract/contract.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MockRaffleService extends RaffleService {
  constructor() {
    const mockRepo = {
      findOne: () => Promise.resolve(null),
      find: () => Promise.resolve([]),
      create: () => ({}),
      save: () => Promise.resolve({}),
      update: () =>
        Promise.resolve({ affected: 1, raw: [], generatedMaps: [] }),
    } as unknown as Repository<any>;

    super(
      mockRepo as Repository<Raffle>,
      mockRepo as Repository<Ticket>,
      mockRepo as Repository<User>,
      mockRepo as Repository<Transaction>,
      mockRepo as Repository<ReferralCode>,
      {} as ReferralService,
      {} as ContractService,
      {} as ConfigService,
    );
  }

  async updateRaffle(
    id: number,
    updateData: Partial<Raffle>,
  ): Promise<UpdateResult> {
    return Promise.resolve({ affected: 1, raw: [], generatedMaps: [] });
  }

  async updateTicket(
    id: number,
    updateData: Partial<Ticket>,
  ): Promise<UpdateResult> {
    return Promise.resolve({ affected: 1, raw: [], generatedMaps: [] });
  }
}
