import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { ContractModule } from '../contract/contract.module';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [ContractModule, TransactionModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
 