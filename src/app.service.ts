import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getLandingPage(): string {
    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A | Cap — دستیار هوشمند مدیریت سرمایه</title>
  <meta name="description" content="اولین دستیار مدیریت سرمایه مبتنی بر شخصیت مالی — ما برای شما نقشه مدیریت ثروت شخصی می‌سازیم">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📈</text></svg>">
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0A1628;
      --accent: #00C9A7;
      --accent-light: #00E5BE;
      --gold: #FFD700;
      --text: #E8ECF1;
      --text-muted: #8B95A5;
      --card-bg: rgba(255,255,255,0.04);
      --card-border: rgba(255,255,255,0.08);
      --gradient-1: linear-gradient(135deg, #00C9A7, #00A3FF);
      --gradient-2: linear-gradient(135deg, #667eea, #764ba2);
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Vazirmatn', sans-serif;
      background: var(--primary);
      color: var(--text);
      overflow-x: hidden;
      line-height: 1.8;
    }

    /* Background effects */
    .bg-glow {
      position: fixed; top: -50%; left: -50%; width: 200%; height: 200%;
      background: radial-gradient(circle at 30% 20%, rgba(0,201,167,0.06) 0%, transparent 50%),
                  radial-gradient(circle at 70% 80%, rgba(0,163,255,0.04) 0%, transparent 50%);
      z-index: 0; pointer-events: none;
    }
    .grid-pattern {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
      background-size: 60px 60px; z-index: 0; pointer-events: none;
    }

    /* Navigation */
    nav {
      position: fixed; top: 0; width: 100%; z-index: 100;
      background: rgba(10,22,40,0.85); backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--card-border);
      padding: 0 2rem;
    }
    .nav-inner {
      max-width: 1200px; margin: 0 auto;
      display: flex; align-items: center; justify-content: space-between;
      height: 70px;
    }
    .logo {
      font-size: 1.5rem; font-weight: 800; letter-spacing: 2px;
      background: var(--gradient-1); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .nav-links { display: flex; gap: 2rem; list-style: none; }
    .nav-links a {
      color: var(--text-muted); text-decoration: none; font-size: 0.9rem;
      transition: color 0.3s;
    }
    .nav-links a:hover { color: var(--accent); }
    .nav-cta {
      background: var(--gradient-1); color: #fff; border: none;
      padding: 10px 24px; border-radius: 50px; font-family: inherit;
      font-weight: 600; cursor: pointer; font-size: 0.9rem;
      transition: transform 0.3s, box-shadow 0.3s; text-decoration: none;
    }
    .nav-cta:hover {
      transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,201,167,0.3);
    }

    /* Hero */
    .hero {
      position: relative; z-index: 1;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      text-align: center; padding: 120px 2rem 80px;
    }
    .hero-content { max-width: 800px; }
    .hero-badge {
      display: inline-block; padding: 8px 20px; border-radius: 50px;
      background: rgba(0,201,167,0.1); border: 1px solid rgba(0,201,167,0.2);
      color: var(--accent); font-size: 0.85rem; font-weight: 500;
      margin-bottom: 2rem;
    }
    .hero h1 {
      font-size: clamp(2.2rem, 5vw, 3.8rem); font-weight: 900;
      line-height: 1.3; margin-bottom: 1.5rem;
    }
    .hero h1 span {
      background: var(--gradient-1); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .hero p {
      font-size: 1.15rem; color: var(--text-muted); max-width: 600px;
      margin: 0 auto 2.5rem; line-height: 1.9;
    }
    .hero-buttons { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .btn-primary {
      background: var(--gradient-1); color: #fff; border: none;
      padding: 14px 36px; border-radius: 50px; font-family: inherit;
      font-weight: 700; cursor: pointer; font-size: 1.05rem;
      transition: transform 0.3s, box-shadow 0.3s; text-decoration: none;
    }
    .btn-primary:hover {
      transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,201,167,0.35);
    }
    .btn-secondary {
      background: transparent; color: var(--text); border: 1px solid var(--card-border);
      padding: 14px 36px; border-radius: 50px; font-family: inherit;
      font-weight: 600; cursor: pointer; font-size: 1.05rem;
      transition: all 0.3s; text-decoration: none;
    }
    .btn-secondary:hover {
      border-color: var(--accent); color: var(--accent);
    }

    /* Stats bar */
    .stats-bar {
      position: relative; z-index: 1;
      background: var(--card-bg); border-top: 1px solid var(--card-border);
      border-bottom: 1px solid var(--card-border);
      padding: 3rem 2rem;
    }
    .stats-inner {
      max-width: 1000px; margin: 0 auto;
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem;
      text-align: center;
    }
    .stat-item h3 {
      font-size: 2.2rem; font-weight: 800;
      background: var(--gradient-1); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .stat-item p { color: var(--text-muted); font-size: 0.9rem; margin-top: 0.3rem; }

    /* Sections */
    section { position: relative; z-index: 1; padding: 100px 2rem; }
    .section-inner { max-width: 1100px; margin: 0 auto; }
    .section-header { text-align: center; margin-bottom: 4rem; }
    .section-header h2 {
      font-size: 2.2rem; font-weight: 800; margin-bottom: 1rem;
    }
    .section-header p { color: var(--text-muted); font-size: 1.05rem; max-width: 600px; margin: 0 auto; }

    /* Feature cards */
    .features-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;
    }
    .feature-card {
      background: var(--card-bg); border: 1px solid var(--card-border);
      border-radius: 16px; padding: 2rem;
      transition: transform 0.3s, border-color 0.3s;
    }
    .feature-card:hover {
      transform: translateY(-4px); border-color: rgba(0,201,167,0.3);
    }
    .feature-icon {
      width: 50px; height: 50px; border-radius: 12px;
      background: rgba(0,201,167,0.1); display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; margin-bottom: 1.2rem;
    }
    .feature-card h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.6rem; }
    .feature-card p { color: var(--text-muted); font-size: 0.9rem; line-height: 1.7; }

    /* Steps */
    .steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
    .step-card {
      text-align: center; padding: 2.5rem 1.5rem;
      background: var(--card-bg); border: 1px solid var(--card-border);
      border-radius: 16px; position: relative;
    }
    .step-num {
      width: 60px; height: 60px; border-radius: 50%;
      background: var(--gradient-1); display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; font-weight: 800; margin: 0 auto 1.5rem;
    }
    .step-card h3 { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.8rem; }
    .step-card p { color: var(--text-muted); font-size: 0.9rem; }

    /* Pricing */
    .pricing-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; max-width: 800px; margin: 0 auto; }
    .price-card {
      background: var(--card-bg); border: 1px solid var(--card-border);
      border-radius: 16px; padding: 2.5rem; position: relative; overflow: hidden;
    }
    .price-card.featured {
      border-color: var(--accent);
      background: linear-gradient(135deg, rgba(0,201,167,0.08), rgba(0,163,255,0.05));
    }
    .price-card.featured::before {
      content: '⭐ پیشنهاد ویژه'; position: absolute; top: 16px; left: 16px;
      background: var(--gradient-1); color: #fff; padding: 4px 14px;
      border-radius: 20px; font-size: 0.75rem; font-weight: 700;
    }
    .price-card h3 { font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem; }
    .price-amount {
      font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem;
      background: var(--gradient-1); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .price-old { color: var(--text-muted); text-decoration: line-through; font-size: 0.9rem; }
    .price-features { list-style: none; margin: 1.5rem 0; }
    .price-features li {
      padding: 0.4rem 0; color: var(--text-muted); font-size: 0.9rem;
    }
    .price-features li::before { content: '✓ '; color: var(--accent); font-weight: 700; }

    /* Ambassador */
    .ambassador-section {
      background: linear-gradient(135deg, rgba(0,201,167,0.05), rgba(102,126,234,0.05));
      border-top: 1px solid var(--card-border); border-bottom: 1px solid var(--card-border);
    }
    .ambassador-content {
      display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center;
    }
    .ambassador-tiers { display: flex; flex-direction: column; gap: 1rem; }
    .tier {
      display: flex; align-items: center; gap: 1rem;
      background: var(--card-bg); border: 1px solid var(--card-border);
      border-radius: 12px; padding: 1rem 1.5rem;
    }
    .tier-icon { font-size: 2rem; }
    .tier-info h4 { font-weight: 700; font-size: 1rem; }
    .tier-info p { color: var(--text-muted); font-size: 0.85rem; }

    /* Footer */
    footer {
      position: relative; z-index: 1;
      border-top: 1px solid var(--card-border);
      padding: 3rem 2rem; text-align: center;
    }
    .footer-inner { max-width: 1100px; margin: 0 auto; }
    .footer-logo {
      font-size: 1.3rem; font-weight: 800; letter-spacing: 2px;
      background: var(--gradient-1); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      margin-bottom: 1rem;
    }
    footer p { color: var(--text-muted); font-size: 0.85rem; }
    .footer-links { display: flex; gap: 1.5rem; justify-content: center; margin: 1rem 0; }
    .footer-links a { color: var(--text-muted); text-decoration: none; font-size: 0.9rem; transition: color 0.3s; }
    .footer-links a:hover { color: var(--accent); }

    /* Animations */
    @keyframes fadeUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
    .fade-up { animation: fadeUp 0.8s ease-out forwards; }
    .delay-1 { animation-delay: 0.1s; opacity: 0; }
    .delay-2 { animation-delay: 0.2s; opacity: 0; }
    .delay-3 { animation-delay: 0.3s; opacity: 0; }

    /* Mobile */
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .features-grid, .steps-grid { grid-template-columns: 1fr; }
      .pricing-grid { grid-template-columns: 1fr; }
      .stats-inner { grid-template-columns: repeat(2, 1fr); }
      .ambassador-content { grid-template-columns: 1fr; gap: 2rem; }
      .hero h1 { font-size: 2rem; }
    }

    /* Hamburger mobile */
    .hamburger { display: none; background: none; border: none; color: var(--text); font-size: 1.5rem; cursor: pointer; }
    @media (max-width: 768px) { .hamburger { display: block; } }
  </style>
</head>
<body>

<div class="bg-glow"></div>
<div class="grid-pattern"></div>

<!-- Navigation -->
<nav>
  <div class="nav-inner">
    <div class="logo">A | CAP</div>
    <ul class="nav-links">
      <li><a href="#features">امکانات</a></li>
      <li><a href="#how-it-works">نحوه کار</a></li>
      <li><a href="#pricing">اشتراک</a></li>
      <li><a href="#ambassador">سفیران</a></li>
    </ul>
    <a href="https://t.me/acapitalsbot" class="nav-cta" target="_blank">شروع رایگان</a>
  </div>
</nav>

<!-- Hero -->
<section class="hero">
  <div class="hero-content">
    <div class="hero-badge fade-up">📈 اولین در ایران</div>
    <h1 class="fade-up delay-1">دستیار هوشمند <span>مدیریت سرمایه</span><br>مبتنی بر شخصیت مالی</h1>
    <p class="fade-up delay-2">ما برای شما نقشه مدیریت ثروت شخصی می‌سازیم. شخصیت مالی خود را کشف کنید و سبد سرمایه‌گذاری متناسب با خودتان بسازید.</p>
    <div class="hero-buttons fade-up delay-3">
      <a href="https://t.me/acapitalsbot" class="btn-primary" target="_blank">🤖 شروع تست رایگان</a>
      <a href="#features" class="btn-secondary">بیشتر بدانید</a>
    </div>
  </div>
</section>

<!-- Stats -->
<div class="stats-bar">
  <div class="stats-inner">
    <div class="stat-item">
      <h3>۳ دقیقه</h3>
      <p>زمان تست شخصیت</p>
    </div>
    <div class="stat-item">
      <h3>۴ تیپ</h3>
      <p>شخصیت سرمایه‌گذاری</p>
    </div>
    <div class="stat-item">
      <h3>۱۰۰٪</h3>
      <p>شخصی‌سازی شده</p>
    </div>
    <div class="stat-item">
      <h3>رایگان</h3>
      <p>تست شخصیت مالی</p>
    </div>
  </div>
</div>

<!-- Features -->
<section id="features">
  <div class="section-inner">
    <div class="section-header">
      <h2>چرا A | Cap؟</h2>
      <p>ما باور داریم هیچ نسخه یکسانی برای همه سرمایه‌گذاران وجود ندارد</p>
    </div>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">🧠</div>
        <h3>تحلیل شخصیت مالی</h3>
        <p>با آزمون علمی، سبک سرمایه‌گذاری، میزان ریسک‌پذیری و ترکیب دارایی مناسب شما مشخص می‌شود</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">📊</div>
        <h3>سبد پیشنهادی هوشمند</h3>
        <p>سبد سرمایه‌گذاری متناسب با شخصیت مالی شما طراحی و پیشنهاد می‌شود</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">📈</div>
        <h3>A | Cap Score</h3>
        <p>امتیازدهی فرصت‌های سرمایه‌گذاری بر اساس ریسک، بازده، روند و نقدشوندگی</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🔔</div>
        <h3>سیگنال‌های اختصاصی</h3>
        <p>دریافت سیگنال‌های سرمایه‌گذاری متناسب با سطح ریسک و شخصیت مالی شما</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">💡</div>
        <h3>آموزش و راهنمایی</h3>
        <p>آموزش‌های تخصصی برای تصمیم‌گیری آگاهانه در بازارهای مالی</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🛡️</div>
        <h3>مدیریت ریسک</h3>
        <p>حفاظت از سرمایه با اصول علمی مدیریت ریسک و تنوع‌بخشی سبد</p>
      </div>
    </div>
  </div>
</section>

<!-- How it works -->
<section id="how-it-works">
  <div class="section-inner">
    <div class="section-header">
      <h2>چگونه شروع کنم؟</h2>
      <p>در سه مرحله ساده، مسیر سرمایه‌گذاری خود را کشف کنید</p>
    </div>
    <div class="steps-grid">
      <div class="step-card">
        <div class="step-num">۱</div>
        <h3>تست شخصیت مالی</h3>
        <p>در کمتر از ۳ دقیقه آزمون را انجام دهید و شخصیت سرمایه‌گذاری خود را بشناسید</p>
      </div>
      <div class="step-card">
        <div class="step-num">۲</div>
        <h3>دریافت نقشه سرمایه</h3>
        <p>سبد پیشنهادی، درصد تخصیص دارایی و راهکارهای شخصی‌سازی شده دریافت کنید</p>
      </div>
      <div class="step-card">
        <div class="step-num">۳</div>
        <h3>شروع سرمایه‌گذاری</h3>
        <p>با اشتراک ACAP Plus به تحلیل‌ها، سیگنال‌ها و فرصت‌های اختصاصی دسترسی پیدا کنید</p>
      </div>
    </div>
  </div>
</section>

<!-- Pricing -->
<section id="pricing">
  <div class="section-inner">
    <div class="section-header">
      <h2>پلن‌های اشتراک ACAP Plus</h2>
      <p>دسترسی کامل به اکوسیستم هوشمند مدیریت سرمایه</p>
    </div>
    <div class="pricing-grid">
      <div class="price-card">
        <h3>اشتراک ۳ ماهه</h3>
        <div class="price-old">۲,۸۵۰,۰۰۰ تومان</div>
        <div class="price-amount">۲,۴۵۰,۰۰۰ تومان</div>
        <ul class="price-features">
          <li>۱۵٪ تخفیف</li>
          <li>تمامی سیگنال‌های سرمایه‌گذاری</li>
          <li>تحلیل‌های تخصصی تمامی بازارها</li>
          <li>سبدهای پیشنهادی</li>
        </ul>
      </div>
      <div class="price-card featured">
        <h3>اشتراک ۱۲ ماهه</h3>
        <div class="price-old">۱۳,۲۰۰,۰۰۰ تومان</div>
        <div class="price-amount">۹,۲۴۰,۰۰۰ تومان</div>
        <ul class="price-features">
          <li>۳۰٪ تخفیف — معادل ۳ ماه رایگان</li>
          <li>تمامی سیگنال‌ها و تحلیل‌ها</li>
          <li>هشدارهای لحظه‌ای</li>
          <li>دسترسی بدون محدودیت</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- Ambassador -->
<section id="ambassador" class="ambassador-section">
  <div class="section-inner">
    <div class="ambassador-content">
      <div>
        <h2 style="font-size:2rem;font-weight:800;margin-bottom:1rem;">🤝 باشگاه سفیران A | Cap</h2>
        <p style="color:var(--text-muted);font-size:1.05rem;margin-bottom:2rem;line-height:1.9;">معرفی کن، درآمد بساز! با معرفی دوستان و آشنایان، از هر فروش موفق کمیسیون دریافت کنید.</p>
        <a href="https://t.me/acapitalsbot" class="btn-primary" target="_blank">شروع همکاری</a>
      </div>
      <div class="ambassador-tiers">
        <div class="tier">
          <div class="tier-icon">🥉</div>
          <div class="tier-info">
            <h4>Partner</h4>
            <p>۳۰٪ کمیسیون — ۰ تا ۱۰ فروش</p>
          </div>
        </div>
        <div class="tier">
          <div class="tier-icon">🥈</div>
          <div class="tier-info">
            <h4>Silver Partner</h4>
            <p>۳۵٪ کمیسیون — ۱۰ تا ۵۰ فروش</p>
          </div>
        </div>
        <div class="tier">
          <div class="tier-icon">🥇</div>
          <div class="tier-info">
            <h4>Gold Partner</h4>
            <p>۴۰٪ کمیسیون — ۵۰ تا ۲۰۰ فروش</p>
          </div>
        </div>
        <div class="tier">
          <div class="tier-icon">👑</div>
          <div class="tier-info">
            <h4>Ambassador</h4>
            <p>۴۵٪ کمیسیون — بیش از ۲۰۰ فروش</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Footer -->
<footer>
  <div class="footer-inner">
    <div class="footer-logo">A | CAP</div>
    <p>اولین دستیار مدیریت سرمایه مبتنی بر شخصیت مالی</p>
    <div class="footer-links">
      <a href="https://t.me/ecobori" target="_blank">📢 کانال تلگرام</a>
      <a href="https://t.me/acapitalsbot" target="_blank">🤖 ربات تلگرام</a>
      <a href="https://t.me/a_cap_support" target="_blank">☎️ پشتیبانی</a>
    </div>
    <p style="margin-top:1.5rem;">© 2026 A | Cap — تمامی حقوق محفوظ است</p>
  </div>
</footer>

</body>
</html>`;
  }
}
