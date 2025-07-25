import {
  Inject,
  Injectable,
  OnModuleInit,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { ethers, ContractEventPayload } from 'ethers';
import * as contractJson from './utils/OddsLottery.json';
import { RaffleService } from '../raffle/raffle.service';
import { RaffleStatus } from '../entities/raffle.entity';
import { TicketGroup } from '../entities/ticket.entity';

interface LotteryCreatedEvent {
  lotteryId: bigint;
  maxTickets: bigint;
}

interface TicketPurchasedEvent {
  lotteryId: bigint;
  buyer: string;
  ticketId: bigint;
}

interface LotteryEndedEvent {
  lotteryId: bigint;
  winningTicketIds: bigint[];
  secondPlaceTicketIds: bigint[];
  prizePool: bigint;
  platformCut: bigint;
  distributedPool: bigint;
  totalTicketsSold: bigint;
  firstPlacePrizePerTicket: bigint;
  secondPlacePrizePerTicket: bigint;
}

@Injectable()
export class LotteryListenerService implements OnModuleInit {
  private readonly logger = new Logger(LotteryListenerService.name);
  private contract: ethers.Contract;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastProcessedBlock = 0;

  constructor(
    @Inject('WS_PROVIDER')
    private readonly provider:
      | ethers.JsonRpcProvider
      | ethers.WebSocketProvider,
    @Inject(forwardRef(() => RaffleService))
    private readonly raffleService: RaffleService,
  ) {}

  async onModuleInit() {
    this.logProviderType();
    await this.initializeContract();
    this.setupEventListeners();
  }

  private logProviderType() {
    if (this.provider instanceof ethers.WebSocketProvider) {
      this.logger.log(
        '🔌 LotteryListenerService initialized with WebSocket provider',
      );
    } else {
      this.logger.log(
        '🌐 LotteryListenerService initialized with HTTP provider (will use polling)',
      );
    }
  }

  private async initializeContract() {
    const contractAddress = process.env.LOTTERY_CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error(
        'LOTTERY_CONTRACT_ADDRESS environment variable is not defined',
      );
    }

    this.contract = new ethers.Contract(
      contractAddress,
      contractJson.abi,
      this.provider,
    );

    // Initialize lastProcessedBlock
    try {
      this.lastProcessedBlock = await this.provider.getBlockNumber();
      this.logger.log(
        `Initialized with block number: ${this.lastProcessedBlock}`,
      );
    } catch (error) {
      this.logger.error('Failed to get initial block number:', error);
      this.lastProcessedBlock = 0;
    }
  }

  private setupEventListeners() {
    if (this.provider instanceof ethers.WebSocketProvider) {
      this.logger.log('🔌 Setting up WebSocket event listeners');
      this.setupWebSocketListeners();
    } else {
      this.logger.log('🔄 Setting up HTTP provider with polling mode');
      this.startPollingMode();
    }
  }

  private setupWebSocketListeners() {
    try {
      // Setup WebSocket error handling
      this.provider.websocket.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
        this.handleConnectionError(error);
      });

      this.provider.websocket.on('close', (code, reason) => {
        this.logger.warn(
          `WebSocket connection closed (code: ${code}, reason: ${reason})`,
        );
        this.handleConnectionError(new Error('WebSocket closed'));
      });

      this.provider.websocket.on('open', () => {
        this.logger.log('WebSocket connection established');
        this.reconnectAttempts = 0;
      });

      // Setup contract event listeners
      this.listenToEvents();
    } catch (error) {
      this.logger.error('Failed to setup WebSocket listeners:', error);
      this.handleConnectionError(error);
    }
  }

  private listenToEvents() {
    try {
      // Remove all existing listeners to prevent duplicates
      this.contract.removeAllListeners();

      // Listen to LotteryCreated event
      this.contract.on(
        'LotteryCreated',
        async (
          lotteryId: bigint,
          maxTickets: bigint,
          event: ContractEventPayload,
        ) => {
          this.logger.log(`🎯 Lottery Created: ${lotteryId.toString()}`);
          await this.handleLotteryCreated(lotteryId, maxTickets, event);
        },
      );

      // Listen to TicketPurchased event
      this.contract.on(
        'TicketPurchased',
        async (
          lotteryId: bigint,
          buyer: string,
          ticketId: bigint,
          event: ContractEventPayload,
        ) => {
          this.logger.log(`🎫 Ticket Purchased: ${ticketId.toString()}`);
          await this.handleTicketPurchased(lotteryId, buyer, ticketId, event);
        },
      );

      // Listen to LotteryEnded event
      this.contract.on(
        'LotteryEnded',
        async (
          lotteryId: bigint,
          winningTicketIds: bigint[],
          secondPlaceTicketIds: bigint[],
          prizePool: bigint,
          platformCut: bigint,
          distributedPool: bigint,
          totalTicketsSold: bigint,
          firstPlacePrizePerTicket: bigint,
          secondPlacePrizePerTicket: bigint,
          event: ContractEventPayload,
        ) => {
          this.logger.log(`🏆 Lottery Ended: ${lotteryId.toString()}`);
          await this.handleLotteryEnded(
            lotteryId,
            winningTicketIds,
            secondPlaceTicketIds,
            prizePool,
            platformCut,
            distributedPool,
            totalTicketsSold,
            firstPlacePrizePerTicket,
            secondPlacePrizePerTicket,
            event,
          );
        },
      );

      this.logger.log('Event listeners established successfully');
      this.reconnectAttempts = 0;
    } catch (error) {
      this.logger.error('Failed to setup event listeners:', error);
      this.handleConnectionError(error);
    }
  }

  private async handleConnectionError(error: any) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = 5000 * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

      this.logger.warn(
        `Connection error, attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`,
      );

      setTimeout(async () => {
        try {
          await this.initializeContract();
          this.setupEventListeners();
        } catch (reconnectError) {
          this.logger.error('Reconnection failed:', reconnectError);
          this.handleConnectionError(reconnectError);
        }
      }, delay);
    } else {
      this.logger.error(
        'Max reconnection attempts reached. Switching to polling mode.',
      );
      this.startPollingMode();
    }
  }

  private async handleLotteryCreated(
    lotteryId: bigint,
    maxTickets: bigint,
    event: ContractEventPayload,
  ) {
    try {
      await this.raffleService.updateRaffle(Number(lotteryId), {
        transactionHash: event.log.transactionHash,
        isCreated: true,
      });

      this.logger.log(`✅ Updated raffle ${lotteryId} - Lottery Created`);
    } catch (error) {
      this.logger.error(`❌ Failed to update raffle ${lotteryId}:`, error);
    }
  }

  private async handleTicketPurchased(
    lotteryId: bigint,
    buyer: string,
    ticketId: bigint,
    event: ContractEventPayload,
  ) {
    try {
      await this.raffleService.updateTicket(Number(ticketId), {
        transactionHash: event.log.transactionHash,
        ticketNumber: Number(ticketId),
      });

      this.logger.log(`✅ Updated ticket ${ticketId} - Ticket Purchased`);
    } catch (error) {
      this.logger.error(`❌ Failed to update ticket ${ticketId}:`, error);
    }
  }

  private async handleLotteryEnded(
    lotteryId: bigint,
    winningTicketIds: bigint[],
    secondPlaceTicketIds: bigint[],
    prizePool: bigint,
    platformCut: bigint,
    distributedPool: bigint,
    totalTicketsSold: bigint,
    firstPlacePrizePerTicket: bigint,
    secondPlacePrizePerTicket: bigint,
    event: ContractEventPayload,
  ) {
    try {
      // Update raffle status and winner information
      await this.raffleService.updateRaffle(Number(lotteryId), {
        status: RaffleStatus.COMPLETED,
        isDistributed: true,
        distributedAmount: Number(ethers.formatUnits(distributedPool, 6)),
        platformFee: Number(ethers.formatUnits(platformCut, 6)),
        totalPrizeAmount: Number(ethers.formatUnits(prizePool, 6)),
        transactionHash: event.log.transactionHash,
      });

      // Update winning tickets
      for (const ticketId of winningTicketIds) {
        await this.raffleService.updateTicket(Number(ticketId), {
          groupNumber: TicketGroup.GROUP_1,
          prizeAmount: Number(ethers.formatUnits(firstPlacePrizePerTicket, 6)),
          isDistributed: true,
        });
      }

      // Update second place tickets
      for (const ticketId of secondPlaceTicketIds) {
        await this.raffleService.updateTicket(Number(ticketId), {
          groupNumber: TicketGroup.GROUP_2,
          prizeAmount: Number(ethers.formatUnits(secondPlacePrizePerTicket, 6)),
          isDistributed: true,
        });
      }

      this.logger.log(
        `✅ Lottery ${lotteryId} ended successfully - Updated ${winningTicketIds.length + secondPlaceTicketIds.length} winning tickets`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to update lottery end data for ${lotteryId}:`,
        error,
      );
    }
  }

  // Fallback polling mode for HTTP providers or when WebSocket fails
  private startPollingMode() {
    this.logger.log('🔄 Starting polling mode for events...');

    // Clear any existing polling interval
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollForRecentEvents();
      } catch (error) {
        this.logger.error('❌ Error in polling mode:', error);
      }
    }, 15000); // Poll every 15 seconds
  }

  private async pollForRecentEvents() {
    try {
      const latestBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(
        this.lastProcessedBlock + 1,
        latestBlock - 100,
      );

      if (fromBlock > latestBlock) {
        return; // No new blocks to process
      }

      this.logger.debug(`Polling blocks ${fromBlock} to ${latestBlock}`);

      // Poll for each event type
      await this.pollEventType('LotteryCreated', fromBlock, latestBlock);
      await this.pollEventType('TicketPurchased', fromBlock, latestBlock);
      await this.pollEventType('LotteryEnded', fromBlock, latestBlock);

      this.lastProcessedBlock = latestBlock;
    } catch (error) {
      this.logger.error('❌ Error polling for events:', error);
    }
  }

  private async pollEventType(
    eventName: string,
    fromBlock: number,
    toBlock: number,
  ) {
    try {
      const events = await this.contract.queryFilter(
        this.contract.filters[eventName](),
        fromBlock,
        toBlock,
      );

      if (events.length > 0) {
        this.logger.log(`📊 Found ${events.length} ${eventName} events`);
      }

      for (const event of events) {
        const mockEventPayload = { log: event };

        switch (eventName) {
          case 'LotteryCreated':
            await this.handleLotteryCreated(
              event.args[0],
              event.args[1],
              mockEventPayload,
            );
            break;
          case 'TicketPurchased':
            await this.handleTicketPurchased(
              event.args[0],
              event.args[1],
              event.args[2],
              mockEventPayload,
            );
            break;
          case 'LotteryEnded':
            await this.handleLotteryEnded(
              event.args[0],
              event.args[1],
              event.args[2],
              event.args[3],
              event.args[4],
              event.args[5],
              event.args[6],
              event.args[7],
              event.args[8],
              mockEventPayload,
            );
            break;
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error polling for ${eventName} events:`, error);
    }
  }

  // Helper method to get past events
  async getPastEvents(
    eventName: string,
    fromBlock: number,
    toBlock: number | 'latest' = 'latest',
  ) {
    try {
      const events = await this.contract.queryFilter(
        this.contract.filters[eventName](),
        fromBlock,
        toBlock,
      );
      return events;
    } catch (error) {
      this.logger.error(`❌ Error fetching past ${eventName} events:`, error);
      throw error;
    }
  }

  // Helper method to get lottery information
  async getLotteryInfo(lotteryId: bigint) {
    try {
      const lotteryInfo = await this.contract.getLottery(lotteryId);
      return {
        id: lotteryInfo.id.toString(),
        maxTickets: lotteryInfo.maxTickets.toString(),
        ticketsSold: lotteryInfo.ticketsSold.toString(),
        isActive: lotteryInfo.isActive,
        isDrawn: lotteryInfo.isDrawn,
        createdAt: new Date(Number(lotteryInfo.createdAt) * 1000).toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Error fetching lottery info for ID ${lotteryId}:`,
        error,
      );
      throw error;
    }
  }

  // Cleanup method
  async onModuleDestroy() {
    this.logger.log('🛑 Shutting down lottery listener service...');

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    if (this.contract) {
      this.contract.removeAllListeners();
    }

    if (this.provider instanceof ethers.WebSocketProvider) {
      try {
        this.provider.websocket.close();
      } catch (error) {
        this.logger.error('Error closing WebSocket:', error);
      }
    }
  }
}
