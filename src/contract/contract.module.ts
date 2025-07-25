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
      provide: 'HTTP_PROVIDER',
      useFactory: () => {
        console.log('🌐 Creating HTTP provider for contract operations');
        return new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
      },
    },
    {
      provide: 'WS_PROVIDER',
      useFactory: () => {
        const wsUrl = process.env.BASE_SEPOLIA_WSS_URL;
        if (wsUrl) {
          console.log('🔌 Creating WebSocket provider for event listening');
          return new ethers.WebSocketProvider(wsUrl);
        }
        console.log(
          '⚠️ WebSocket URL not provided, using HTTP for events (polling mode)',
        );
        return new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
      },
    },
  ],
  exports: [
    ContractService,
    LotteryListenerService,
    'HTTP_PROVIDER',
    'WS_PROVIDER',
  ],
})
export class ContractModule {}
