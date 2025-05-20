import {
  IsNumber,
  IsString,
  IsOptional,
  IsDate,
  Min,
  Max,
} from 'class-validator';

export class PurchaseTicketDto {
  @IsNumber()
  @Min(1)
  ticketCount: number;

  @IsString()
  referralCode: string;

  @IsNumber()
  @Min(1)
  @Max(10)
  autoEntry: number = 1;

  @IsString()
  token: string = 'USDC';

  @IsString()
  walletAddress: string;
}
