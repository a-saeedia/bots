import { Controller, Post, Body, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { BaleService } from './bale.service';
import { QuizService } from '../quiz/quiz.service';
import { Inject } from '@nestjs/common';

@ApiTags('Bale Webhook')
@Controller('webhook')
export class BaleController {
  private readonly logger = new Logger(BaleController.name);

  constructor(
    private readonly baleService: BaleService,
    @Inject('BALE_QUIZ_SERVICE')
    private readonly quizService: QuizService,
  ) {}

  @Post('bale')
  @ApiOperation({ summary: 'Bale messenger webhook endpoint' })
  @ApiOkResponse({ description: 'Update processed' })
  async handleWebhook(@Body() update: any): Promise<{ ok: boolean }> {
    try {
      if (update.message) {
        await this.handleMessage(update.message);
      }
      if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } catch (error) {
      this.logger.error(`Bale webhook error: ${error}`);
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

    this.logger.log(`[Bale] Message from ${userId} (${username}): ${text.substring(0, 50)}`);

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

    await this.quizService.handleTextInput(userId, chatId, text, message.message_id);
  }

  private async handleCallbackQuery(query: any): Promise<void> {
    const userId = query.from.id;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const callbackData = query.data;
    const queryId = query.id;

    this.logger.log(`[Bale] Callback from ${userId}: ${callbackData}`);

    await this.baleService.answerCallbackQuery(queryId);
    await this.quizService.handleCallback(userId, chatId, messageId, callbackData, queryId);
  }
}
