import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RaffleService } from './raffle.service';
import { PurchaseTicketDto } from './dto/purchase-ticket.dto';
import { AutoEnrollDto } from './dto/auto-enroll.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('raffles')
export class RaffleController {
  constructor(private readonly raffleService: RaffleService) {}

  @Get('current')
  async getCurrentRaffle() {
    return this.raffleService.getCurrentRaffle();
  }

  @Get('active')
  async getActiveRaffles() {
    const raffles = await this.raffleService.getActiveRaffles();
    return {
      count: raffles.length,
      raffles,
    };
  }

  @Get('past')
  async getPastRaffles(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.raffleService.getPastRaffles(page, limit);
  }

  @Get(':id')
  async getRaffleById(@Param('id') id: string) {
    return this.raffleService.getRaffleById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/purchase')
  async purchaseTicket(
    @Param('id') id: string,
    @Body() purchaseTicketDto: PurchaseTicketDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const raffleId = parseInt(id);

    return this.raffleService.purchaseTicket(
      userId,
      raffleId,
      purchaseTicketDto.ticketCount,
      purchaseTicketDto.autoEntry,
      purchaseTicketDto.referralCode,
      purchaseTicketDto.walletAddress,
    );
  }

  @Get('user/:walletAddress/activity')
  async getUserActivity(
    @Param('walletAddress') walletAddress: string,
  ): Promise<any[]> {
    return this.raffleService.getUserActivity(walletAddress);
  }

  @Get('user/:walletAddress/activity/stats')
  async getUserActivityStats(@Param('walletAddress') walletAddress: string) {
    return this.raffleService.getUserActivityStats(walletAddress);
  }

  @Get(':id/tickets')
  async getRaffleTickets(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.raffleService.getRaffleTickets(id, page, limit);
  }

  @Get(':id/winner')
  async getRaffleWinner(@Param('id') id: string) {
    return this.raffleService.getRaffleWinner(id);
  }
}
