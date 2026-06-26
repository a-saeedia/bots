import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { QuizService } from '../quiz/quiz.service';
import { SheetsModule } from '../sheets/sheets.module';

@Module({
  imports: [SheetsModule],
  controllers: [TelegramController],
  providers: [TelegramService, QuizService],
  exports: [TelegramService],
})
export class TelegramModule {}
