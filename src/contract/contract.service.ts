import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { OddsLottery } from './utils/OddsLottery';
import { OddsLottery__factory } from './utils/OddsLottery__factory';
import { ContractTransactionDto } from '../raffle/dto/contract-transaction.dto';
import { RaffleService } from '../raffle/raffle.service';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);
  private readonly provider: ethers.Provider;
  private readonly wallet: ethers.Wallet;
  private readonly contract: OddsLottery;
  private readonly GAS_BUFFER_PERCENTAGE = 20; // 20% buffer for gas estimation
  private readonly MAX_TICKETS = 10000; // Match the contract's MAX_TICKETS constant
  private readonly TICKET_PRICE = 1e6; // 1 USDC per ticket

  // Custom error selectors
  private readonly ERROR_SELECTORS = {
    '0xe7cf0886': 'InvalidMaxTickets',
    '0x2d4ba93a': 'InvalidLotteryId',
    '0x646cf558': 'LotteryIdExists',
    '0x5cd83192': 'InsufficientBalance',
    '0x13be252b': 'InsufficientAllowance',
    '0x66f3ef9b': 'LotteryNotActive',
    '0x8c2a993e': 'LotteryAlreadyDrawn',
    '0x9c2a993e': 'NoTickets',
    '0x7c2a993e': 'InsufficientContractBalance',
    '0x6c2a993e': 'LotteryDoesNotExist',
  };

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => RaffleService))
    private raffleService: RaffleService,
    @Inject('HTTP_PROVIDER')
    provider: ethers.JsonRpcProvider,
  ) {
    // Use the HTTP provider for all contract operations
    this.provider = provider;
    this.logger.log('🌐 ContractService initialized with HTTP provider');

    const privateKey = this.configService.get<string>('PRIVATE_KEY');
    if (!privateKey) {
      throw new Error('PRIVATE_KEY is not defined');
    }

    // Remove '0x' prefix if present and validate format
    const cleanPrivateKey = privateKey.replace('0x', '');
    if (!/^[0-9a-fA-F]{64}$/.test(cleanPrivateKey)) {
      throw new Error('PRIVATE_KEY must be a 64-character hexadecimal string');
    }

    this.wallet = new ethers.Wallet(cleanPrivateKey, this.provider);

    // Initialize contract
    const contractAddress = this.configService.get<string>(
      'LOTTERY_CONTRACT_ADDRESS',
    );
    if (!contractAddress) {
      throw new Error('LOTTERY_CONTRACT_ADDRESS is not defined');
    }
    this.contract = OddsLottery__factory.connect(contractAddress, this.wallet);
  }

  private decodeCustomError(error: any): string {
    if (error.data && typeof error.data === 'string') {
      const selector = error.data.slice(0, 10);
      const errorName = this.ERROR_SELECTORS[selector];
      if (errorName) {
        return `${errorName}()`;
      }
    }
    return 'Unknown custom error';
  }

  private async estimateGasWithBuffer(
    transaction: ethers.TransactionRequest,
    from: string,
  ): Promise<bigint> {
    try {
      const gasEstimate = await this.provider.estimateGas({
        ...transaction,
        from,
      });

      // Add buffer to the gas estimate
      return (
        (gasEstimate * BigInt(100 + this.GAS_BUFFER_PERCENTAGE)) / BigInt(100)
      );
    } catch (error) {
      this.logger.error('Gas estimation failed:', error);
      // Return a default gas limit if estimation fails
      return BigInt(500000);
    }
  }

  async createUnsignedBuyTicketsTx(
    walletAddress: string,
    lotteryIds: number[],
    count: number,
  ): Promise<{
    approveTx: ContractTransactionDto;
    buyTx: ContractTransactionDto;
  }> {
    try {
      if (lotteryIds.length === 0 || count === 0) {
        throw new Error('Invalid lottery input');
      }

      // Check if lotteries exist before proceeding
      for (const lotteryId of lotteryIds) {
        const lottery = await this.contract.getLottery(lotteryId);
        if (!lottery || lottery.id.toString() === '0') {
          throw new Error(`Lottery with ID ${lotteryId} does not exist`);
        }
      }

      // Get the contract address
      const contractAddress = await this.contract.getAddress();
      const network = await this.provider.getNetwork();

      // Create the buy tickets transaction data
      const buyTicketsData = this.contract.interface.encodeFunctionData(
        'buyTickets',
        [lotteryIds, count],
      );

      // Get the USDC contract address
      const usdcAddress = await this.contract.usdc();

      // Create the USDC contract instance
      const usdcContract = new ethers.Contract(
        usdcAddress,
        [
          'function approve(address spender, uint256 amount) public returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)',
        ],
        this.provider,
      );

      // Calculate approval amount
      const approvalAmount = count * lotteryIds.length * this.TICKET_PRICE;

      // Log the values for debugging
      this.logger.debug({
        approvalAmount,
        lotteryIds,
        count,
        ticketPrice: this.TICKET_PRICE,
      });

      const approvalData = usdcContract.interface.encodeFunctionData(
        'approve',
        [contractAddress, approvalAmount],
      );

      return {
        approveTx: {
          to: usdcAddress,
          data: approvalData,
          value: '0',
          from: walletAddress,
          chainId: Number(network.chainId),
          gas: '0',
        },
        buyTx: {
          to: contractAddress,
          data: buyTicketsData,
          value: '0',
          from: walletAddress,
          chainId: Number(network.chainId),
          gas: '0',
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to create unsigned transaction for lottery ${lotteryIds}:`,
        error,
      );
      throw error;
    }
  }

  async createLottery(raffleId: number, maxTickets: number): Promise<string> {
    try {
      this.logger.debug(
        `Creating lottery with raffleId=${raffleId}, maxTickets=${maxTickets}`,
      );

      // Check if the wallet is the contract owner
      const owner = await this.contract.owner();
      this.logger.debug(
        `Contract owner: ${owner}, Wallet address: ${this.wallet.address}`,
      );

      if (owner.toLowerCase() !== this.wallet.address.toLowerCase()) {
        throw new Error(
          `Wallet ${this.wallet.address} is not the contract owner. Current owner is ${owner}`,
        );
      }

      // Validate inputs before sending transaction
      if (maxTickets === 0 || maxTickets > this.MAX_TICKETS) {
        throw new Error(
          `Invalid maxTickets: must be between 1 and ${this.MAX_TICKETS}`,
        );
      }
      if (raffleId === 0) {
        throw new Error('Invalid raffleId: must be greater than 0');
      }

      // Check if lottery already exists
      try {
        const existingLottery = await this.contract.getLottery(raffleId);
        if (existingLottery && existingLottery.id.toString() !== '0') {
          throw new Error(`Lottery with ID ${raffleId} already exists`);
        }
      } catch (error) {
        // If getLottery fails, it might mean the lottery doesn't exist yet
        this.logger.debug(`No existing lottery found for ID ${raffleId}`);
      }

      const tx = await this.contract.createLottery(raffleId, maxTickets);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }
      this.logger.log(
        `Created lottery for raffle ${raffleId} in transaction ${receipt.hash}`,
      );
      return receipt.hash;
    } catch (error) {
      const decodedError = this.decodeCustomError(error);
      this.logger.error(
        `Failed to create lottery for raffle ${raffleId}: ${decodedError}`,
        error,
      );
      throw new Error(`Failed to create lottery: ${decodedError}`);
    }
  }

  async getLottery(raffleId: number) {
    try {
      const lottery = await this.contract.getLottery(raffleId);
      if (!lottery) {
        throw new Error(`Lottery with ID ${raffleId} not found`);
      }
      return lottery;
    } catch (error) {
      if (error.code === 'BAD_DATA') {
        this.logger.debug(
          `Lottery with ID ${raffleId} not found or invalid data`,
        );
        return null;
      }
      this.logger.error(`Failed to get lottery for raffle ${raffleId}:`, error);
      throw error;
    }
  }

  async endLottery(raffleId: number): Promise<string> {
    try {
      this.logger.debug(`Ending lottery with raffleId=${raffleId}`);

      // Check if the wallet is the contract owner
      const owner = await this.contract.owner();
      if (owner.toLowerCase() !== this.wallet.address.toLowerCase()) {
        throw new Error(
          `Wallet ${this.wallet.address} is not the contract owner. Current owner is ${owner}`,
        );
      }

      // Check if lottery exists and is in a valid state
      const lottery = await this.contract.getLottery(raffleId);
      if (!lottery || lottery.id.toString() === '0') {
        throw new Error(`Lottery with ID ${raffleId} does not exist`);
      }

      if (!lottery.isActive) {
        throw new Error(`Lottery with ID ${raffleId} is not active`);
      }

      if (lottery.isDrawn) {
        throw new Error(`Lottery with ID ${raffleId} has already been drawn`);
      }

      // Send the transaction
      const tx = await this.contract.endLottery(raffleId);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      this.logger.log(
        `Ended lottery for raffle ${raffleId} in transaction ${receipt.hash}`,
      );

      // Parse the LotteryEnded event from the receipt
      const lotteryEndedEvent = receipt.logs
        .filter(
          (log): log is ethers.EventLog =>
            log instanceof ethers.EventLog &&
            log.fragment?.name === 'LotteryEnded',
        )
        .map((log) => log.args)[0];

      if (lotteryEndedEvent) {
        this.logger.debug('Lottery ended event details:', {
          winningTicketIds: lotteryEndedEvent.winningTicketIds,
          secondPlaceTicketIds: lotteryEndedEvent.secondPlaceTicketIds,
          prizePool: lotteryEndedEvent.prizePool,
          platformCut: lotteryEndedEvent.platformCut,
          distributedPool: lotteryEndedEvent.distributedPool,
          totalTicketsSold: lotteryEndedEvent.totalTicketsSold,
          firstPlacePrizePerTicket: lotteryEndedEvent.firstPlacePrizePerTicket,
          secondPlacePrizePerTicket:
            lotteryEndedEvent.secondPlacePrizePerTicket,
        });
      }

      return receipt.hash;
    } catch (error) {
      const decodedError = this.decodeCustomError(error);
      this.logger.error(
        `Failed to end lottery for raffle ${raffleId}: ${decodedError}`,
        error,
      );
      throw new Error(`Failed to end lottery: ${decodedError}`);
    }
  }
}
