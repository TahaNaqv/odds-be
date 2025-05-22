import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Ticket } from './ticket.entity';

@Entity()
export class ReferralCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
    transformer: {
      to: (value: string) => value?.toLowerCase(),
      from: (value: string) => value?.toLowerCase(),
    },
  })
  code: string;

  @Column({ default: false })
  isPlatformCode: boolean;

  @Column({ default: 0 })
  totalUses: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalRewards: number;

  @OneToOne(() => User, (user) => user.referralCode)
  @JoinColumn()
  owner: User;

  @OneToMany(() => Ticket, (ticket) => ticket.referralCode)
  tickets: Ticket[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
 