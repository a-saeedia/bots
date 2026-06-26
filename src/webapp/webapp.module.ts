import { Module } from '@nestjs/common';
import { WebappController } from './webapp.controller';
import { WebappService } from './webapp.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SheetsModule } from '../sheets/sheets.module';

@Module({
  imports: [PrismaModule, SheetsModule],
  controllers: [WebappController],
  providers: [WebappService],
})
export class WebappModule {}
