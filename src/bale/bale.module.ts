import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BaleService } from './bale.service';
import { BaleController } from './bale.controller';
import { QuizService } from '../quiz/quiz.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { SheetsModule } from '../sheets/sheets.module';
import { SheetsService } from '../sheets/sheets.service';

@Module({
  imports: [ConfigModule, PrismaModule, SheetsModule],
  controllers: [BaleController],
  providers: [
    BaleService,
    {
      provide: 'BALE_QUIZ_SERVICE',
      useFactory: (prisma: PrismaService, baleService: BaleService, sheetsService: SheetsService) => {
        return new QuizService(prisma, baleService, sheetsService);
      },
      inject: [PrismaService, BaleService, SheetsService],
    },
  ],
  exports: [BaleService],
})
export class BaleModule {}
