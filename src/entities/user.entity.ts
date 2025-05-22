import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { ReferralCode } from './referral-code.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
    transformer: {
      to: (value: string) => value?.toLowerCase(),
      from: (value: string) => value?.toLowerCase(),
    },
  })
  walletAddress: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: 0 })
  totalTicketsPurchased: number;

  @Column({ default: 0 })
  totalRafflesWon: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  totalPrizeWon: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  totalReferralEarnings: number;

  @Column({ default: 0 })
  referralPoints: number;

  @OneToMany(() => Ticket, (ticket) => ticket.owner)
  tickets: Ticket[];

  @OneToOne(() => ReferralCode, (referralCode) => referralCode.owner)
  referralCode: ReferralCode;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
 