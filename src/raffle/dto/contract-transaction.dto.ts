export class ContractTransactionDto {
  to: string;
  data: string;
  value: string;
  from: string;
  chainId: number;
  gas?: string;
}
