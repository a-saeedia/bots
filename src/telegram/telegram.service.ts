import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import FormData = require('form-data');
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private api: AxiosInstance | null = null;
  private botToken: string | null = null;
  private channelId: string | null = null;

  /** Subclasses can override these for different platforms (e.g. Bale) */
  protected readonly apiBaseUrl: string = 'https://api.telegram.org';
  protected readonly tokenEnvKey: string = 'TELEGRAM_BOT_TOKEN';
  protected readonly channelEnvKey: string = 'TELEGRAM_CHANNEL_ID';
  protected readonly defaultChannel: string = '@ecobori';
  protected readonly channelLinkPrefix: string = 'https://t.me/';
  protected readonly requireChannelJoin: boolean = true;

  constructor(protected readonly configService: ConfigService) {}

  private getApi(): AxiosInstance {
    if (!this.api) {
      this.botToken = this.configService.get<string>(this.tokenEnvKey) ?? '';
      this.channelId = this.configService.get<string>(this.channelEnvKey) ?? this.defaultChannel;
      this.api = axios.create({
        baseURL: `${this.apiBaseUrl}/bot${this.botToken}`,
        timeout: 10000,
      });
    }
    return this.api;
  }

  getChannelId(): string {
    if (!this.channelId) {
      this.channelId = this.configService.get<string>(this.channelEnvKey) ?? this.defaultChannel;
    }
    return this.channelId;
  }

  getChannelLink(): string {
    const ch = this.getChannelId();
    return `${this.channelLinkPrefix}${ch.replace('@', '')}`;
  }

  shouldRequireChannelJoin(): boolean {
    return this.requireChannelJoin;
  }

  getPlatform(): string {
    return 'telegram';
  }

  async checkMembership(userId: number): Promise<boolean> {
    try {
      const response = await this.getApi().get('/getChatMember', {
        params: { chat_id: this.getChannelId(), user_id: userId },
      });
      if (response.data.ok) {
        return ['member', 'administrator', 'creator'].includes(response.data.result.status);
      }
      return false;
    } catch (error) {
      this.logger.warn(`Membership check failed for user ${userId}: ${error}`);
      // If API fails (bot not admin in channel), let user through
      return true;
    }
  }

  async sendMessage(chatId: number, text: string, replyMarkup?: any, replyToMessageId?: number): Promise<any> {
    try {
      const body: any = {
        chat_id: chatId,
        text,
        reply_markup: replyMarkup,
        parse_mode: 'HTML',
      };
      if (replyToMessageId) body.reply_parameters = { message_id: replyToMessageId };
      const response = await this.getApi().post('/sendMessage', body);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to send message to ${chatId}: ${error}`);
    }
  }

  async editMessage(chatId: number, messageId: number, text: string, replyMarkup?: any): Promise<any> {
    try {
      const response = await this.getApi().post('/editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: replyMarkup,
        parse_mode: 'HTML',
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to edit message: ${error}`);
    }
  }

  async answerCallbackQuery(queryId: string, text?: string, showAlert = false): Promise<void> {
    try {
      await this.getApi().post('/answerCallbackQuery', {
        callback_query_id: queryId,
        text,
        show_alert: showAlert,
      });
    } catch (error) {
      this.logger.error(`Failed to answer callback: ${error}`);
    }
  }

  async setWebhook(url: string, secretToken?: string): Promise<any> {
    try {
      const body: Record<string, string> = { url };
      if (secretToken) body.secret_token = secretToken;
      const response = await this.getApi().post('/setWebhook', body);
      this.logger.log(`Webhook set to ${url}: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to set webhook: ${error}`);
      throw error;
    }
  }

  async getWebhookInfo(): Promise<any> {
    try {
      const response = await this.getApi().get('/getWebhookInfo');
      return response.data.result;
    } catch (error) {
      this.logger.error(`Failed to get webhook info: ${error}`);
      return null;
    }
  }

  async getBotInfo(): Promise<any> {
    try {
      const response = await this.getApi().get('/getMe');
      return response.data.result;
    } catch (error) {
      this.logger.error(`Failed to get bot info: ${error}`);
      return null;
    }
  }

  async sendPhoto(chatId: number, photoPath: string, caption: string, replyMarkup?: any): Promise<any> {
    try {
      const form = new FormData();
      form.append('chat_id', chatId.toString());
      form.append('photo', fs.createReadStream(photoPath));
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
      if (replyMarkup) {
        form.append('reply_markup', JSON.stringify(replyMarkup));
      }

      const token = this.botToken || this.configService.get<string>(this.tokenEnvKey) || '';
      const url = `${this.apiBaseUrl}/bot${token}/sendPhoto`;
      const response = await axios.post(
        url,
        form,
        { headers: form.getHeaders(), timeout: 15000 },
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to send photo to ${chatId}: ${error}`);
    }
  }

  async deleteMessage(chatId: number, messageId: number): Promise<boolean> {
    try {
      await this.getApi().post('/deleteMessage', {
        chat_id: chatId,
        message_id: messageId,
      });
      return true;
    } catch (error) {
      // Message might already be deleted or too old
      return false;
    }
  }

  async deleteMessages(chatId: number, messageIds: number[]): Promise<void> {
    for (const msgId of messageIds) {
      await this.deleteMessage(chatId, msgId);
    }
  }

  getFounderPhotoPath(founder: 'ali' | 'arman'): string {
    const filename = `founder_${founder}.jpg`;
    const paths = [
      path.join(__dirname, 'public', filename),
      path.join(__dirname, '..', 'public', filename),
      path.join(__dirname, '..', '..', 'public', filename),
      path.join(process.cwd(), 'public', filename),
      path.join(process.cwd(), 'app', 'public', filename),
      path.join(process.cwd(), 'app', filename),
    ];
    for (const p of paths) {
      this.logger.debug(`Checking photo path: ${p} => ${fs.existsSync(p)}`);
      if (fs.existsSync(p)) {
        this.logger.log(`Found founder photo at: ${p}`);
        return p;
      }
    }
    this.logger.error(`Founder photo ${filename} NOT FOUND. Searched: ${paths.join(', ')}`);
    return paths[0]; // fallback
  }

  /** @deprecated Use getFounderPhotoPath instead */
  getFoundersPhotoPath(): string {
    return this.getFounderPhotoPath('ali');
  }

  /** Generic image path resolver — searches common deployment paths */
  getImagePath(filename: string): string {
    const paths = [
      path.join(__dirname, 'public', filename),
      path.join(__dirname, '..', 'public', filename),
      path.join(__dirname, '..', '..', 'public', filename),
      path.join(process.cwd(), 'public', filename),
      path.join(process.cwd(), 'app', 'public', filename),
      path.join(process.cwd(), 'app', filename),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        this.logger.log(`Found image at: ${p}`);
        return p;
      }
    }
    this.logger.error(`Image ${filename} NOT FOUND. Searched: ${paths.join(', ')}`);
    return paths[0]; // fallback
  }
}
