import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TelegramModule } from './telegram/telegram.module';
import { BaleModule } from './bale/bale.module';
import { AdminModule } from './admin/admin.module';
import { WebappModule } from './webapp/webapp.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TelegramModule,
    BaleModule,
    AdminModule,
    WebappModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
