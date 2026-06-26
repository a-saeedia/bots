import { Controller, Post, Body, Get, Headers, Logger, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { QuizService } from '../quiz/quiz.service';

@ApiTags('Telegram Webhook')
@Controller('webhook')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly quizService: QuizService,
    private readonly config: ConfigService,
  ) {}

  @Post('telegram')
  @ApiOperation({ summary: 'Telegram webhook endpoint' })
  @ApiOkResponse({ description: 'Update processed' })
  async handleWebhook(
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ): Promise<{ ok: boolean }> {
    // Validate webhook secret to prevent unauthorized requests
    const expectedSecret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (expectedSecret && secretToken !== expectedSecret) {
      this.logger.warn(`Rejected webhook request — invalid secret token`);
      throw new ForbiddenException('Invalid webhook secret');
    }

    try {
      if (update.message) {
        await this.handleMessage(update.message);
      }
      if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } catch (error) {
      this.logger.error(`Webhook error: ${error}`);
    }
    return { ok: true };
  }

  // Info endpoint removed for security

  private async handleMessage(message: any): Promise<void> {
    const userId = message.from.id;
    const chatId = message.chat.id;
    const text = message.text || '';
    const firstName = message.from.first_name || '';
    const lastName = message.from.last_name || '';
    const username = message.from.username || '';

    this.logger.log(`Message from ${userId} (${username}): ${text.substring(0, 50)}`);

    // Handle contact sharing
    if (message.contact) {
      await this.quizService.handleContactShare(userId, chatId, message.contact.phone_number);
      return;
    }

    if (text === '/start' || text.startsWith('/start')) {
      const startPayload = text.split(' ')[1] || undefined;
      await this.quizService.handleStart(userId, chatId, firstName, lastName, username, startPayload);
      return;
    }

    // Handle text input for contact info collection
    await this.quizService.handleTextInput(userId, chatId, text, message.message_id);
  }

  private async handleCallbackQuery(query: any): Promise<void> {
    const userId = query.from.id;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const callbackData = query.data;
    const queryId = query.id;

    this.logger.log(`Callback from ${userId}: ${callbackData}`);

    await this.telegramService.answerCallbackQuery(queryId);
    await this.quizService.handleCallback(userId, chatId, messageId, callbackData, queryId);
  }
}
