import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContractService } from './contract.service';
import { RaffleModule } from '../raffle/raffle.module';
import { ethers } from 'ethers';
import { LotteryListenerService } from './lottery-listener.service';

@Module({
  imports: [ConfigModule, forwardRef(() => RaffleModule)],
  providers: [
    ContractService,
    LotteryListenerService,
    {
      provide: 'ETH_PROVIDER',
      useFactory: () => {
        return new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL); // Infura, Alchemy, or your node
      },
    },
  ],
  exports: [ContractService, LotteryListenerService, 'ETH_PROVIDER'],
})
export class ContractModule {}
