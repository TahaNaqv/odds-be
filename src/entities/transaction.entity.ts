import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Raffle } from './raffle.entity';
import { Ticket } from './ticket.entity';

export enum TransactionType {
  TICKET_PURCHASE = 'TICKET_PURCHASE',
  PRIZE_DISTRIBUTION = 'PRIZE_DISTRIBUTION',
  REFERRAL_REWARD = 'REFERRAL_REWARD',
  PLATFORM_FEE = 'PLATFORM_FEE',
  AUTO_ENROLL = 'AUTO_ENROLL',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  amount: number;

  @Column()
  transactionHash: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    nullable: true,
    transformer: {
      to: (value: string) => value?.toLowerCase(),
      from: (value: string) => value?.toLowerCase(),
    },
  })
  fromAddress: string;

  @Column({
    nullable: true,
    transformer: {
      to: (value: string) => value?.toLowerCase(),
      from: (value: string) => value?.toLowerCase(),
    },
  })
  toAddress: string;

  @ManyToOne(() => Raffle, { nullable: true })
  raffle: Raffle;

  @ManyToOne(() => Ticket, { nullable: true })
  ticket: Ticket;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
