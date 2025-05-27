import { ethers } from 'ethers';
import { Logger } from '@nestjs/common';
import { OddsLottery__factory } from '../src/contract/utils/OddsLottery__factory';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const logger = new Logger('EndLotteryTest');

  try {
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(
      process.env.BASE_SEPOLIA_RPC_URL,
    );
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY is not defined in .env file');
    }
    const wallet = new ethers.Wallet(privateKey, provider);

    // Initialize contract
    const contractAddress = process.env.LOTTERY_CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error('LOTTERY_CONTRACT_ADDRESS is not defined in .env file');
    }
    const contract = OddsLottery__factory.connect(contractAddress, wallet);

    // Get USDC contract address from lottery contract
    const usdcAddress = await contract.usdc();
    logger.log(`USDC contract address: ${usdcAddress}`);

    // Initialize USDC contract
    const usdcAbi = [
      'function approve(address spender, uint256 amount) external returns (bool)',
      'function balanceOf(address account) external view returns (uint256)',
      'function allowance(address owner, address spender) external view returns (uint256)',
    ];
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, wallet);

    // Test lottery ID - use timestamp to ensure uniqueness
    const testLotteryId = Math.floor(Date.now() / 1000); // Use current timestamp as ID
    const maxTickets = 100;

    logger.log('Starting endLottery test...');

    // Step 1: Create a new lottery
    logger.log(`Creating lottery with ID ${testLotteryId}...`);
    const createTx = await contract.createLottery(testLotteryId, maxTickets);
    const createReceipt = await createTx.wait();
    if (!createReceipt) {
      throw new Error('Failed to get create transaction receipt');
    }
    logger.log(`Lottery created with transaction: ${createReceipt.hash}`);

    // Step 2: Verify lottery was created
    const lottery = await contract.getLottery(testLotteryId);
    logger.log('Lottery details:', {
      id: lottery.id.toString(),
      maxTickets: lottery.maxTickets.toString(),
      ticketsSold: lottery.ticketsSold.toString(),
      isActive: lottery.isActive,
      isDrawn: lottery.isDrawn,
    });

    // Step 3: Check USDC balance and approve if needed
    const ticketPrice = await contract.TICKET_PRICE();
    const totalCost = ticketPrice * BigInt(3); // 3 tickets

    // Check USDC balance
    const balance = await usdcContract.balanceOf(wallet.address);
    logger.log(`USDC balance: ${balance} wei`);
    if (balance < totalCost) {
      throw new Error(
        `Insufficient USDC balance. Required: ${totalCost} wei, Have: ${balance} wei`,
      );
    }

    // Check current allowance
    const currentAllowance = await usdcContract.allowance(
      wallet.address,
      contractAddress,
    );
    logger.log(`Current USDC allowance: ${currentAllowance} wei`);

    if (currentAllowance < totalCost) {
      logger.log(`Approving USDC for lottery contract: ${totalCost} wei`);
      const approveTx = await usdcContract.approve(contractAddress, totalCost);
      const approveReceipt = await approveTx.wait();
      if (!approveReceipt) {
        throw new Error('Failed to get approve transaction receipt');
      }
      logger.log(`USDC approved with transaction: ${approveReceipt.hash}`);

      // Verify new allowance
      const newAllowance = await usdcContract.allowance(
        wallet.address,
        contractAddress,
      );
      logger.log(`New USDC allowance: ${newAllowance} wei`);
      if (newAllowance < totalCost) {
        throw new Error(
          `Approval failed. Required: ${totalCost} wei, Approved: ${newAllowance} wei`,
        );
      }
    }

    // Step 4: Buy minimum required tickets (3)
    logger.log('Buying minimum required tickets...');
    const buyTx = await contract.buyTickets([testLotteryId], 3);
    const buyReceipt = await buyTx.wait();
    if (!buyReceipt) {
      throw new Error('Failed to get buy tickets transaction receipt');
    }
    logger.log(`Tickets purchased with transaction: ${buyReceipt.hash}`);

    // Step 5: Verify lottery state before ending
    const lotteryBeforeEnd = await contract.getLottery(testLotteryId);
    logger.log('Lottery state before ending:', {
      id: lotteryBeforeEnd.id.toString(),
      maxTickets: lotteryBeforeEnd.maxTickets.toString(),
      ticketsSold: lotteryBeforeEnd.ticketsSold.toString(),
      isActive: lotteryBeforeEnd.isActive,
      isDrawn: lotteryBeforeEnd.isDrawn,
    });

    // Check contract's USDC balance for prize pool
    const contractBalance = await usdcContract.balanceOf(contractAddress);
    const prizePool = lotteryBeforeEnd.ticketsSold * ticketPrice;
    logger.log(`Contract USDC balance: ${contractBalance} wei`);
    logger.log(`Required prize pool: ${prizePool} wei`);

    if (contractBalance < prizePool) {
      throw new Error(
        `Insufficient contract balance for prize pool. Required: ${prizePool} wei, Have: ${contractBalance} wei`,
      );
    }

    // Step 6: Try to end the lottery
    logger.log('Attempting to end lottery...');
    const endTx = await contract.endLottery(testLotteryId);
    const endReceipt = await endTx.wait();
    if (!endReceipt) {
      throw new Error('Failed to get end transaction receipt');
    }
    logger.log(`Lottery ended with transaction: ${endReceipt.hash}`);

    // Step 7: Verify lottery was ended
    const endedLottery = await contract.getLottery(testLotteryId);
    logger.log('Ended lottery details:', {
      id: endedLottery.id.toString(),
      maxTickets: endedLottery.maxTickets.toString(),
      ticketsSold: endedLottery.ticketsSold.toString(),
      isActive: endedLottery.isActive,
      isDrawn: endedLottery.isDrawn,
    });

    // Verify the lottery was properly ended
    if (endedLottery.isActive) {
      throw new Error('Lottery is still active after ending');
    }
    if (!endedLottery.isDrawn) {
      throw new Error('Lottery was not marked as drawn after ending');
    }

    // Parse the LotteryEnded event from the receipt
    const lotteryEndedEvent = endReceipt.logs
      .filter(
        (log): log is ethers.EventLog =>
          log instanceof ethers.EventLog &&
          log.fragment?.name === 'LotteryEnded',
      )
      .map((log) => log.args)[0];

    if (lotteryEndedEvent) {
      logger.log('Lottery ended event details:', {
        winningTicketIds: lotteryEndedEvent.winningTicketIds,
        secondPlaceTicketIds: lotteryEndedEvent.secondPlaceTicketIds,
        prizePool: lotteryEndedEvent.prizePool,
        platformCut: lotteryEndedEvent.platformCut,
        distributedPool: lotteryEndedEvent.distributedPool,
        totalTicketsSold: lotteryEndedEvent.totalTicketsSold,
        firstPlacePrizePerTicket: lotteryEndedEvent.firstPlacePrizePerTicket,
        secondPlacePrizePerTicket: lotteryEndedEvent.secondPlacePrizePerTicket,
      });
    }

    logger.log('Test completed successfully!');
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);
