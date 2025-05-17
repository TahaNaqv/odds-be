import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { WalletAuthDto } from './dto/wallet-auth.dto';
import * as ethers from 'ethers';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async validateWallet(walletAuthDto: WalletAuthDto) {
    const { walletAddress, signature, message } = walletAuthDto;

    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Find or create user
    let user = await this.usersRepository.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      user = this.usersRepository.create({
        walletAddress: walletAddress.toLowerCase(),
      });
      await this.usersRepository.save(user);
    }

    // Generate JWT token
    const payload = {
      sub: user.id,
      walletAddress: user.walletAddress,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
      },
    };
  }
}
