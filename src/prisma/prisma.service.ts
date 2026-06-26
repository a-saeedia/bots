import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function appendDbParams(url: string, params: Record<string, string>): string {
  const separator = url.includes('?') ? '&' : '?';
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return `${url}${separator}${query}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: ['error', 'warn'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
            ? appendDbParams(process.env.DATABASE_URL, {
                connection_limit: '5',
                pool_timeout: '20',
              })
            : undefined,
        },
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.error('Database connection failed', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Ensure DB connection is alive — call before critical operations */
  async ensureConnection(): Promise<void> {
    try {
      await this.$queryRawUnsafe('SELECT 1');
    } catch {
      this.logger.warn('DB connection stale, reconnecting...');
      await this.$disconnect();
      await this.$connect();
    }
  }
}
