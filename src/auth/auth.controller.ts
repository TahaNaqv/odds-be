import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { WalletAuthDto } from './dto/wallet-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wallet')
  async walletAuth(@Body() walletAuthDto: WalletAuthDto) {
    return this.authService.validateWallet(walletAuthDto);
  }
}
