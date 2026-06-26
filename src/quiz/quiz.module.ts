import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { SheetsModule } from '../sheets/sheets.module';

@Module({
  imports: [SheetsModule],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
