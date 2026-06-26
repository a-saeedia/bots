import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllUsers() {
    return this.prisma.telegram_user.findMany({
      orderBy: { created_at: 'desc' },
      include: { quiz_responses: true },
    });
  }

  async getCompletedUsers() {
    return this.prisma.telegram_user.findMany({
      where: { quiz_completed: true },
      orderBy: { created_at: 'desc' },
      include: { quiz_responses: true },
    });
  }

  async getUserStats() {
    const total = await this.prisma.telegram_user.count();
    const completed = await this.prisma.telegram_user.count({ where: { quiz_completed: true } });
    const byType = await this.prisma.telegram_user.groupBy({
      by: ['investor_type'],
      where: { quiz_completed: true },
      _count: true,
    });
    return { total, completed, byType };
  }

  private escapeCsv(val: string | null | undefined): string {
    if (val == null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  /** Wraps phone numbers so Excel won't convert to scientific notation */
  private escapePhone(val: string | null | undefined): string {
    if (val == null) return '';
    const s = String(val).trim();
    if (!s) return '';
    // Force Excel to treat as text by wrapping as ="value"
    return `="${s}"`;
  }

  private investorTypePersian(type: string | null): string {
    const m: Record<string, string> = {
      capital_protector: 'محافظ سرمایه',
      balanced_investor: 'متعادل',
      growth_investor: 'رشدگرا',
      opportunity_seeker: 'فرصت‌جو',
    };
    return m[type || ''] || type || '';
  }

  async exportUsersCsv(): Promise<string> {
    const users = await this.prisma.telegram_user.findMany({
      orderBy: { created_at: 'desc' },
    });

    const header = 'Platform,Name,Phone,Username,Age Range,Capital,Score,Investor Type,Investor Type (FA),Quiz Count,Referral Code,Referred By,Referral Count,Joined';
    const rows = users.map((u: any) => [
      this.escapeCsv(u.platform),
      this.escapeCsv(u.full_name),
      this.escapePhone(u.phone_number),
      this.escapeCsv(u.username),
      this.escapeCsv(u.age_range),
      this.escapeCsv(u.capital_amount),
      u.total_score != null ? String(u.total_score) : '',
      this.escapeCsv(u.investor_type),
      this.escapeCsv(this.investorTypePersian(u.investor_type)),
      String(u.quiz_count),
      this.escapeCsv(u.referral_code),
      this.escapeCsv(u.referred_by),
      String(u.referral_count || 0),
      u.created_at.toISOString(),
    ].join(','));

    return [header, ...rows].join('\n');
  }

  async exportAttemptsCsv(): Promise<string> {
    const attempts = await this.prisma.quiz_attempt.findMany({
      orderBy: { completed_at: 'desc' },
      include: { user: { select: { full_name: true, phone_number: true, username: true } } },
    });

    const header = 'Platform,Name,Phone,Username,Attempt #,Score,Investor Type,Investor Type (FA),Date';
    const rows = attempts.map((a: any) => [
      this.escapeCsv(a.platform),
      this.escapeCsv(a.user.full_name),
      this.escapePhone(a.user.phone_number),
      this.escapeCsv(a.user.username),
      String(a.attempt_number),
      String(a.total_score),
      this.escapeCsv(a.investor_type),
      this.escapeCsv(this.investorTypePersian(a.investor_type)),
      a.completed_at.toISOString(),
    ].join(','));

    return [header, ...rows].join('\n');
  }
}
