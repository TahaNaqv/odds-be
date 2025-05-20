import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferralCode } from '../entities/referral-code.entity';
import { User } from '../entities/user.entity';
import { generateReferralCode } from '../utils/referral';

@Injectable()
export class ReferralService {
  constructor(
    @InjectRepository(ReferralCode)
    private referralCodeRepository: Repository<ReferralCode>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createPlatformReferralCodes(codes: string[]) {
    for (const code of codes) {
      const existingCode = await this.referralCodeRepository.findOne({
        where: { code },
      });

      if (!existingCode) {
        await this.referralCodeRepository.save({
          code,
          isPlatformCode: true,
        });
      }
    }
  }

  async generateUserReferralCode(user: User): Promise<ReferralCode> {
    // Check if user already has a referral code
    const existingCode = await this.referralCodeRepository.findOne({
      where: { owner: { id: user.id } },
    });

    if (existingCode) {
      return existingCode;
    }

    // Generate a unique referral code
    let code = generateReferralCode();
    let isUnique = false;

    while (!isUnique) {
      const existingCode = await this.referralCodeRepository.findOne({
        where: { code },
      });
      if (!existingCode) {
        isUnique = true;
      } else {
        code = generateReferralCode();
      }
    }

    // Create and save the referral code
    const referralCode = this.referralCodeRepository.create({
      code,
      owner: user,
      isPlatformCode: false,
    });

    return this.referralCodeRepository.save(referralCode);
  }

  async validateReferralCode(code: string): Promise<ReferralCode> {
    const referralCode = await this.referralCodeRepository.findOne({
      where: { code },
      relations: ['owner'],
    });

    if (!referralCode) {
      throw new BadRequestException('Invalid referral code');
    }

    return referralCode;
  }

  async recordReferralUse(referralCode: ReferralCode, rewardAmount: number) {
    referralCode.totalUses += 1;
    referralCode.totalRewards = Number(
      (Number(referralCode.totalRewards) + rewardAmount).toFixed(2),
    );
    await this.referralCodeRepository.save(referralCode);
  }

  async getUserReferralCode(userId: number): Promise<ReferralCode | null> {
    return this.referralCodeRepository.findOne({
      where: { owner: { id: userId } },
    });
  }

  async getPlatformReferralCodes(): Promise<ReferralCode[]> {
    return this.referralCodeRepository.find({
      where: { isPlatformCode: true },
    });
  }
}
