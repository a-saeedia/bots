import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { WebappService } from './webapp.service';
import type { Response } from 'express';

@ApiExcludeController()
@Controller('webapp')
export class WebappController {
  constructor(private readonly webappService: WebappService) {}

  @Get()
  async getWebapp(@Query('page') page: string, @Query('uid') uid: string, @Query('platform') platform: string, @Res() res: Response): Promise<void> {
    const html = await this.webappService.renderApp(page || 'home', uid, platform || 'telegram');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(html);
  }

  @Get('api/user')
  async getUserData(@Query('uid') uid: string, @Query('platform') platform: string) {
    return this.webappService.getUserData(uid, platform || 'telegram');
  }

  @Get('api/leaderboard')
  async getLeaderboard() {
    return this.webappService.getLeaderboardData();
  }
}
