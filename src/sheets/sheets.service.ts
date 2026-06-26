import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class SheetsService {
  private readonly logger = new Logger(SheetsService.name);
  private sheets: sheets_v4.Sheets | null = null;
  private spreadsheetId: string;

  /** The ambassador / leaderboard sheet (updated by user constantly) */
  private readonly ambassadorSheetId = '1hW2C35olzaYXgIpZXk_yOlKgzFx8J6oOqRmKCgvK8wM';

  /** Cache for leaderboard data (5-minute TTL) */
  private leaderboardCache: { data: LeaderboardEntry[]; fetchedAt: number } | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.spreadsheetId = '1_sPZ0h_3jzrw8rJLlgi-fORa03aK-f3wlDDyIePuhA0';
  }

  private async getClient(): Promise<sheets_v4.Sheets | null> {
    if (this.sheets) return this.sheets;

    const credentialsJson = this.configService.get<string>('GOOGLE_CREDENTIALS_JSON');
    if (!credentialsJson) {
      this.logger.warn('GOOGLE_CREDENTIALS_JSON not set. Sheet sync disabled.');
      return null;
    }

    try {
      const credentials = JSON.parse(credentialsJson);
      if (credentials.type !== 'service_account') {
        this.logger.warn('Google credentials are not a service account. Sheet sync disabled.');
        return null;
      }

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth });
      return this.sheets;
    } catch (error) {
      this.logger.warn(`Failed to parse Google credentials: ${error}`);
      return null;
    }
  }

  async syncUserToSheet(telegramId: string, platform = 'telegram'): Promise<void> {
    try {
      const user = await this.prisma.telegram_user.findUnique({
        where: { telegram_id_platform: { telegram_id: telegramId, platform } },
        include: { quiz_attempts: { orderBy: { attempt_number: 'desc' } } },
      });
      if (!user || !user.quiz_completed) return;

      const sheets = await this.getClient();
      if (!sheets) return;

      const row = [
        user.platform,
        user.telegram_id,
        user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        user.username || '',
        user.phone_number || '',
        user.age_range || '',
        user.capital_amount || '',
        user.total_score?.toString() || '',
        user.investor_type || '',
        user.quiz_count.toString(),
        new Date().toISOString(),
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [row],
        },
      });

      await this.prisma.telegram_user.update({
        where: { telegram_id_platform: { telegram_id: telegramId, platform } },
        data: { synced_to_sheet: true },
      });

      this.logger.log(`Synced user ${telegramId} to Google Sheet`);
    } catch (error) {
      this.logger.error(`Failed to sync user ${telegramId} to sheet: ${error}`);
    }
  }

  async ensureHeaders(): Promise<void> {
    try {
      const sheets = await this.getClient();
      if (!sheets) return;
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A1:J1',
      });

      if (!res.data.values || res.data.values.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'Sheet1!A1:J1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [[
              'Telegram ID',
              'Full Name',
              'Username',
              'Phone Number',
              'Age Range',
              'Capital Amount',
              'Score',
              'Investor Type',
              'Quiz Count',
              'Last Updated',
            ]],
          },
        });
        this.logger.log('Sheet headers created');
      }
    } catch (error) {
      this.logger.error(`Failed to set headers: ${error}`);
    }
  }

  /**
   * Read leaderboard / ambassador sales data from the Google Sheet.
   * Tries Google Sheets API first, falls back to CSV public export.
   * Returns top sellers sorted by sales count descending.
   */
  async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    // Check cache first
    if (this.leaderboardCache && Date.now() - this.leaderboardCache.fetchedAt < this.CACHE_TTL_MS) {
      return this.leaderboardCache.data.slice(0, limit);
    }

    try {
      // Try Google Sheets API first
      const sheets = await this.getClient();
      if (sheets) {
        const result = await this.readLeaderboardViaApi(sheets, limit);
        if (result.length > 0) return result;
      }

      // Fallback: try public CSV export
      return await this.readLeaderboardViaCsv(limit);
    } catch (error) {
      this.logger.error(`Failed to fetch leaderboard: ${error}`);
      // Return cached data if available (even if stale)
      if (this.leaderboardCache) return this.leaderboardCache.data.slice(0, limit);
      return [];
    }
  }

  private async readLeaderboardViaApi(sheets: sheets_v4.Sheets, limit: number): Promise<LeaderboardEntry[]> {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: this.ambassadorSheetId,
        range: 'Sheet1!A:Z', // Read all columns
      });

      if (!res.data.values || res.data.values.length < 2) return [];

      return this.parseLeaderboardRows(res.data.values, limit);
    } catch (error) {
      this.logger.warn(`API read of ambassador sheet failed: ${error}`);
      return [];
    }
  }

  /**
   * Read leaderboard via Google Visualization API (works for any shared sheet).
   * This is the most reliable fallback — no authentication needed.
   */
  private async readLeaderboardViaCsv(limit: number): Promise<LeaderboardEntry[]> {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${this.ambassadorSheetId}/gviz/tq?tqx=out:json`;
      const response = await axios.get(url, { timeout: 10000, maxRedirects: 5 });
      if (!response.data || typeof response.data !== 'string') return [];

      // Response is JSONP: google.visualization.Query.setResponse({...});
      const jsonStr = (response.data as string).replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '');
      const parsed = JSON.parse(jsonStr);

      if (!parsed?.table?.cols || !parsed?.table?.rows) return [];

      const cols: string[] = parsed.table.cols.map((c: any) => (c.label || c.id || '').toLowerCase().trim());
      const rows: string[][] = parsed.table.rows.map((r: any) =>
        r.c.map((cell: any) => (cell?.v != null ? String(cell.v) : (cell?.f || ''))),
      );

      if (rows.length === 0) return [];

      // Check if first row is headers (if cols are generic like "Col0", "Col1")
      const isGenericCols = cols.every((c) => /^col\d+$/i.test(c));
      if (isGenericCols && rows.length > 0) {
        // Use first data row as headers
        const headerRow = rows[0].map((h) => h.toLowerCase().trim());
        const dataRows = rows.slice(1);
        return this.parseLeaderboardRows([headerRow, ...dataRows], limit);
      }

      // Use col labels as headers
      return this.parseLeaderboardRows([cols, ...rows], limit);
    } catch (error) {
      this.logger.warn(`Visualization API read of ambassador sheet failed: ${error}`);
      return [];
    }
  }

  /**
   * Parse rows from the ambassador sheet.
   * Auto-detects column positions from headers.
   * Expected columns (case-insensitive): name, sales, commission, referral_code, etc.
   */
  private parseLeaderboardRows(rows: string[][], limit: number): LeaderboardEntry[] {
    const headers = rows[0].map((h) => h.toLowerCase().trim());

    // Try to find columns by various header names
    const nameIdx = this.findColumnIndex(headers, ['name', 'نام', 'full_name', 'seller', 'فروشنده', 'ambassador', 'سفیر']);
    const salesIdx = this.findColumnIndex(headers, ['sales', 'فروش', 'successful_sales', 'sales_count', 'تعداد فروش', 'purchases']);
    const commissionIdx = this.findColumnIndex(headers, ['commission', 'کمیسیون', 'earnings', 'درآمد', 'total_earnings', 'earned']);
    const referralsIdx = this.findColumnIndex(headers, ['referrals', 'دعوت', 'invites', 'registrations', 'ثبت‌نام', 'referral_count']);
    const testsIdx = this.findColumnIndex(headers, ['tests', 'تست', 'completed_tests', 'تست‌های تکمیل‌شده']);
    const clicksIdx = this.findColumnIndex(headers, ['clicks', 'کلیک', 'link_clicks']);

    if (nameIdx === -1) {
      this.logger.warn(`Ambassador sheet: could not find name column in headers: ${headers.join(', ')}`);
      // Fallback: use first column as name, second as sales
      const entries: LeaderboardEntry[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        entries.push({
          name: row[0] || 'ناشناس',
          sales: parseInt(row[1] || '0', 10) || 0,
          commission: parseInt(row[2] || '0', 10) || 0,
          referrals: parseInt(row[3] || '0', 10) || 0,
          tests: 0,
          clicks: 0,
        });
      }
      entries.sort((a, b) => b.sales - a.sales);
      const result = entries.slice(0, limit);
      this.leaderboardCache = { data: entries, fetchedAt: Date.now() };
      return result;
    }

    const entries: LeaderboardEntry[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = nameIdx >= 0 ? row[nameIdx] : '';
      if (!name) continue;
      entries.push({
        name,
        sales: salesIdx >= 0 ? (parseInt(row[salesIdx] || '0', 10) || 0) : 0,
        commission: commissionIdx >= 0 ? (parseInt(row[commissionIdx]?.replace(/[^0-9]/g, '') || '0', 10) || 0) : 0,
        referrals: referralsIdx >= 0 ? (parseInt(row[referralsIdx] || '0', 10) || 0) : 0,
        tests: testsIdx >= 0 ? (parseInt(row[testsIdx] || '0', 10) || 0) : 0,
        clicks: clicksIdx >= 0 ? (parseInt(row[clicksIdx] || '0', 10) || 0) : 0,
      });
    }

    entries.sort((a, b) => b.sales - a.sales);
    this.leaderboardCache = { data: entries, fetchedAt: Date.now() };
    return entries.slice(0, limit);
  }

  private findColumnIndex(headers: string[], candidates: string[]): number {
    for (const c of candidates) {
      const idx = headers.findIndex((h) => h.includes(c));
      if (idx !== -1) return idx;
    }
    return -1;
  }
}

export interface LeaderboardEntry {
  name: string;
  sales: number;
  commission: number;
  referrals: number;
  tests: number;
  clicks: number;
}