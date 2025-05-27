import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketGroup } from '../entities/ticket.entity';
import { User } from '../entities/user.entity';
import { Raffle } from '../entities/raffle.entity';
import { ReferralCode } from '../entities/referral-code.entity';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private ticketRepository: Repository<Ticket>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Raffle)
    private raffleRepository: Repository<Raffle>,
    @InjectRepository(ReferralCode)
    private referralCodeRepository: Repository<ReferralCode>,
  ) {}

  async create(
    userId: number,
    raffleId: number,
    referralCodeId?: number,
  ): Promise<Ticket> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const raffle = await this.raffleRepository.findOne({
      where: { id: raffleId },
    });
    if (!raffle) {
      throw new NotFoundException(`Raffle with ID ${raffleId} not found`);
    }

    let referralCode: ReferralCode | null = null;
    if (referralCodeId) {
      referralCode = await this.referralCodeRepository.findOne({
        where: { id: referralCodeId },
      });
      if (!referralCode) {
        throw new NotFoundException(
          `Referral code with ID ${referralCodeId} not found`,
        );
      }
    }

    // Determine ticket group based on some logic (you can modify this)
    const ticketGroup = this.determineTicketGroup();

    const ticket = this.ticketRepository.create({
      owner: user,
      raffle,
      referralCode: referralCode || undefined,
      groupNumber: ticketGroup,
    });

    return this.ticketRepository.save(ticket);
  }

  async findAll(): Promise<Ticket[]> {
    return this.ticketRepository.find({
      relations: ['user', 'raffle', 'referralCode'],
    });
  }

  async findOne(id: number): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: ['user', 'raffle', 'referralCode'],
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    return ticket;
  }

  async findByUser(userId: number): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: { owner: { id: userId } },
      relations: ['raffle', 'referralCode'],
    });
  }

  async findByRaffle(raffleId: number): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: { raffle: { id: raffleId } },
      relations: ['user', 'referralCode'],
    });
  }

  async update(id: number, updateData: Partial<Ticket>): Promise<Ticket> {
    const ticket = await this.findOne(id);
    Object.assign(ticket, updateData);
    return this.ticketRepository.save(ticket);
  }

  async remove(id: number): Promise<void> {
    const ticket = await this.findOne(id);
    await this.ticketRepository.remove(ticket);
  }

  private determineTicketGroup(): TicketGroup {
    // Simple random distribution for now
    const random = Math.random();
    if (random < 0.1) return TicketGroup.GROUP_1; // 10% chance for 2x return
    if (random < 0.4) return TicketGroup.GROUP_2; // 30% chance for 1x return
    return TicketGroup.GROUP_3; // 60% chance for no return
  }
}
