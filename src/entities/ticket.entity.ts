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
import { ReferralCode } from './referral-code.entity';

export enum TicketGroup {
  GROUP_1 = 1, // 2x return
  GROUP_2 = 2, // 1x return
  GROUP_3 = 3, // no return
}

@Entity()
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  ticketNumber: number;

  @Column({
    type: 'enum',
    enum: TicketGroup,
    nullable: true,
  })
  groupNumber: TicketGroup;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  prizeAmount: number;

  @Column({ default: false })
  isDistributed: boolean;

  @Column({ nullable: true })
  transactionHash: string;

  @ManyToOne(() => User, (user) => user.tickets)
  owner: User;

  @ManyToOne(() => Raffle, (raffle) => raffle.tickets)
  raffle: Raffle;

  @ManyToOne(() => ReferralCode, (referralCode) => referralCode.tickets, {
    nullable: true,
  })
  referralCode: ReferralCode;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
