import { IsString, IsDate, IsNumber } from 'class-validator';

export class AutoEnrollDto {
  @IsString()
  walletAddress: string;

  @IsDate()
  endDate: Date;

  @IsNumber()
  ticketCount: number;

  @IsString()
  token: string; // USDC or USDT
} 