import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class BaleService extends TelegramService {
  protected override readonly apiBaseUrl = 'https://tapi.bale.ai';
  protected override readonly tokenEnvKey = 'BALE_BOT_TOKEN';
  protected override readonly channelEnvKey = 'BALE_CHANNEL_ID';
  protected override readonly defaultChannel = '';
  protected override readonly channelLinkPrefix = 'https://ble.ir/';
  protected override readonly requireChannelJoin = false;

  constructor(configService: ConfigService) {
    super(configService);
  }

  override getPlatform(): string {
    return 'bale';
  }

  /** Bale doesn't support HTML parse_mode — strip all HTML tags */
  override async sendMessage(chatId: number, text: string, replyMarkup?: any, replyToMessageId?: number): Promise<any> {
    return super.sendMessage(chatId, this.stripHtml(text), replyMarkup, replyToMessageId);
  }

  override async editMessage(chatId: number, messageId: number, text: string, replyMarkup?: any): Promise<any> {
    return super.editMessage(chatId, messageId, this.stripHtml(text), replyMarkup);
  }

  override async sendPhoto(chatId: number, photoPath: string, caption: string, replyMarkup?: any): Promise<any> {
    return super.sendPhoto(chatId, photoPath, this.stripHtml(caption), replyMarkup);
  }

  private stripHtml(text: string): string {
    return text
      .replace(/<\/?b>/gi, '')
      .replace(/<\/?i>/gi, '')
      .replace(/<\/?code>/gi, '')
      .replace(/<\/?pre>/gi, '')
      .replace(/<\/?s>/gi, '')
      .replace(/<\/?u>/gi, '')
      .replace(/<\/?a[^>]*>/gi, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
}
