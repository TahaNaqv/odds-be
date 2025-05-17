import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';
import { Raffle } from './raffle.entity';

@Entity()
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  ticketNumber: number;

  @Column({ default: false })
  isWinning: boolean;

  @ManyToOne(() => User, (user) => user.tickets)
  owner: User;

  @ManyToOne(() => Raffle, (raffle) => raffle.tickets)
  raffle: Raffle;

  @Column({ nullable: true })
  purchaseTransactionHash: string;

  @Column({ default: false })
  isAutoEnrolled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
