import { Controller, Get, Query } from '@nestjs/common';
import { ReferralService } from './referral.service';

@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('leaderboard')
  async getLeaderboard(
    @Query('sortBy') sortBy: 'referees' | 'earnings' = 'earnings',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    return this.referralService.getLeaderboard(sortBy, order);
  }

  @Get('user-stats')
  async getUserReferralStats(@Query('wallet') wallet: string) {
    return this.referralService.getUserReferralStats(wallet);
  }
}
