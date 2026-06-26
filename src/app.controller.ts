import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { AppService } from './app.service';
import type { Response } from 'express';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiExcludeEndpoint()
  getLandingPage(@Res() res: Response): void {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(this.appService.getLandingPage());
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  getHealth(): { status: string; service: string } {
    return { status: 'ok', service: 'A | Cap Quiz Bot' };
  }
}
