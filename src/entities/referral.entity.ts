import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Referral {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.referrals)
  referrer: User;

  @Column()
  referredWalletAddress: string;

  @Column({ default: 0 })
  pointsEarned: number;

  @Column({ default: false })
  isActive: boolean;

  @Column({ nullable: true })
  lastActivityDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
