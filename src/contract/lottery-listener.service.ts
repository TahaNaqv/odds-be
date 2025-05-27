// src/lottery/lottery-listener.service.ts
import { Inject, Injectable, OnModuleInit, forwardRef } from '@nestjs/common';
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
  private contract: ethers.Contract;

  constructor(
    @Inject('ETH_PROVIDER') private readonly provider: ethers.JsonRpcProvider,
    @Inject(forwardRef(() => RaffleService))
    private readonly raffleService: RaffleService,
  ) {}

  onModuleInit() {
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

    this.listenToEvents();
  }

  private listenToEvents() {
    // Listen to LotteryCreated event
    this.contract.on(
      'LotteryCreated',
      async (
        lotteryId: bigint,
        maxTickets: bigint,
        event: ContractEventPayload,
      ) => {
        const eventData: LotteryCreatedEvent = {
          lotteryId,
          maxTickets,
        };

        console.log('🎯 Lottery Created:', {
          lotteryId: lotteryId.toString(),
          maxTickets: maxTickets.toString(),
          transactionHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
        });

        try {
          // Update raffle in database
          await this.raffleService.updateRaffle(Number(lotteryId), {
            transactionHash: event.log.transactionHash,
            isCreated: true,
          });
        } catch (error) {
          console.error('Failed to update raffle:', error);
        }
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
        const eventData: TicketPurchasedEvent = {
          lotteryId,
          buyer,
          ticketId,
        };

        console.log('🎫 Ticket Purchased:', {
          lotteryId: lotteryId.toString(),
          buyer,
          ticketId: ticketId.toString(),
          transactionHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
        });

        try {
          // Update ticket in database
          await this.raffleService.updateTicket(Number(ticketId), {
            transactionHash: event.log.transactionHash,
            ticketNumber: Number(ticketId),
          });
        } catch (error) {
          console.error('Failed to update ticket:', error);
        }
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
        try {
          // Update raffle status and winner information
          await this.raffleService.updateRaffle(Number(lotteryId), {
            status: RaffleStatus.COMPLETED,
            isDistributed: true,
            distributedAmount: Number(ethers.formatUnits(distributedPool, 6)),
            platformFee: Number(ethers.formatUnits(platformCut, 6)),
            totalPrizeAmount: Number(ethers.formatUnits(prizePool, 6)),
            winnerId: Number(winningTicketIds[0]), // First winning ticket
            winningTicketId: Number(winningTicketIds[0]),
            transactionHash: event.log.transactionHash,
          });

          // Update winning tickets
          for (const ticketId of winningTicketIds) {
            await this.raffleService.updateTicket(Number(ticketId), {
              groupNumber: TicketGroup.GROUP_1,
              prizeAmount: Number(
                ethers.formatUnits(firstPlacePrizePerTicket, 6),
              ),
              isDistributed: true,
            });
          }

          // Update second place tickets
          for (const ticketId of secondPlaceTicketIds) {
            await this.raffleService.updateTicket(Number(ticketId), {
              groupNumber: TicketGroup.GROUP_2,
              prizeAmount: Number(
                ethers.formatUnits(secondPlacePrizePerTicket, 6),
              ),
              isDistributed: true,
            });
          }

          console.log('🏆 Lottery Ended:', {
            lotteryId: lotteryId.toString(),
            winningTicketIds: winningTicketIds.map((id) => id.toString()),
            secondPlaceTicketIds: secondPlaceTicketIds.map((id) =>
              id.toString(),
            ),
            prizePool: ethers.formatUnits(prizePool, 6),
            platformCut: ethers.formatUnits(platformCut, 6),
            distributedPool: ethers.formatUnits(distributedPool, 6),
            totalTicketsSold: totalTicketsSold.toString(),
            firstPlacePrizePerTicket: ethers.formatUnits(
              firstPlacePrizePerTicket,
              6,
            ),
            secondPlacePrizePerTicket: ethers.formatUnits(
              secondPlacePrizePerTicket,
              6,
            ),
            transactionHash: event.log.transactionHash,
          });
        } catch (error) {
          console.error('Failed to update lottery end data:', error);
        }
      },
    );

    // Handle contract errors using try-catch in the event handlers
    process.on('unhandledRejection', (error: Error) => {
      console.error('❌ Unhandled Contract Error:', error);
    });
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
      console.error(`Error fetching past ${eventName} events:`, error);
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
      console.error(`Error fetching lottery info for ID ${lotteryId}:`, error);
      throw error;
    }
  }
}
