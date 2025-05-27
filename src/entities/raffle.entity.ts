import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Ticket } from './ticket.entity';

export enum RaffleStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

@Entity()
export class Raffle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({ default: 1000 })
  maxTickets: number;

  @Column()
  totalTickets: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 1 })
  ticketPrice: number;

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  @Column({
    type: 'enum',
    enum: RaffleStatus,
    default: RaffleStatus.PENDING,
  })
  status: RaffleStatus;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  totalPrizeAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  platformFee: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  referralRewards: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  distributedAmount: number;

  @Column({ default: false })
  isDistributed: boolean;

  @Column({ nullable: true })
  winnerId: number;

  @Column({ nullable: true })
  winningTicketId: number;

  @Column({ nullable: true })
  transactionHash: string;

  @Column({ default: false })
  isCreated: boolean;

  @OneToMany(() => Ticket, (ticket) => ticket.raffle)
  tickets: Ticket[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
