import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Raffle } from './raffle.entity';
import { Ticket } from './ticket.entity';
import { Referral } from './referral.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  walletAddress: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: 0 })
  totalTicketsPurchased: number;

  @Column({ default: 0 })
  totalRafflesWon: number;

  @Column({ default: 0 })
  referralPoints: number;

  @OneToMany(() => Raffle, (raffle) => raffle.creator)
  createdRaffles: Raffle[];

  @OneToMany(() => Ticket, (ticket) => ticket.owner)
  tickets: Ticket[];

  @OneToMany(() => Referral, (referral) => referral.referrer)
  referrals: Referral[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
