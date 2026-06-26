import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SheetsService } from '../sheets/sheets.service';

@Injectable()
export class WebappService {
  private readonly logger = new Logger(WebappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sheetsService: SheetsService,
  ) {}

  async getUserData(uid: string, platform: string) {
    if (!uid) return null;
    try {
      const user = await this.prisma.telegram_user.findUnique({
        where: { telegram_id_platform: { telegram_id: uid, platform } },
      });
      if (!user) return null;
      const tier = this.getAmbassadorTier(user.referral_count || 0);
      return {
        name: user.full_name || user.first_name || 'کاربر',
        score: user.total_score,
        quizCompleted: user.quiz_completed,
        quizCount: user.quiz_count,
        investorType: user.investor_type,
        referralCode: user.referral_code,
        referralCount: user.referral_count || 0,
        tier,
      };
    } catch (err) {
      this.logger.error(`getUserData error: ${err}`);
      return null;
    }
  }

  async getLeaderboardData() {
    try {
      return await this.sheetsService.getLeaderboard();
    } catch {
      return [];
    }
  }

  private getAmbassadorTier(count: number) {
    if (count >= 200) return { name: 'Ambassador', icon: '👑', commission: 45 };
    if (count >= 50) return { name: 'Gold Partner', icon: '🥇', commission: 40 };
    if (count >= 10) return { name: 'Silver Partner', icon: '🥈', commission: 35 };
    return { name: 'Partner', icon: '🥉', commission: 30 };
  }

  async renderApp(page: string, uid: string, platform: string): Promise<string> {
    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>A | Cap</title>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root {
      --bg: #0A1628;
      --bg2: #0F1D32;
      --card: rgba(255,255,255,0.05);
      --border: rgba(255,255,255,0.08);
      --accent: #00C9A7;
      --accent2: #00A3FF;
      --text: #E8ECF1;
      --muted: #8B95A5;
      --gold: #FFD700;
      --radius: 16px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Vazirmatn', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }

    /* Background */
    .bg-effects {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; pointer-events: none;
      background:
        radial-gradient(ellipse at 20% 0%, rgba(0,201,167,0.08) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 100%, rgba(0,163,255,0.06) 0%, transparent 60%);
    }

    /* App container */
    .app { position: relative; z-index: 1; padding: 0 0 100px; }

    /* Header */
    .header {
      text-align: center; padding: 24px 20px 16px;
      border-bottom: 1px solid var(--border);
    }
    .header .logo {
      font-size: 1.8rem; font-weight: 900; letter-spacing: 3px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .header .subtitle { color: var(--muted); font-size: 0.8rem; margin-top: 4px; }

    /* Navigation tabs */
    .nav {
      display: flex; gap: 0; padding: 0;
      background: var(--bg2); border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 50;
    }
    .nav-item {
      flex: 1; text-align: center; padding: 14px 8px;
      font-size: 0.78rem; font-weight: 500;
      color: var(--muted); cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.3s;
    }
    .nav-item.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
      background: rgba(0,201,167,0.05);
    }
    .nav-item .nav-icon { font-size: 1.2rem; display: block; margin-bottom: 3px; }

    /* Pages */
    .page { display: none; padding: 20px 16px; }
    .page.active { display: block; animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    /* Cards */
    .card {
      background: var(--card); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 20px;
      margin-bottom: 14px;
      transition: border-color 0.3s;
    }
    .card:hover { border-color: rgba(0,201,167,0.2); }
    .card-title {
      font-size: 1rem; font-weight: 700; margin-bottom: 12px;
      display: flex; align-items: center; gap: 8px;
    }

    /* Hero card */
    .hero-card {
      background: linear-gradient(135deg, rgba(0,201,167,0.12), rgba(0,163,255,0.08));
      border: 1px solid rgba(0,201,167,0.2);
      border-radius: var(--radius); padding: 28px 20px;
      text-align: center; margin-bottom: 20px;
    }
    .hero-card h2 { font-size: 1.3rem; font-weight: 800; margin-bottom: 8px; }
    .hero-card p { color: var(--muted); font-size: 0.9rem; line-height: 1.7; }

    /* Feature list */
    .feature-item {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px 0;
      border-bottom: 1px solid var(--border);
    }
    .feature-item:last-child { border-bottom: none; }
    .feature-icon {
      width: 42px; height: 42px; border-radius: 12px;
      background: rgba(0,201,167,0.1);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.3rem; flex-shrink: 0;
    }
    .feature-text h4 { font-size: 0.95rem; font-weight: 700; margin-bottom: 2px; }
    .feature-text p { color: var(--muted); font-size: 0.82rem; line-height: 1.5; }

    /* Steps */
    .step {
      display: flex; align-items: center; gap: 16px;
      padding: 16px 0;
    }
    .step-num {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      display: flex; align-items: center; justify-content: center;
      font-size: 1rem; font-weight: 800; flex-shrink: 0;
    }
    .step-text h4 { font-size: 0.95rem; font-weight: 700; }
    .step-text p { color: var(--muted); font-size: 0.82rem; }

    /* Pricing */
    .price-card {
      background: var(--card); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 20px;
      margin-bottom: 12px; position: relative; overflow: hidden;
    }
    .price-card.featured {
      border-color: var(--accent);
      background: linear-gradient(135deg, rgba(0,201,167,0.1), rgba(0,163,255,0.06));
    }
    .price-badge {
      position: absolute; top: 12px; left: 12px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: #fff; padding: 3px 12px; border-radius: 20px;
      font-size: 0.7rem; font-weight: 700;
    }
    .price-header { display: flex; justify-content: space-between; align-items: center; }
    .price-name { font-size: 1rem; font-weight: 700; }
    .price-amount {
      font-size: 1.2rem; font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .price-old { color: var(--muted); text-decoration: line-through; font-size: 0.8rem; }
    .price-discount {
      display: inline-block; background: rgba(0,201,167,0.15);
      color: var(--accent); padding: 2px 8px; border-radius: 8px;
      font-size: 0.75rem; font-weight: 600; margin-top: 6px;
    }

    /* Ambassador tiers */
    .tier-card {
      display: flex; align-items: center; gap: 14px;
      background: var(--card); border: 1px solid var(--border);
      border-radius: 12px; padding: 14px 16px;
      margin-bottom: 10px;
    }
    .tier-card.active { border-color: var(--accent); background: rgba(0,201,167,0.08); }
    .tier-icon { font-size: 2rem; }
    .tier-info { flex: 1; }
    .tier-info h4 { font-size: 0.95rem; font-weight: 700; }
    .tier-info p { color: var(--muted); font-size: 0.8rem; }
    .tier-commission {
      font-size: 1.1rem; font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }

    /* Leaderboard */
    .lb-row {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-radius: 12px;
      margin-bottom: 8px; background: var(--card);
      border: 1px solid var(--border);
    }
    .lb-row.top1 { background: rgba(255,215,0,0.08); border-color: rgba(255,215,0,0.2); }
    .lb-row.top2 { background: rgba(192,192,192,0.06); border-color: rgba(192,192,192,0.15); }
    .lb-row.top3 { background: rgba(205,127,50,0.06); border-color: rgba(205,127,50,0.15); }
    .lb-rank {
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--border); display: flex; align-items: center; justify-content: center;
      font-size: 0.85rem; font-weight: 800; flex-shrink: 0;
    }
    .lb-row.top1 .lb-rank { background: rgba(255,215,0,0.2); color: var(--gold); }
    .lb-row.top2 .lb-rank { background: rgba(192,192,192,0.2); color: #C0C0C0; }
    .lb-row.top3 .lb-rank { background: rgba(205,127,50,0.2); color: #CD7F32; }
    .lb-name { flex: 1; font-weight: 600; font-size: 0.9rem; }
    .lb-score { font-weight: 700; color: var(--accent); font-size: 0.9rem; }
    .lb-empty { text-align: center; padding: 40px 20px; color: var(--muted); }

    /* Stats row */
    .stats-row {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      margin-bottom: 16px;
    }
    .stat-box {
      background: var(--card); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px 10px; text-align: center;
    }
    .stat-val {
      font-size: 1.4rem; font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .stat-label { color: var(--muted); font-size: 0.72rem; margin-top: 4px; }

    /* CTA button */
    .cta-btn {
      display: block; width: 100%; padding: 16px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: #fff; border: none; border-radius: 14px;
      font-family: inherit; font-size: 1rem; font-weight: 700;
      cursor: pointer; text-align: center; text-decoration: none;
      transition: transform 0.2s, box-shadow 0.2s;
      margin-top: 16px;
    }
    .cta-btn:active { transform: scale(0.98); }

    /* Divider */
    .divider { height: 1px; background: var(--border); margin: 20px 0; }

    /* Section title */
    .section-title {
      font-size: 1.1rem; font-weight: 800; margin-bottom: 16px;
      display: flex; align-items: center; gap: 8px;
    }

    /* Calculator */
    .calc-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; }
    .calc-card {
      background: var(--card); border: 1px solid var(--border);
      border-radius: 12px; padding: 14px; text-align: center;
    }
    .calc-card .emoji { font-size: 1.5rem; }
    .calc-card .val { font-size: 1rem; font-weight: 700; margin: 4px 0; }
    .calc-card .label { font-size: 0.75rem; color: var(--muted); }

    /* Loading */
    .loading { text-align: center; padding: 60px 20px; }
    .spinner {
      width: 36px; height: 36px; border: 3px solid var(--border);
      border-top-color: var(--accent); border-radius: 50%;
      animation: spin 0.8s linear infinite; margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>

<div class="bg-effects"></div>

<div class="app">
  <!-- Header -->
  <div class="header">
    <div class="logo">A | CAP</div>
    <div class="subtitle">\u062f\u0633\u062a\u06cc\u0627\u0631 \u0647\u0648\u0634\u0645\u0646\u062f \u0645\u062f\u06cc\u0631\u06cc\u062a \u0633\u0631\u0645\u0627\u06cc\u0647</div>
  </div>

  <!-- Nav -->
  <div class="nav">
    <div class="nav-item active" onclick="showPage('home')">
      <span class="nav-icon">\ud83c\udfe0</span>\u062e\u0627\u0646\u0647
    </div>
    <div class="nav-item" onclick="showPage('ambassador')">
      <span class="nav-icon">\ud83e\udd1d</span>\u0633\u0641\u06cc\u0631\u0627\u0646
    </div>
    <div class="nav-item" onclick="showPage('leaderboard')">
      <span class="nav-icon">\ud83c\udfc6</span>\u0631\u062a\u0628\u0647\u200c\u0628\u0646\u062f\u06cc
    </div>
    <div class="nav-item" onclick="showPage('pricing')">
      <span class="nav-icon">\ud83d\udcb3</span>\u0627\u0634\u062a\u0631\u0627\u06a9
    </div>
  </div>

  <!-- HOME PAGE -->
  <div class="page active" id="page-home">
    <div class="hero-card">
      <h2>\ud83d\udcc8 \u0634\u062e\u0635\u06cc\u062a \u0645\u0627\u0644\u06cc \u062e\u0648\u062f \u0631\u0627 \u06a9\u0634\u0641 \u06a9\u0646\u06cc\u062f</h2>
      <p>\u0645\u0627 \u0628\u0631\u0627\u06cc \u0634\u0645\u0627 \u0646\u0642\u0634\u0647 \u0645\u062f\u06cc\u0631\u06cc\u062a \u062b\u0631\u0648\u062a \u0634\u062e\u0635\u06cc \u0645\u06cc\u200c\u0633\u0627\u0632\u06cc\u0645</p>
    </div>

    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-val">\u06f3 \u062f\u0642\u06cc\u0642\u0647</div>
        <div class="stat-label">\u0632\u0645\u0627\u0646 \u062a\u0633\u062a</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">\u06f4 \u062a\u06cc\u067e</div>
        <div class="stat-label">\u0634\u062e\u0635\u06cc\u062a \u0645\u0627\u0644\u06cc</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">\u0631\u0627\u06cc\u06af\u0627\u0646</div>
        <div class="stat-label">\u062a\u0633\u062a \u0634\u062e\u0635\u06cc\u062a</div>
      </div>
    </div>

    <div class="section-title">\u2728 \u0627\u0645\u06a9\u0627\u0646\u0627\u062a</div>
    <div class="card">
      <div class="feature-item">
        <div class="feature-icon">\ud83e\udde0</div>
        <div class="feature-text">
          <h4>\u062a\u062d\u0644\u06cc\u0644 \u0634\u062e\u0635\u06cc\u062a \u0645\u0627\u0644\u06cc</h4>
          <p>\u0633\u0628\u06a9 \u0633\u0631\u0645\u0627\u06cc\u0647\u200c\u06af\u0630\u0627\u0631\u06cc\u060c \u0631\u06cc\u0633\u06a9\u200c\u067e\u0630\u06cc\u0631\u06cc \u0648 \u062a\u0631\u06a9\u06cc\u0628 \u062f\u0627\u0631\u0627\u06cc\u06cc \u0645\u0646\u0627\u0633\u0628 \u0634\u0645\u0627</p>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">\ud83d\udcca</div>
        <div class="feature-text">
          <h4>\u0633\u0628\u062f \u067e\u06cc\u0634\u0646\u0647\u0627\u062f\u06cc \u0647\u0648\u0634\u0645\u0646\u062f</h4>
          <p>\u0633\u0628\u062f \u0633\u0631\u0645\u0627\u06cc\u0647\u200c\u06af\u0630\u0627\u0631\u06cc \u0645\u062a\u0646\u0627\u0633\u0628 \u0628\u0627 \u0634\u062e\u0635\u06cc\u062a \u0645\u0627\u0644\u06cc \u0634\u0645\u0627</p>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">\ud83d\udcc8</div>
        <div class="feature-text">
          <h4>A | Cap Score</h4>
          <p>\u0627\u0645\u062a\u06cc\u0627\u0632\u062f\u0647\u06cc \u0641\u0631\u0635\u062a\u200c\u0647\u0627 \u0628\u0631 \u0627\u0633\u0627\u0633 \u0631\u06cc\u0633\u06a9\u060c \u0628\u0627\u0632\u062f\u0647 \u0648 \u0646\u0642\u062f\u0634\u0648\u0646\u062f\u06af\u06cc</p>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">\ud83d\udd14</div>
        <div class="feature-text">
          <h4>\u0633\u06cc\u06af\u0646\u0627\u0644\u200c\u0647\u0627\u06cc \u0627\u062e\u062a\u0635\u0627\u0635\u06cc</h4>
          <p>\u0633\u06cc\u06af\u0646\u0627\u0644\u200c\u0647\u0627\u06cc \u0645\u062a\u0646\u0627\u0633\u0628 \u0628\u0627 \u0633\u0637\u062d \u0631\u06cc\u0633\u06a9 \u0648 \u0634\u062e\u0635\u06cc\u062a \u0645\u0627\u0644\u06cc \u0634\u0645\u0627</p>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">\ud83d\udee1\ufe0f</div>
        <div class="feature-text">
          <h4>\u0645\u062f\u06cc\u0631\u06cc\u062a \u0631\u06cc\u0633\u06a9</h4>
          <p>\u062d\u0641\u0627\u0638\u062a \u0627\u0632 \u0633\u0631\u0645\u0627\u06cc\u0647 \u0628\u0627 \u0627\u0635\u0648\u0644 \u0639\u0644\u0645\u06cc \u062a\u0646\u0648\u0639\u200c\u0628\u062e\u0634\u06cc \u0633\u0628\u062f</p>
        </div>
      </div>
    </div>

    <div class="section-title">\ud83d\udca1 \u0686\u06af\u0648\u0646\u0647 \u0634\u0631\u0648\u0639 \u06a9\u0646\u0645\u061f</div>
    <div class="card">
      <div class="step">
        <div class="step-num">\u06f1</div>
        <div class="step-text">
          <h4>\u062a\u0633\u062a \u0634\u062e\u0635\u06cc\u062a \u0645\u0627\u0644\u06cc</h4>
          <p>\u06a9\u0645\u062a\u0631 \u0627\u0632 \u06f3 \u062f\u0642\u06cc\u0642\u0647 \u0622\u0632\u0645\u0648\u0646</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">\u06f2</div>
        <div class="step-text">
          <h4>\u0646\u0642\u0634\u0647 \u0633\u0631\u0645\u0627\u06cc\u0647 \u0634\u062e\u0635\u06cc</h4>
          <p>\u0633\u0628\u062f \u067e\u06cc\u0634\u0646\u0647\u0627\u062f\u06cc \u0648 \u062f\u0631\u0635\u062f \u062a\u062e\u0635\u06cc\u0635 \u062f\u0627\u0631\u0627\u06cc\u06cc</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">\u06f3</div>
        <div class="step-text">
          <h4>\u0634\u0631\u0648\u0639 \u0633\u0631\u0645\u0627\u06cc\u0647\u200c\u06af\u0630\u0627\u0631\u06cc</h4>
          <p>\u062f\u0633\u062a\u0631\u0633\u06cc \u0628\u0647 \u0633\u06cc\u06af\u0646\u0627\u0644\u200c\u0647\u0627 \u0648 \u0641\u0631\u0635\u062a\u200c\u0647\u0627</p>
        </div>
      </div>
    </div>

    <button class="cta-btn" onclick="Telegram.WebApp.close()">\ud83d\udcdd \u0634\u0631\u0648\u0639 \u062a\u0633\u062a \u0631\u0627\u06cc\u06af\u0627\u0646</button>
  </div>

  <!-- AMBASSADOR PAGE -->
  <div class="page" id="page-ambassador">
    <div class="hero-card">
      <h2>\ud83e\udd1d \u0628\u0627\u0634\u06af\u0627\u0647 \u0633\u0641\u06cc\u0631\u0627\u0646</h2>
      <p>\u0645\u0639\u0631\u0641\u06cc \u06a9\u0646\u060c \u062f\u0631\u0622\u0645\u062f \u0628\u0633\u0627\u0632! \u0627\u0632 \u0647\u0631 \u0641\u0631\u0648\u0634 \u0645\u0648\u0641\u0642 \u06a9\u0645\u06cc\u0633\u06cc\u0648\u0646 \u062f\u0631\u06cc\u0627\u0641\u062a \u06a9\u0646\u06cc\u062f</p>
    </div>

    <div class="section-title">\ud83c\udfc6 \u0633\u0637\u0648\u062d \u0633\u0641\u06cc\u0631\u0627\u0646</div>

    <div class="tier-card">
      <div class="tier-icon">\ud83e\udd49</div>
      <div class="tier-info">
        <h4>Partner</h4>
        <p>\u06f0 \u062a\u0627 \u06f1\u06f0 \u0641\u0631\u0648\u0634 \u0645\u0648\u0641\u0642</p>
      </div>
      <div class="tier-commission">\u06f3\u06f0\u066a</div>
    </div>
    <div class="tier-card">
      <div class="tier-icon">\ud83e\udd48</div>
      <div class="tier-info">
        <h4>Silver Partner</h4>
        <p>\u06f1\u06f0 \u062a\u0627 \u06f5\u06f0 \u0641\u0631\u0648\u0634 \u0645\u0648\u0641\u0642</p>
      </div>
      <div class="tier-commission">\u06f3\u06f5\u066a</div>
    </div>
    <div class="tier-card">
      <div class="tier-icon">\ud83e\udd47</div>
      <div class="tier-info">
        <h4>Gold Partner</h4>
        <p>\u06f5\u06f0 \u062a\u0627 \u06f2\u06f0\u06f0 \u0641\u0631\u0648\u0634 \u0645\u0648\u0641\u0642</p>
      </div>
      <div class="tier-commission">\u06f4\u06f0\u066a</div>
    </div>
    <div class="tier-card">
      <div class="tier-icon">\ud83d\udc51</div>
      <div class="tier-info">
        <h4>Ambassador</h4>
        <p>\u0628\u06cc\u0634 \u0627\u0632 \u06f2\u06f0\u06f0 \u0641\u0631\u0648\u0634 \u0645\u0648\u0641\u0642</p>
      </div>
      <div class="tier-commission">\u06f4\u06f5\u066a</div>
    </div>

    <div class="divider"></div>

    <div class="section-title">\ud83d\udcb0 \u0645\u062d\u0627\u0633\u0628\u0647 \u062f\u0631\u0622\u0645\u062f</div>
    <div class="calc-grid">
      <div class="calc-card">
        <div class="emoji">\ud83d\udc65</div>
        <div class="val">\u06f1\u06f0 \u0641\u0631\u0648\u0634</div>
        <div class="label">\u06f7.\u06f3\u06f5 \u0645\u06cc\u0644\u06cc\u0648\u0646 \u062a\u0648\u0645\u0627\u0646</div>
      </div>
      <div class="calc-card">
        <div class="emoji">\ud83d\udc65</div>
        <div class="val">\u06f2\u06f0 \u0641\u0631\u0648\u0634</div>
        <div class="label">\u06f1\u06f4.\u06f7 \u0645\u06cc\u0644\u06cc\u0648\u0646 \u062a\u0648\u0645\u0627\u0646</div>
      </div>
      <div class="calc-card">
        <div class="emoji">\ud83d\udcb8</div>
        <div class="val">\u06f5\u06f0 \u0641\u0631\u0648\u0634</div>
        <div class="label">\u06f3\u06f6.\u06f7\u06f5 \u0645\u06cc\u0644\u06cc\u0648\u0646 \u062a\u0648\u0645\u0627\u0646</div>
      </div>
      <div class="calc-card">
        <div class="emoji">\ud83d\ude80</div>
        <div class="val">\u06f1\u06f0\u06f0 \u0641\u0631\u0648\u0634</div>
        <div class="label">\u06f7\u06f3+ \u0645\u06cc\u0644\u06cc\u0648\u0646 \u062a\u0648\u0645\u0627\u0646</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="section-title">\ud83c\udf81 \u062c\u0648\u0627\u06cc\u0632 \u062f\u0639\u0648\u062a \u0641\u0639\u0627\u0644</div>
    <div class="card">
      <div class="feature-item">
        <div class="feature-icon">\ud83d\udc65</div>
        <div class="feature-text">
          <h4>\u06f5 \u062f\u0639\u0648\u062a \u0641\u0639\u0627\u0644</h4>
          <p>\ud83c\udf81 \u06cc\u06a9 \u0647\u0641\u062a\u0647 \u0627\u0634\u062a\u0631\u0627\u06a9 \u0631\u0627\u06cc\u06af\u0627\u0646</p>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">\ud83d\udc8e</div>
        <div class="feature-text">
          <h4>\u06f1\u06f0 \u062f\u0639\u0648\u062a \u0641\u0639\u0627\u0644</h4>
          <p>\ud83d\udc8e \u06cc\u06a9 \u0645\u0627\u0647 \u0627\u0634\u062a\u0631\u0627\u06a9 \u0631\u0627\u06cc\u06af\u0627\u0646</p>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">\ud83d\udc51</div>
        <div class="feature-text">
          <h4>\u06f5\u06f0 \u062f\u0639\u0648\u062a \u0641\u0639\u0627\u0644</h4>
          <p>\ud83d\udc51 \u06cc\u06a9 \u0633\u0627\u0644 \u0627\u0634\u062a\u0631\u0627\u06a9 \u0631\u0627\u06cc\u06af\u0627\u0646 ACAP Plus</p>
        </div>
      </div>
    </div>

    <button class="cta-btn" onclick="Telegram.WebApp.close()">\ud83d\udd17 \u062f\u0631\u06cc\u0627\u0641\u062a \u0644\u06cc\u0646\u06a9 \u062f\u0639\u0648\u062a</button>
  </div>

  <!-- LEADERBOARD PAGE -->
  <div class="page" id="page-leaderboard">
    <div class="section-title">\ud83c\udfc6 \u0631\u062a\u0628\u0647\u200c\u0628\u0646\u062f\u06cc \u0633\u0641\u06cc\u0631\u0627\u0646</div>
    <div id="leaderboard-content">
      <div class="loading">
        <div class="spinner"></div>
        <p>\u062f\u0631 \u062d\u0627\u0644 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc...</p>
      </div>
    </div>
  </div>

  <!-- PRICING PAGE -->
  <div class="page" id="page-pricing">
    <div class="section-title">\ud83d\udcb3 \u067e\u0644\u0646\u200c\u0647\u0627\u06cc \u0627\u0634\u062a\u0631\u0627\u06a9 ACAP Plus</div>

    <div class="price-card">
      <div class="price-header">
        <div class="price-name">\u06f1 \u0645\u0627\u0647\u0647</div>
        <div class="price-amount">\u06f9\u06f5\u06f0,\u06f0\u06f0\u06f0 \u062a</div>
      </div>
    </div>

    <div class="price-card">
      <div class="price-header">
        <div class="price-name">\u06f3 \u0645\u0627\u0647\u0647</div>
        <div class="price-amount">\u06f2,\u06f4\u06f5\u06f0,\u06f0\u06f0\u06f0 \u062a</div>
      </div>
      <div class="price-old">\u06f2,\u06f8\u06f5\u06f0,\u06f0\u06f0\u06f0 \u062a\u0648\u0645\u0627\u0646</div>
      <div class="price-discount">\u06f1\u06f5\u066a \u062a\u062e\u0641\u06cc\u0641</div>
    </div>

    <div class="price-card">
      <div class="price-header">
        <div class="price-name">\u06f6 \u0645\u0627\u0647\u0647</div>
        <div class="price-amount">\u06f4,\u06f9\u06f5\u06f0,\u06f0\u06f0\u06f0 \u062a</div>
      </div>
      <div class="price-old">\u06f6,\u06f6\u06f0\u06f0,\u06f0\u06f0\u06f0 \u062a\u0648\u0645\u0627\u0646</div>
      <div class="price-discount">\u06f2\u06f5\u066a \u062a\u062e\u0641\u06cc\u0641</div>
    </div>

    <div class="price-card featured">
      <div class="price-badge">\u2b50 \u067e\u06cc\u0634\u0646\u0647\u0627\u062f \u0648\u06cc\u0698\u0647</div>
      <div style="margin-top:24px">
        <div class="price-header">
          <div class="price-name">\u06f1\u06f2 \u0645\u0627\u0647\u0647</div>
          <div class="price-amount">\u06f9,\u06f2\u06f4\u06f0,\u06f0\u06f0\u06f0 \u062a</div>
        </div>
        <div class="price-old">\u06f1\u06f3,\u06f2\u06f0\u06f0,\u06f0\u06f0\u06f0 \u062a\u0648\u0645\u0627\u0646</div>
        <div class="price-discount">\u06f3\u06f0\u066a \u062a\u062e\u0641\u06cc\u0641 \u2014 \u0645\u0639\u0627\u062f\u0644 \u06f3 \u0645\u0627\u0647 \u0631\u0627\u06cc\u06af\u0627\u0646</div>
      </div>
    </div>

    <button class="cta-btn" onclick="window.open('https://t.me/a_cap_support','_blank')">\u260e\ufe0f \u0645\u0634\u0627\u0648\u0631\u0647 \u062e\u0631\u06cc\u062f</button>
  </div>
</div>

<script>
  // Init Telegram WebApp
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    // Apply Telegram theme
    if (tg.themeParams) {
      document.documentElement.style.setProperty('--bg', tg.themeParams.bg_color || '#0A1628');
      document.documentElement.style.setProperty('--text', tg.themeParams.text_color || '#E8ECF1');
    }
  }

  // Page navigation
  function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');
    const navItems = document.querySelectorAll('.nav-item');
    const pages = ['home', 'ambassador', 'leaderboard', 'pricing'];
    const idx = pages.indexOf(name);
    if (idx >= 0 && navItems[idx]) navItems[idx].classList.add('active');

    // Load leaderboard data
    if (name === 'leaderboard' && !window._lbLoaded) {
      loadLeaderboard();
    }
  }

  // Load leaderboard
  async function loadLeaderboard() {
    try {
      const res = await fetch('/webapp/api/leaderboard');
      const data = await res.json();
      const container = document.getElementById('leaderboard-content');
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="lb-empty"><p style="font-size:2rem">\ud83c\udfc6</p><p>\u0647\u0646\u0648\u0632 \u062f\u0627\u062f\u0647\u200c\u0627\u06cc \u062b\u0628\u062a \u0646\u0634\u062f\u0647 \u0627\u0633\u062a</p><p style="font-size:0.8rem;margin-top:8px">\u0627\u0648\u0644\u06cc\u0646 \u0646\u0641\u0631\u06cc \u0628\u0627\u0634\u06cc\u062f \u06a9\u0647 \u062f\u0631 \u0631\u062a\u0628\u0647\u200c\u0628\u0646\u062f\u06cc \u0642\u0631\u0627\u0631 \u0645\u06cc\u200c\u06af\u06cc\u0631\u062f!</p></div>';
      } else {
        let html = '';
        data.forEach((item, i) => {
          const rank = i + 1;
          const cls = rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : '';
          const medal = rank === 1 ? '\ud83e\udd47' : rank === 2 ? '\ud83e\udd48' : rank === 3 ? '\ud83e\udd49' : rank;
          const name = Object.values(item)[0] || '---';
          const score = Object.values(item)[1] || '---';
          html += '<div class="lb-row ' + cls + '">';
          html += '<div class="lb-rank">' + medal + '</div>';
          html += '<div class="lb-name">' + name + '</div>';
          html += '<div class="lb-score">' + score + '</div>';
          html += '</div>';
        });
        container.innerHTML = html;
      }
      window._lbLoaded = true;
    } catch (e) {
      document.getElementById('leaderboard-content').innerHTML = '<div class="lb-empty"><p>\u062e\u0637\u0627 \u062f\u0631 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc</p></div>';
    }
  }
</script>
</body>
</html>`;
  }
}
