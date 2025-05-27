import {
  Controller,
  Post,
  Headers,
  UnauthorizedException,
  Logger,
  RawBodyRequest,
  Req,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { WebhookService, AlchemyWebhookEvent } from './webhook.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly signingKey: string;

  constructor(
    private webhookService: WebhookService,
    private configService: ConfigService,
  ) {
    this.signingKey =
      this.configService.get<string>('ALCHEMY_SIGNING_KEY') || '';
    if (!this.signingKey) {
      throw new Error('ALCHEMY_SIGNING_KEY is not defined');
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-alchemy-signature') signature: string,
  ): Promise<{ status: string }> {
    try {
      if (!request.rawBody) {
        throw new UnauthorizedException(
          'Raw body is required for signature validation',
        );
      }

      // Validate the webhook signature
      if (!this.validateSignature(request.rawBody.toString(), signature)) {
        this.logger.error('Invalid webhook signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }

      // Parse the raw body as JSON
      const event = JSON.parse(
        request.rawBody.toString(),
      ) as AlchemyWebhookEvent;

      // Process the webhook event
      await this.webhookService.handleWebhookEvent(event);

      return { status: 'success' };
    } catch (error) {
      this.logger.error('Error processing webhook:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private validateSignature(body: string, signature: string): boolean {
    try {
      const hmac = crypto.createHmac('sha256', this.signingKey);
      hmac.update(body, 'utf8');
      const digest = hmac.digest('hex');
      return signature === digest;
    } catch (error) {
      this.logger.error('Error validating signature:', {
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }
}
