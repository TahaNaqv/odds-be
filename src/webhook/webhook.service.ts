import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractService } from '../contract/contract.service';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../entities/transaction.entity';
import { TransactionService } from '../transaction/transaction.service';

export interface AlchemyWebhookEvent {
  webhookId: string;
  id: string;
  createdAt: string;
  type: string;
  event: {
    data: {
      block: {
        hash: string;
        number: number;
        timestamp: number;
        logs: Array<{
          data: string;
          topics: string[];
          index: number;
          account: {
            address: string;
          };
          transaction: {
            hash: string;
            nonce: number;
            index: number;
            from: {
              address: string;
            };
            to: {
              address: string;
            };
            value: string;
            gasPrice: string;
            maxFeePerGas: string;
            maxPriorityFeePerGas: string;
            gas: number;
            status: number;
            gasUsed: number;
            cumulativeGasUsed: number;
            effectiveGasPrice: string;
            createdContract: null | string;
          };
        }>;
      };
    };
    sequenceNumber: string;
    network: string;
  };
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly signingKey: string;

  constructor(
    private configService: ConfigService,
    private contractService: ContractService,
    private transactionService: TransactionService,
  ) {
    this.signingKey =
      this.configService.get<string>('ALCHEMY_SIGNING_KEY') || '';
    if (!this.signingKey) {
      throw new Error('ALCHEMY_SIGNING_KEY is not defined');
    }
  }

  async handleWebhookEvent(event: AlchemyWebhookEvent): Promise<void> {
    try {
      this.logger.log(`Processing webhook event id: ${event.id}`);

      // Process each log in the event
      for (const log of event.event.data.block.logs) {
        this.logger.log('Processing contract log:', {
          hash: log.transaction.hash,
          fromAddress: log.transaction.from.address,
          toAddress: log.transaction.to.address,
          topics: log.topics,
          data: log.data,
        });

        // Check if this is a TicketPurchased event by looking at the first topic
        if (
          log.topics[0] ===
          '0xef266bb11bf4b58aa8562ab8c8746e3b84a521780a2c57ca09d87bae13f5eb09'
        ) {
          this.logger.log('Processing TicketPurchased event');

          // Save transaction to database
          const transaction = new Transaction();
          transaction.transactionHash = log.transaction.hash;
          transaction.fromAddress = log.transaction.from.address;
          transaction.toAddress = log.transaction.to.address;
          transaction.type = TransactionType.TICKET_PURCHASE;
          transaction.status = TransactionStatus.COMPLETED;
          transaction.nonce = log.transaction.nonce;
          transaction.description = 'Ticket purchased';
          transaction.amount = parseInt(log.transaction.value);

          await this.transactionService.save(transaction);

          // Parse the event data
          this.logger.log('Event data:', {
            rawData: log.data,
            topics: log.topics,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error processing webhook event:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        eventId: event.id,
      });
      throw error;
    }
  }
}
