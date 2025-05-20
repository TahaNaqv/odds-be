import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ReferralService } from '../referral/referral.service';
import { generateReferralCode } from '../utils/referral';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const referralService = app.get(ReferralService);

  const platformCodes = Array.from({ length: 1 }, () => generateReferralCode());

  try {
    await referralService.createPlatformReferralCodes(platformCodes);
    console.log('Platform referral codes created successfully:');
    console.log(platformCodes);
  } catch (error) {
    console.error('Error creating platform referral codes:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
