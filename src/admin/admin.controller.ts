import { Controller, Get, Post, Query, Res, UseGuards, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProduces, ApiQuery, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { ConfigService } from '@nestjs/config';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly adminService: AdminService,
    private readonly config: ConfigService,
  ) {}

  /* ───── Login page (no guard) ───── */
  @Get('login')
  @ApiExcludeEndpoint()
  loginPage(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(this.renderLoginPage());
  }

  @Post('login')
  @ApiExcludeEndpoint()
  loginSubmit(@Body() body: { password?: string }, @Res() res: Response) {
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (body.password === password) {
      // Set cookie and redirect to panel
      res.cookie('admin_token', password, {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        maxAge: 24 * 60 * 60 * 1000, // 24h
      });
      res.redirect('/admin/panel');
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(this.renderLoginPage('رمز عبور اشتباه است'));
    }
  }

  @Get('logout')
  @ApiExcludeEndpoint()
  logout(@Res() res: Response) {
    res.clearCookie('admin_token');
    res.redirect('/admin/login');
  }

  /* ───── Admin Panel (protected) ───── */
  @Get('panel')
  @UseGuards(AdminGuard)
  @ApiExcludeEndpoint()
  async panel(@Res() res: Response) {
    const stats = await this.adminService.getUserStats();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(this.renderPanelPage(stats));
  }

  /* ───── JSON endpoints (protected) ───── */
  @Get('users')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get all users (JSON)' })
  @ApiQuery({ name: 'key', required: true, description: 'Admin password' })
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('users/completed')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get users who completed the quiz (JSON)' })
  @ApiQuery({ name: 'key', required: true, description: 'Admin password' })
  async getCompletedUsers() {
    return this.adminService.getCompletedUsers();
  }

  @Get('stats')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get quiz statistics' })
  @ApiQuery({ name: 'key', required: true, description: 'Admin password' })
  async getStats() {
    return this.adminService.getUserStats();
  }

  /* ───── CSV exports (protected) ───── */
  @Get('export/users.csv')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Export all users as CSV' })
  @ApiQuery({ name: 'key', required: true, description: 'Admin password' })
  @ApiProduces('text/csv')
  async exportUsersCsv(@Res() res: Response) {
    const csv = await this.adminService.exportUsersCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=acap_users.csv');
    res.send('\uFEFF' + csv);
  }

  @Get('export/attempts.csv')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Export all quiz attempts as CSV' })
  @ApiQuery({ name: 'key', required: true, description: 'Admin password' })
  @ApiProduces('text/csv')
  async exportAttemptsCsv(@Res() res: Response) {
    const csv = await this.adminService.exportAttemptsCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=acap_attempts.csv');
    res.send('\uFEFF' + csv);
  }

  /* ───── HTML Templates ───── */
  private renderLoginPage(error?: string): string {
    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A | Cap Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif;
      background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-card {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 48px 40px;
      width: 100%;
      max-width: 420px;
      margin: 20px;
      text-align: center;
    }
    .logo { font-size: 2.2em; font-weight: 800; color: #fff; margin-bottom: 8px; letter-spacing: 2px; }
    .subtitle { color: rgba(255,255,255,0.5); font-size: 0.9em; margin-bottom: 36px; }
    .error {
      background: rgba(255,77,77,0.15);
      color: #ff6b6b;
      border: 1px solid rgba(255,77,77,0.3);
      border-radius: 10px;
      padding: 10px 16px;
      margin-bottom: 20px;
      font-size: 0.9em;
    }
    input[type="password"] {
      width: 100%;
      padding: 14px 18px;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px;
      background: rgba(255,255,255,0.08);
      color: #fff;
      font-size: 1em;
      outline: none;
      transition: border-color 0.3s;
      text-align: center;
      letter-spacing: 3px;
    }
    input[type="password"]:focus { border-color: rgba(130,100,255,0.6); }
    input::placeholder { color: rgba(255,255,255,0.3); letter-spacing: 0; }
    .btn {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      font-size: 1.05em;
      font-weight: 600;
      cursor: pointer;
      margin-top: 18px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(102,126,234,0.4); }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="logo">A | CAP</div>
    <div class="subtitle">پنل مدیریت</div>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="POST" action="/admin/login">
      <input type="password" name="password" placeholder="رمز عبور" required autofocus>
      <button type="submit" class="btn">ورود</button>
    </form>
  </div>
</body>
</html>`;
  }

  private renderPanelPage(stats: { total: number; completed: number; byType: any[] }): string {
    const typeLabels: Record<string, string> = {
      capital_protector: 'محافظ سرمایه',
      balanced_investor: 'متعادل',
      growth_investor: 'رشدگرا',
      opportunity_seeker: 'فرصت‌جو',
    };

    const typeRows = stats.byType
      .map((t) => `<div class="type-item"><span class="type-label">${typeLabels[t.investor_type] || t.investor_type || 'N/A'}</span><span class="type-count">${t._count}</span></div>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A | Cap Admin Panel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif;
      background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
      min-height: 100vh;
      color: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 32px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .header-logo { font-size: 1.5em; font-weight: 800; letter-spacing: 2px; }
    .logout-btn {
      color: rgba(255,255,255,0.5);
      text-decoration: none;
      font-size: 0.9em;
      padding: 8px 18px;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px;
      transition: all 0.3s;
    }
    .logout-btn:hover { color: #ff6b6b; border-color: rgba(255,77,77,0.4); }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .stat-card {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 24px;
      text-align: center;
    }
    .stat-value { font-size: 2.8em; font-weight: 800; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .stat-label { color: rgba(255,255,255,0.5); font-size: 0.9em; margin-top: 8px; }
    .section-title {
      font-size: 1.2em;
      font-weight: 600;
      margin-bottom: 16px;
      color: rgba(255,255,255,0.8);
    }
    .types-card {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 40px;
    }
    .type-item {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .type-item:last-child { border-bottom: none; }
    .type-label { color: rgba(255,255,255,0.7); }
    .type-count { font-weight: 700; color: #667eea; }
    .export-section {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 32px;
    }
    .export-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-top: 16px;
    }
    .export-card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      padding: 24px;
      text-align: center;
    }
    .export-icon { font-size: 2.5em; margin-bottom: 12px; }
    .export-title { font-size: 1.1em; font-weight: 600; margin-bottom: 8px; }
    .export-desc { color: rgba(255,255,255,0.4); font-size: 0.85em; margin-bottom: 18px; }
    .export-btn {
      display: inline-block;
      padding: 12px 28px;
      border: none;
      border-radius: 10px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      font-size: 0.95em;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .export-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(102,126,234,0.4); }
    .footer {
      text-align: center;
      margin-top: 40px;
      color: rgba(255,255,255,0.2);
      font-size: 0.8em;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-logo">A | CAP</div>
    <a href="/admin/logout" class="logout-btn">خروج</a>
  </div>
  <div class="container">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">کل کاربران</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.completed}</div>
        <div class="stat-label">آزمون تکمیل‌شده</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%</div>
        <div class="stat-label">نرخ تکمیل</div>
      </div>
    </div>

    <div class="section-title">📊 توزیع نوع سرمایه‌گذار</div>
    <div class="types-card">
      ${typeRows || '<div style="color:rgba(255,255,255,0.3);text-align:center;padding:20px;">هنوز داده‌ای ثبت نشده</div>'}
    </div>

    <div class="section-title">📥 خروجی اطلاعات</div>
    <div class="export-section">
      <div class="export-grid">
        <div class="export-card">
          <div class="export-icon">👥</div>
          <div class="export-title">کاربران</div>
          <div class="export-desc">نام، شماره، سن، سرمایه، امتیاز، نوع سرمایه‌گذار</div>
          <a class="export-btn" href="/admin/export/users.csv">دانلود CSV</a>
        </div>
        <div class="export-card">
          <div class="export-icon">📝</div>
          <div class="export-title">تلاش‌های آزمون</div>
          <div class="export-desc">تاریخچه کامل تمام آزمون‌ها با جزئیات</div>
          <a class="export-btn" href="/admin/export/attempts.csv">دانلود CSV</a>
        </div>
      </div>
    </div>

    <div class="footer">A | CAP — Admin Panel</div>
  </div>
</body>
</html>`;
  }
}
