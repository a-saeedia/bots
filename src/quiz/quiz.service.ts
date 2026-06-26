import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { SheetsService } from '../sheets/sheets.service';
import { Inject, forwardRef } from '@nestjs/common';
import { QUIZ_QUESTIONS, CONTACT_STEPS } from './quiz-questions';
import {
  calculateScore,
  classifyInvestor,
  getPortfolioRecommendation,
  getExpectedMaxDrawdown,
  getInvestorTypeDescription,
  formatPortfolioString,
  QuizScores,
} from './quiz-logic';

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram: TelegramService,
    private readonly sheetsService: SheetsService,
  ) {}

  /** Platform identifier used to scope all DB queries */
  private get platform(): string {
    return this.telegram.getPlatform();
  }

  /** Compound unique where for telegram_user */
  private userWhere(telegramId: string) {
    return { telegram_id_platform: { telegram_id: telegramId, platform: this.platform } };
  }

  // ── Message tracking helpers ──
  private async trackMessage(telegramId: string, messageId: number): Promise<void> {
    try {
      const user = await this.prisma.telegram_user.findUnique({ where: this.userWhere(telegramId) });
      if (!user) return;
      const ids: number[] = JSON.parse(user.message_ids || '[]');
      ids.push(messageId);
      await this.prisma.telegram_user.update({
        where: this.userWhere(telegramId),
        data: { message_ids: JSON.stringify(ids) },
      });
    } catch { /* ignore */ }
  }

  private async clearTrackedMessages(telegramId: string, chatId: number): Promise<void> {
    try {
      const user = await this.prisma.telegram_user.findUnique({ where: this.userWhere(telegramId) });
      if (!user) return;
      const ids: number[] = JSON.parse(user.message_ids || '[]');
      await this.telegram.deleteMessages(chatId, ids);
      await this.prisma.telegram_user.update({
        where: this.userWhere(telegramId),
        data: { message_ids: '[]' },
      });
    } catch { /* ignore */ }
  }

  private async sendAndTrack(telegramId: string, chatId: number, text: string, replyMarkup?: any): Promise<any> {
    const result = await this.telegram.sendMessage(chatId, text, replyMarkup);
    if (result?.result?.message_id) {
      await this.trackMessage(telegramId, result.result.message_id);
    }
    return result;
  }

  // ── Generate unique referral code ──
  private generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  // ── /start ──
  async handleStart(userId: number, chatId: number, firstName: string, lastName: string, username: string, startPayload?: string): Promise<void> {
    const telegramId = userId.toString();
    this.logger.log(`handleStart: user=${telegramId} platform=${this.platform} payload=${startPayload || 'none'}`);
    await this.prisma.ensureConnection();

    const existing = await this.prisma.telegram_user.findUnique({ where: this.userWhere(telegramId) });
    const isNewUser = !existing;

    await this.prisma.telegram_user.upsert({
      where: this.userWhere(telegramId),
      update: { first_name: firstName, last_name: lastName, username, start_payload: startPayload || null },
      create: {
        telegram_id: telegramId, platform: this.platform,
        first_name: firstName, last_name: lastName, username,
        current_step: 'check_join',
        referral_code: this.generateReferralCode(),
        start_payload: startPayload || null,
      },
    });

    // Assign referral code if missing (for existing users)
    if (existing && !existing.referral_code) {
      await this.prisma.telegram_user.update({
        where: this.userWhere(telegramId),
        data: { referral_code: this.generateReferralCode() },
      });
    }

    // Track referral — only if this user has never been referred before (one-time, cross-platform)
    if (startPayload?.startsWith('ref_')) {
      const refCode = startPayload.replace('ref_', '');
      this.logger.log(`Referral check: user=${telegramId} refCode=${refCode}`);
      try {
        const currentUser = await this.prisma.telegram_user.findUnique({ where: this.userWhere(telegramId) });
        this.logger.log(`Referral check: currentUser found=${!!currentUser} referred_by=${currentUser?.referred_by || 'null'}`);
        if (currentUser && !currentUser.referred_by) {
          const referrer = await this.prisma.telegram_user.findUnique({ where: { referral_code: refCode } });
          this.logger.log(`Referral check: referrer found=${!!referrer} referrer_id=${referrer?.telegram_id || 'null'} self=${referrer?.telegram_id === telegramId}`);
          if (referrer && referrer.telegram_id !== telegramId) {
            await this.prisma.telegram_user.update({
              where: this.userWhere(telegramId),
              data: { referred_by: refCode },
            });
            await this.prisma.telegram_user.update({
              where: { referral_code: refCode },
              data: { referral_count: { increment: 1 } },
            });
            this.logger.log(`Referral SUCCESS: ${telegramId} (${this.platform}) referred by ${referrer.telegram_id} (code: ${refCode})`);
          }
        }
      } catch (err) {
        this.logger.error(`Referral tracking failed for user=${telegramId}: ${err}`);
      }
    }

    // Skip channel join check for platforms that don't require it (e.g. Bale)
    if (this.telegram.shouldRequireChannelJoin()) {
      const isMember = await this.telegram.checkMembership(userId);
      if (!isMember) {
        await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { current_step: 'check_join' } });
        await this.telegram.sendMessage(chatId,
          `👋 سلام <b>${firstName}</b>!\n\nبه <b>A | Cap</b> خوش آمدید.\n\nبرای استفاده از ربات، ابتدا باید در کانال ما عضو شوید:\n\nپس از عضویت، روی «عضو شدم ✅» کلیک کنید.`,
          { inline_keyboard: [
            [{ text: '📢 عضویت در کانال', url: this.telegram.getChannelLink() }],
            [{ text: '✅ عضو شدم', callback_data: 'check_join' }],
          ] },
        );
        return;
      }
    }
    await this.showMainMenu(userId, chatId);
  }

  // ── Main Menu ──
  async showMainMenu(userId: number, chatId: number, editMessageId?: number): Promise<void> {
    const telegramId = userId.toString();
    const user = await this.prisma.telegram_user.findUnique({ where: this.userWhere(telegramId) });
    await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { current_step: 'main_menu', message_ids: '[]' } });

    let greeting = `📈 <b>A | Cap</b>\n\n<i>ما برای شما نقشه مدیریت ثروت شخصی میسازیم</i>`;
    if (user?.quiz_completed && user.total_score !== null) {
      const scoreBar = '█'.repeat(Math.round(user.total_score / 10)) + '░'.repeat(10 - Math.round(user.total_score / 10));
      greeting += `\n\n━━━━━━━━━━━━━━\n📊 امتیاز شما: <b>${user.total_score}/100</b>  [${scoreBar}]\n🏷 نوع: <b>${this.investorTypePersian(user.investor_type || '')}</b>\n🔄 آزمون‌ها: <b>${user.quiz_count}</b>\n━━━━━━━━━━━━━━`;
    }
    greeting += `\n\nیکی از گزینه‌ها را انتخاب کنید:`;

    const kb: any[][] = [
      [{ text: '📝 تست شخصیت مالی', callback_data: 'start_quiz' }],
    ];
    if (user?.quiz_completed) {
      kb.push([{ text: '📈 مشاهده نتایج قبلی', callback_data: 'view_results' }]);
    }
    kb.push(
      [{ text: '🚀 A | Cap Plus➕', callback_data: 'acap_plus' }],
      [{ text: '🔗 لینک دعوت من', callback_data: 'my_referral' }],
      [{ text: '🤝 سفیران A | Cap', callback_data: 'ambassador_menu' }],
      [{ text: 'ℹ️ درباره ما', callback_data: 'about_us' }, { text: '👥 بنیان‌گذاران', callback_data: 'founders' }],
      [{ text: '📊 A | Cap Score', callback_data: 'acap_score' }],
      [{ text: '💡 راهنمای سرمایه‌گذاری', callback_data: 'acap_howto' }],
      [{ text: '📜 قوانین و مقررات', callback_data: 'rules' }],
      [{ text: '🌐 وبسایت A | Cap', web_app: { url: this.getWebAppUrl() } }],
    );

    if (editMessageId) {
      await this.telegram.editMessage(chatId, editMessageId, greeting, { inline_keyboard: kb });
    } else {
      await this.telegram.sendMessage(chatId, greeting, { inline_keyboard: kb });
    }
  }

  private getWebAppUrl(): string {
    const origin = process.env.APP_ORIGIN?.replace(/\/$/, '') || 'https://telegram-quiz-bot-sinhua.abacusai.app';
    return `${origin}/webapp`;
  }

  private investorTypePersian(type: string): string {
    const m: Record<string, string> = {
      capital_protector: '🟢 محافظ سرمایه',
      balanced_investor: '🔵 متعادل',
      growth_investor: '🟠 رشدگرا',
      opportunity_seeker: '🔴 فرصت‌جو',
    };
    return m[type] || type;
  }

  // ── Callback handler ──
  async handleCallback(userId: number, chatId: number, messageId: number, data: string, queryId: string): Promise<void> {
    const telegramId = userId.toString();

    // ─ Check join ─
    if (data === 'check_join') {
      const isMember = await this.telegram.checkMembership(userId);
      if (isMember) {
        await this.telegram.editMessage(chatId, messageId, `<b>✅ عضویت تایید شد!</b>`);
        await this.showMainMenu(userId, chatId);
      } else {
        await this.telegram.answerCallbackQuery(queryId, '❌ هنوز عضو کانال نشده‌اید!', true);
      }
      return;
    }

    if (data === 'main_menu') {
      // Delete any tracked messages (founders photo, etc.)
      await this.clearTrackedMessages(telegramId, chatId);
      // Also delete the message that triggered this (the back button message)
      await this.telegram.deleteMessage(chatId, messageId);
      await this.showMainMenu(userId, chatId);
      return;
    }

    // ─ Start quiz ─
    if (data === 'start_quiz') {
      const user = await this.prisma.telegram_user.findUnique({ where: this.userWhere(telegramId) });
      await this.prisma.quiz_response.deleteMany({ where: { telegram_id: telegramId, platform: this.platform } });
      await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { message_ids: '[]' } });
      await this.trackMessage(telegramId, messageId);

      const hasValidName = user?.full_name && this.isValidName(user.full_name);
      const hasPhone = !!user?.phone_number;

      if (hasValidName && hasPhone && user?.age_range && user?.capital_amount) {
        await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { current_step: 'quiz_q1', quiz_completed: false } });
        await this.telegram.editMessage(chatId, messageId, `📝 <b>${user.full_name}</b> عزیز، آزمون جدید شروع شد!`);
        await this.sendQuizQuestion(telegramId, chatId, 0);
      } else if (hasValidName && hasPhone) {
        await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { current_step: 'contact_age', quiz_completed: false } });
        const ageStep = CONTACT_STEPS[2];
        await this.telegram.editMessage(chatId, messageId, `📋 <b>${user.full_name}</b> عزیز، چند سوال کوتاه:`);
        const r = await this.telegram.sendMessage(chatId, ageStep.prompt, {
          inline_keyboard: ageStep.options!.map((opt) => [{ text: opt, callback_data: `age_${opt}` }]),
        });
        if (r?.result?.message_id) await this.trackMessage(telegramId, r.result.message_id);
      } else {
        await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { current_step: 'contact_name', quiz_completed: false } });
        await this.telegram.editMessage(chatId, messageId, `📋 <b>برای شروع آزمون، لطفاً اطلاعات زیر را وارد کنید:</b>\n\n${CONTACT_STEPS[0].prompt}`);
      }
      return;
    }

    // ─ About us ─
    if (data === 'about_us') {
      await this.telegram.editMessage(chatId, messageId,
        `<b>ما که هستیم؟</b>\n\n<b>A | CAP</b>📈\n\nما یک پلتفرم تخصصی مدیریت سرمایه و تحلیل بازارهای مالی هستيم که با هدف کمک به افراد برای تصمیم‌گیری آگاهانه در مسیر سرمایه‌گذاری ایجاد شده است.\n\nدر دنیایی که فرصت‌های سرمایه‌گذاری هر روز بیشتر و پیچیده‌تر می‌شوند، بسیاری از افراد نمی‌دانند چگونه سرمایه خود را میان بازارهای مختلف مانند بورس، طلا، ارز، رمزارزها، فاركس و صندوق‌های سرمایه‌گذاری مدیریت کنند. ما برای حل همین مسئله به وجود آمده‌ایم.\n\nدر A | CAP باور داریم که هیچ نسخه یکسانی برای همه سرمایه‌گذاران وجود ندارد. هر فرد شرایط مالی، اهداف، میزان ریسک‌پذیری و افق سرمایه‌گذاری متفاوتی دارد. به همین دلیل تلاش می‌کنیم با ارائه تحلیل، آموزش، ابزارهای مدیریت سرمایه و راهکارهای شخصی‌سازی‌شده، به کاربران کمک کنیم بهترین تصمیم را متناسب با شرایط خود اتخاذ کنند.\n\nماموریت ما ایجاد شفافیت در تصمیمات مالی، ارتقای سواد سرمایه‌گذاری و کمک به ساخت سبدهای سرمایه‌گذاری متعادل و هوشمند براى شما عزيزان است.\n\nما به دنبال پیش‌بینی آینده نیستیم؛ بلکه به دنبال ساختن چارچوبی هستیم که افراد بتوانند در هر شرایطی تصمیمات مالی منطقی‌تر، کم‌ریسک‌تر و آگاهانه‌تری بگیرند.\n\n<b>A | CAP</b>\nجایی است براى کسانی که می‌خواهند سرمایه‌گذاری را نه بر پایه هیجان، بلکه بر پایه تحلیل، مدیریت ریسک و برنامه ريزى بلند مدت دنبال كنند`,
        { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'main_menu' }]] },
      );
      return;
    }

    // ─ Founders (with photo) ─
    if (data === 'founders') {
      // Delete the menu message first
      await this.telegram.deleteMessage(chatId, messageId);
      // Reset tracked messages for this section
      await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { message_ids: '[]' } });

      const aliText = `<b>بنیان‌گذاران A | CAP</b>\n━━━━━━━━━━━━━━\n\n<b>Ali Borhan</b>\nFounder &amp; CEO\n\nعلی برهان کار آفرین ، تحلیلگر بازارهای مالی، مدرس سبک ICT و متخصص مدیریت سرمایه است.\n\nتمرکز اصلی او بر تحلیل جریان نقدینگی، مدیریت ریسک، رفتار بازار و طراحی استراتژی‌های سرمایه‌گذاری است. او همچنین در حوزه کارآفرینی، ساخت و توسعه کسب‌وکار، برندینگ و فروش فعال است و نگاه او فراتر از تحلیل بازار، به طراحی سیستم‌های اقتصادی و تجاری مقیاس‌پذیر گسترش دارد.\n\nپس از سال‌ها فعالیت در بازارهای مالی و آموزش معامله‌گری، ایده A | CAP را با هدف ایجاد یک سیستم هوشمند مدیریت سرمایه و سرمایه‌گذاری شخصی‌سازی‌شده بنیان‌گذاری کرد.\n\nدر A | CAP، علی برهان مسئول طراحی استراتژی‌های سرمایه‌گذاری، توسعه مدل‌های مدیریت دارایی و هدایت چشم‌انداز مالی و تجاری مجموعه است.`;

      const armanText = `<b>Arman Saeidi</b>\nCo-Founder &amp; CTO\n\nآرمان سعیدی کارآفرین، توسعه‌دهنده Full-Stack و متخصص فناوری‌های نوین، هوش مصنوعی و محصولات دیجیتال است.\n\nتمرکز او بر طراحی و توسعه زیرساخت‌های مقیاس‌پذیر، سیستم‌های هوشمند، اتوماسیون، تجربه کاربری و تبدیل ایده‌های پیچیده به محصولات قابل رشد است. او با ترکیب دانش فنی، توسعه محصول و نگاه رشد محور، نقش کلیدی در شکل‌گیری اکوسیستم A | CAP ایفا می‌کند.\n\nدر A | CAP مسئول معماری فنی پلتفرم، توسعه ابزارهای هوشمند، سیستم‌های تحلیل داده، نوآوری محصول و هدایت مسیر تکنولوژی مجموعه است.\n\nترکیب دانش مالی، فناوری و داده، هسته اصلی A | CAP را شکل می‌دهد؛ جایی که سرمایه‌گذاری و تکنولوژی در مسیر خلق ثروت هوشمند قرار می‌گیرند.`;

      // Send Ali's photo + bio
      const aliPhotoPath = this.telegram.getFounderPhotoPath('ali');
      const aliResult = await this.telegram.sendPhoto(chatId, aliPhotoPath, aliText);
      if (aliResult?.result?.message_id) {
        await this.trackMessage(telegramId, aliResult.result.message_id);
      }

      // Send Arman's photo + bio with back button
      const armanPhotoPath = this.telegram.getFounderPhotoPath('arman');
      const armanResult = await this.telegram.sendPhoto(chatId, armanPhotoPath, armanText,
        { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'main_menu' }]] },
      );
      if (armanResult?.result?.message_id) {
        await this.trackMessage(telegramId, armanResult.result.message_id);
      }
      return;
    }

    // ─ A | Cap Plus ─
    if (data === 'acap_plus') {
      await this.telegram.editMessage(chatId, messageId,
        `🚀 <b>A | Cap Plus➕</b>\n\nدسترسی کامل به اکوسیستم هوشمند مدیریت سرمایه ACAP\n\nبا فعال‌سازی اشتراک ACAP Plus به تمامی امکانات و تحلیل‌های اختصاصی دسترسی خواهید داشت:\n\n✅ تمامی سیگنال‌های سرمایه‌گذاری\n\n✅ تحلیل‌های تخصصی تمامی بازارها\n\n✅ سبدهای پیشنهادی متناسب با شرایط بازار\n\n✅ بخش روانشناسی مالی و شخصیت سرمایه‌گذاری\n\n✅ آپدیت‌ها و هشدارهای لحظه‌ای\n\n✅ دسترسی بدون محدودیت به تمامی محتواها\n\n━━━━━━━━━━━━━━\n\n 💳 <b>پلن‌های اشتراک</b>\n\n- <b>1 ماهه</b>\n💰 950,000 تومان\nبدون تخفیف\n\n━━━━━━━━━━━━━━\n\n- <b>3 ماهه</b>\n<s>2,850,000 تومان</s>\n💰 2,450,000 تومان\n🎁 15٪ تخفیف\n\n━━━━━━━━━━━━━━\n\n- <b>6 ماهه</b>\n<s>6,600,000 تومان</s>\n💰 4,950,000 تومان\n🎁 25٪ تخفیف\n\n━━━━━━━━━━━━━━\n\n- <b>12 ماهه | پیشنهاد ویژه ⭐</b>\n<s>13,200,000 تومان</s>\n💰 9,240,000 تومان\n🎁 30٪ تخفیف\n🎉 معادل 3 ماه اشتراک رایگان\n\nیعنی فقط هزینه 9 ماه را پرداخت می‌کنید و 12 ماه کامل از خدمات ACAP Plus استفاده خواهید کرد.\n\n━━━━━━━━━━━━━━\n\n📈 <b>ACAP</b>\n\nاولین دستیار مدیریت سرمایه مبتنی بر شخصیت مالی\n\nما برای شما نقشه مدیریت ثروت شخصی می‌سازیم.\n\nبرای دریافت مشاوره خرید به پشتیبانی پیام بدین👇\n\n☎️@a_cap_support\n\n━━━━━━━━━━━━━━`,
        { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'main_menu' }]] },
      );
      return;
    }

    // ─ A | Cap Score ─
    if (data === 'acap_score') {
      await this.telegram.editMessage(chatId, messageId,
        `<b>آموزش A | Cap Score</b>\n\nامتیاز A | Cap عددی از ۰ تا ۱۰۰ برای سنجش فرصت سرمایه‌گذاری است.\n\nتفسیر کلی:\n🔴 ۰-۴۰: ضعیف\n🟡 ۴۰-۶۰: متوسط\n🟢 ۶۰-۸۰: خوب\n🚀 ۸۰-۱۰۰: بسیار قدرتمند\n\n---\n🎯 A | Cap Score = 70/100\nامتیاز نهایی فرصت سرمایه‌گذاری: 70 از 100.\n شرایط کلی مثبت، ریسک کنترل‌شده و احتمال بازدهی مناسب.\n گزینه‌ای جذاب برای بررسی و ورود به واچ‌لیست.\n\n---\n⚠️ ریسک (Risk) = 50/100\nاحتمال ضرر یا نوسان شدید.\n امتیاز ۵۰: ریسک متوسط (نه کاملاً امن، نه بسیار خطرناک).\n\n---\n💰 بازده مورد انتظار = 70/100\nپتانسیل سود شناسایی‌شده.\n امتیاز ۷۰: بازدهی بالاتر از میانگین (مناسب تا جذاب).\n\n---\n📈 قدرت روند = 60/100\nقدرت حرکت قیمت در جهت فعلی.\n امتیاز ۶۰: روند مثبت در حال شکل‌گیری (هنوز به فاز بسیار قدرتمند نرسیده).\n\n---\n💸 ورود پول = 70/100\nورود سرمایه هوشمند.\n امتیاز ۷۰: ورود پول مناسب و جلب توجه بازار به دارایی.\n\n---\n🔄 نقدشوندگی = 80/100\nراحتی خرید و فروش.\n امتیاز ۸۰: معاملات روان، احتمال کم گیر افتادن در صف خرید/فروش.\n\n---\n📋 جمع‌بندی نمونه (امتیاز ۷۰)\n✅ بازده مناسب\n✅ ورود پول مثبت\n✅ نقدشوندگی بالا\n🟡 روند رو به رشد\n🟡 ریسک متوسط\n\nنتیجه: امتیاز A | Cap رابطه مستقیم با میزان ریسک شما دارد و تیم ما پرتفوليو پیشنهادى شما را در نظر ميگيرد.`,
        { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'main_menu' }]] },
      );
      return;
    }

    // ─ A | Cap howto ─
    if (data === 'acap_howto') {
      await this.telegram.editMessage(chatId, messageId,
        `<b>چگونه از فرصت‌های A | Cap استفاده کنیم؟</b>\nشخصیت سرمایه‌گذاری خود را بشناسید.\n\n👤 محافظه‌کار (حفظ سرمایه)\n70٪ کم‌ریسک | 20٪ متوسط | 10٪ پرریسک\n\n⚖️ متعادل (تعادل سود و ریسک)\n40٪ کم‌ریسک | 40٪ متوسط | 20٪ پرریسک\n\n🚀 رشدگرا (رشد سرمایه)\n20٪ کم‌ریسک | 40٪ متوسط | 40٪ پرریسک\n\n🔥 تهاجمی (حداکثر بازده)\n10٪ کم‌ریسک | 20٪ متوسط | 70٪ پرریسک\n\n⚠️ هیچ فرصتی نباید بیش از 20٪ کل سرمایه را درگیر کند.\n\nروند ورود به فرصت‌های A | Cap:\n1. ریسک فرصت را بررسی کنید\n(کم‌ریسک 🟢، متوسط 🟡، پرریسک 🔴).\n2. شخصیت مالی خود را شناسایی کنید (محافظه‌کار، متعادل، رشدگرا، تهاجمی).\n3. فقط به اندازه مجاز وارد شوید.\n❌ ممنوع: سرمایه کامل، وام، فروش دارایی‌های دیگر.\n✅ مجاز: بخشی از سرمایه متناسب با شخصیت.\n\nهدف A | Cap: ساخت سبد سرمایه‌گذاری، نه شکار تک فرصت.\nبزرگ‌ترین اشتباه: ورود با کل سرمایه (مثلاً 100 میلیون تومان) به یک فرصت.\nروش صحیح: ورود 10 تا 20 میلیون تومان و حفظ تنوع سبد.\n\nانواع فرصت‌ها در A | Cap:\n🟢 محافظ: ریسک پایین، بازده منطقی.\n🟡 متعادل: ریسک متوسط، بازده مناسب.\n🚀 رشدگرا: ریسک بالاتر، پتانسیل رشد بیشتر.\n🔥 تهاجمی: ریسک زیاد، بازده احتمالی زیاد.\n(رابطه مستقیم: بازده بالقوه بیشتر = ریسک بیشتر).\n\nیک نمونه سبد 100 میلیونی در A | Cap\n\n👤 محافظه‌کار\n40 میلیون درآمد ثابت\n30 میلیون طلا\n20 میلیون فرصت متعادل\n10 میلیون فرصت رشدگرا\n\n⸻\n\n🚀 رشدگرا\n20 میلیون درآمد ثابت\n20 میلیون طلا\n30 میلیون فرصت متعادل\n30 میلیون فرصت رشدگرا\n\n⸻\n\nهدف:\nوابسته نبودن به یک بازار یا یک فرصت.`,
        { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'main_menu' }]] },
      );
      return;
    }

    // ─ My Referral Link (Ambassador-style) ─
    if (data === 'my_referral') {
      await this.handleMyReferral(userId, chatId, messageId);
      return;
    }

    // ─ Ambassador menu ─
    if (data === 'ambassador_menu') {
      await this.showAmbassadorMenu(userId, chatId, messageId);
      return;
    }

    // ─ Ambassador leaderboard ─
    if (data === 'ambassador_leaderboard') {
      await this.showLeaderboard(userId, chatId, messageId);
      return;
    }

    // ─ Ambassador sales guide ─
    if (data === 'ambassador_guide') {
      await this.showSalesGuide(userId, chatId, messageId);
      return;
    }

    // ─ Rules ─
    if (data === 'rules') {
      await this.telegram.editMessage(chatId, messageId,
        `<b>قوانين مقررات A | Cap</b>\n\n⸻\n\n<b>افشای ریسک</b>\n\nسرمایه‌گذاری در بازارهای مالی با ریسک ذاتی فوق‌العاده بالایی همراه است. این بازارها در نگاه اول جذابیت بالایی دارند و افراد زیادی به واسطه همین جذابیت‌ها اقدام به این نوع سرمایه‌گذاری می‌کنند. اما واقعیت این است که احتمال زیان برای سرمایه‌گذاران در این بازارها وجود دارد و سرمایه‌گذاری در بلند مدت و با کسب تجربه می‌تواند احتمال کسب سود شما را بالا ببرد. با توجه به ماهیت احتمالی نوسانات بازار و احتمال زیان در کوتاه مدت سرمایه‌گذاران، باید آن قسمتی از سرمایه خود را استفاده کنند که نیاز روزمره آن‌ها نبوده و با صبر به سوددهی در بلند مدت دست یابند.\n\nهدف از مطرح کردن این حقایق، مایوس کردن افراد تازه وارد نیست، بلکه ایجاد آگاهی و دید صحیح برای اتخاذ تصمیم مناسب است. مجدداً یادآوری می‌کنیم تنها آن دسته از افراد آگاه و با تجربه که مراحل آموزش و تمرین و کسب تجربه را به خوبی پشت سر گذاشته باشند، موفق به سودآوری مداوم در این بازارها می‌شوند.\n\nبه نکات زیر توجه کنید:\n\n• اولویت ما در تیم اى كپيتال جلوگیری از زیان هموطنانمان به واسطه حضور ناآگاهانه در بازارهای مالی است.\n\n• ما سرمایه‌گذاری بر مبنای سیستم‌ها و ابزارهای معاملاتی ارائه شده توسط تیم اى كپيتال را به هیچکس به صورت قطعی و نهایی توصیه نمی‌کنیم. از آنجا که در نهایت مسئولیت هرگونه زیان یا عدم کسب سود بر عهده خود شما خواهد بود، حتماً قبل از سرمایه‌گذاری در بازارهای مختلف، در مورد عملکرد و احتمال سوددهی این بازارهای معرفی شده بررسی کافی و دقیق داشته باشید.\n\n• هرچند مطالب و نرم‌افزارهای ارائه شده توسط تیم اى كپيتال به دقت مورد بررسی قرار گرفته و قبل از انتشار از فیلترهای مختلفی عبور کرده‌اند، اما در نهایت هیچ‌کدام از آن‌ها تضمین‌کننده موفقیت سرمایه‌گذاری نخواهد بود. نرم‌افزارهای ارائه شده در حالت کلی فقط ابزاری برای کمک به سرمایه‌گذاران هستند. این ابزارها بدون مهارت کافی در مسائل فنی و روانی به هیچ عنوان مفید نخواهند بود.\n\n<b>سلب مسئولیت</b>\n\nتمام مسئولیت استفاده از مشاوره‌ها و سرمایه‌گذاری در اوراق پیشنهادی برعهده شخص مشتری می‌باشد و دریافت‌کننده خدمات مشاوره خود به ریسک‌های موجود در بازارها واقف است.\n\nاساساً خدمات مشاوره‌ای در هر زمینه‌ای صرفاً بیان راهکارهای مناسب به فرد متقاضی مشاوره بر مبنای اطلاعات دریافتی از ایشان، با انطباق بر تغییرات حاکم بر محیط مورد نظر (بازارهای مالی) می‌باشد و هیچگاه به منزله نظر نهایی و قطعی نبوده، بلکه تصمیم نهایی در عمل به راهکار مشاوره‌ای و در نهایت اقدامات مالی را شخص متقاضی اتخاذ خواهد نمود و از این حیث مسئولیت نهایی اقدامات متوجه شخص ایشان خواهد بود.`,
        { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'main_menu' }]] },
      );
      return;
    }

    // ─ View results ─
    if (data === 'view_results') {
      const user = await this.prisma.telegram_user.findUnique({
        where: this.userWhere(telegramId),
        include: { quiz_attempts: { orderBy: { attempt_number: 'desc' }, take: 5 } },
      });
      if (!user) return;

      let msg = `<b>📈 سابقه آزمون‌های شما</b>\n━━━━━━━━━━━━━━\n\n`;
      if (user.quiz_attempts.length > 0) {
        for (const a of user.quiz_attempts) {
          const d = new Date(a.completed_at).toLocaleDateString('fa-IR');
          const filled = Math.round((a.total_score / 100) * 10);
          const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
          msg += `🔹 آزمون ${a.attempt_number}  •  ${d}\n`;
          msg += `   ${bar}  <b>${a.total_score}/100</b>\n`;
          msg += `   ${this.investorTypePersian(a.investor_type)}\n\n`;
        }
      } else if (user.quiz_completed) {
        const filled = Math.round(((user.total_score || 0) / 100) * 10);
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
        msg += `${bar}  <b>${user.total_score}/100</b>\n`;
        msg += `${this.investorTypePersian(user.investor_type || '')}\n`;
      }

      await this.telegram.editMessage(chatId, messageId, msg, {
        inline_keyboard: [
          [{ text: '🔙 بازگشت', callback_data: 'main_menu' }],
          [{ text: '🔄 تست مجدد', callback_data: 'start_quiz' }],
        ],
      });
      return;
    }

    // ─ Age range ─
    if (data.startsWith('age_')) {
      await this.trackMessage(telegramId, messageId);
      const ageRange = data.replace('age_', '');
      await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { age_range: ageRange, current_step: 'contact_capital' } });
      const capitalStep = CONTACT_STEPS[3];
      const r = await this.telegram.sendMessage(chatId, capitalStep.prompt, {
        inline_keyboard: capitalStep.options!.map((opt) => [{ text: opt, callback_data: `capital_${opt}` }]),
      });
      if (r?.result?.message_id) await this.trackMessage(telegramId, r.result.message_id);
      return;
    }

    // ─ Capital ─
    if (data.startsWith('capital_')) {
      await this.trackMessage(telegramId, messageId);
      const capital = data.replace('capital_', '');
      await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { capital_amount: capital, current_step: 'quiz_q1' } });
      await this.sendQuizQuestion(telegramId, chatId, 0);
      return;
    }

    // ─ Quiz answers ─
    if (data.startsWith('quiz_')) {
      await this.handleQuizAnswer(userId, chatId, messageId, data);
      return;
    }

    // ─ Q13 multi-select ─
    if (data.startsWith('q13_select_')) {
      await this.handleQ13Selection(userId, chatId, messageId, data);
      return;
    }
    if (data === 'q13_done') {
      await this.handleQ13Done(userId, chatId, messageId);
      return;
    }
  }

  /** Normalize phone: 989xx→09xx, +989xx→09xx, Persian digits→Latin */
  private normalizePhone(raw: string): string {
    // Convert Persian/Arabic digits to Latin
    let phone = raw.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
                    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    phone = phone.replace(/[\s\-\+]/g, '').trim();
    // 989xxxxxxxxx → 09xxxxxxxxx
    if (phone.startsWith('98') && phone.length >= 11) {
      phone = '0' + phone.substring(2);
    }
    return phone;
  }

  /** Validate name: must be real text, not a number/single char/junk */
  private isValidName(text: string): boolean {
    const t = text.trim();
    if (t.length < 2) return false;
    // Reject if it's mostly digits (phone number as name)
    const digitCount = (t.match(/[0-9۰-۹٠-٩]/g) || []).length;
    if (digitCount > t.length * 0.5) return false;
    // Reject single punctuation / emoji-only
    if (/^[.\-_!@#$%^&*()+=\s]+$/.test(t)) return false;
    return true;
  }

  // ── Text input (contact info) ──
  async handleTextInput(userId: number, chatId: number, text: string, messageId?: number): Promise<void> {
    const telegramId = userId.toString();
    const user = await this.prisma.telegram_user.findUnique({ where: this.userWhere(telegramId) });
    if (!user) return;

    if (messageId) await this.trackMessage(telegramId, messageId);

    if (user.current_step === 'contact_name') {
      if (!this.isValidName(text)) {
        const r = await this.telegram.sendMessage(chatId, '⚠️ لطفاً نام و نام خانوادگی واقعی خود را وارد کنید.\n(حداقل ۲ حرف، بدون عدد)');
        if (r?.result?.message_id) await this.trackMessage(telegramId, r.result.message_id);
        return;
      }
      await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { full_name: text.trim(), current_step: 'contact_phone' } });
      const phoneStep = CONTACT_STEPS[1];
      const r = await this.telegram.sendMessage(chatId, phoneStep.prompt, {
        keyboard: [[{ text: '📱 ارسال شماره تلفن', request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      });
      if (r?.result?.message_id) await this.trackMessage(telegramId, r.result.message_id);
      return;
    }

    if (user.current_step === 'contact_phone') {
      // Reject manual text — force contact share button
      const r = await this.telegram.sendMessage(chatId, '⚠️ لطفاً از دکمه «📱 ارسال شماره تلفن» استفاده کنید.\nشماره تلفن باید از طریق دکمه ارسال شود.', {
        keyboard: [[{ text: '📱 ارسال شماره تلفن', request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      });
      if (r?.result?.message_id) await this.trackMessage(telegramId, r.result.message_id);
      return;
    }
  }

  // ── Contact share ──
  async handleContactShare(userId: number, chatId: number, phoneNumber: string): Promise<void> {
    const telegramId = userId.toString();
    const normalized = this.normalizePhone(phoneNumber);
    await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { phone_number: normalized, current_step: 'contact_age' } });
    await this.telegram.sendMessage(chatId, '✅ شماره ذخیره شد.', { remove_keyboard: true });
    const ageStep = CONTACT_STEPS[2];
    const r = await this.telegram.sendMessage(chatId, ageStep.prompt, {
      inline_keyboard: ageStep.options!.map((opt) => [{ text: opt, callback_data: `age_${opt}` }]),
    });
    if (r?.result?.message_id) await this.trackMessage(telegramId, r.result.message_id);
  }

  // ── Quiz question sender ──
  private async sendQuizQuestion(telegramId: string, chatId: number, questionIndex: number): Promise<void> {
    const question = QUIZ_QUESTIONS[questionIndex];
    if (!question) return;
    const total = QUIZ_QUESTIONS.length;
    const qNum = questionIndex + 1;

    if (question.key === 'q13') {
      const r = await this.telegram.sendMessage(chatId,
        `<b>سوال ${qNum} از ${total}</b>\n<i>${question.section}</i>\n\n${question.text}`,
        { inline_keyboard: [
          ...question.options.map((opt, i) => [{ text: `⬜ ${opt.text}`, callback_data: `q13_select_${i}` }]),
          [{ text: '✅ تایید انتخاب‌ها', callback_data: 'q13_done' }],
          [{ text: '🔙 انصراف', callback_data: 'main_menu' }],
        ] },
      );
      if (r?.result?.message_id) await this.trackMessage(telegramId, r.result.message_id);
      return;
    }

    const r = await this.telegram.sendMessage(chatId,
      `<b>سوال ${qNum} از ${total}</b>\n<i>${question.section}</i>\n\n${question.text}`,
      { inline_keyboard: [
        ...question.options.map((opt, i) => [{ text: `🔘 ${opt.text}`, callback_data: `quiz_${question.key}_${i}` }]),
        [{ text: '🔙 انصراف', callback_data: 'main_menu' }],
      ] },
    );
    if (r?.result?.message_id) await this.trackMessage(telegramId, r.result.message_id);
  }

  // ── Handle quiz answer ──
  private async handleQuizAnswer(userId: number, chatId: number, messageId: number, data: string): Promise<void> {
    const telegramId = userId.toString();
    const parts = data.split('_');
    const questionKey = parts[1];
    const answerIndex = parseInt(parts[2], 10);

    const questionIndex = QUIZ_QUESTIONS.findIndex((q) => q.key === questionKey);
    if (questionIndex === -1) return;
    const question = QUIZ_QUESTIONS[questionIndex];
    const option = question.options[answerIndex];
    if (!option) return;

    await this.prisma.quiz_response.upsert({
      where: { telegram_id_platform_question_key: { telegram_id: telegramId, platform: this.platform, question_key: questionKey } },
      update: { answer_value: option.text, answer_score: option.score },
      create: { telegram_id: telegramId, platform: this.platform, question_key: questionKey, answer_value: option.text, answer_score: option.score },
    });

    // Just mark answered - we'll delete all at end
    await this.telegram.editMessage(chatId, messageId, `✅ سوال ${questionIndex + 1}: ${option.text}`);

    const nextIndex = questionIndex + 1;
    if (nextIndex < QUIZ_QUESTIONS.length) {
      await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { current_step: `quiz_${QUIZ_QUESTIONS[nextIndex].key}` } });
      await this.sendQuizQuestion(telegramId, chatId, nextIndex);
    } else {
      await this.completeQuiz(userId, chatId);
    }
  }

  // ── Q13 multi-select (DB-backed) ──

  private async getQ13Selections(telegramId: string): Promise<Set<number>> {
    const user = await this.prisma.telegram_user.findUnique({ where: this.userWhere(telegramId) });
    const arr: number[] = JSON.parse(user?.q13_selections || '[]');
    return new Set(arr);
  }

  private async saveQ13Selections(telegramId: string, sel: Set<number>): Promise<void> {
    await this.prisma.telegram_user.update({
      where: this.userWhere(telegramId),
      data: { q13_selections: JSON.stringify([...sel]) },
    });
  }

  private async handleQ13Selection(userId: number, chatId: number, messageId: number, data: string): Promise<void> {
    const telegramId = userId.toString();
    const index = parseInt(data.replace('q13_select_', ''), 10);
    const question = QUIZ_QUESTIONS.find((q) => q.key === 'q13')!;

    const sel = await this.getQ13Selections(telegramId);
    const noneIdx = question.options.length - 1;

    if (index === noneIdx) { sel.clear(); sel.add(noneIdx); }
    else { sel.delete(noneIdx); sel.has(index) ? sel.delete(index) : sel.add(index); }

    await this.saveQ13Selections(telegramId, sel);

    const qIndex = QUIZ_QUESTIONS.findIndex((q) => q.key === 'q13');
    const total = QUIZ_QUESTIONS.length;

    await this.telegram.editMessage(chatId, messageId,
      `<b>سوال ${qIndex + 1} از ${total}</b>\n<i>${question.section}</i>\n\n${question.text}`,
      { inline_keyboard: [
        ...question.options.map((opt, i) => [{ text: `${sel.has(i) ? '✅' : '⬜'} ${opt.text}`, callback_data: `q13_select_${i}` }]),
        [{ text: '✅ تایید انتخاب‌ها', callback_data: 'q13_done' }],
        [{ text: '🔙 انصراف', callback_data: 'main_menu' }],
      ] },
    );
  }

  private async handleQ13Done(userId: number, chatId: number, messageId: number): Promise<void> {
    const telegramId = userId.toString();
    const question = QUIZ_QUESTIONS.find((q) => q.key === 'q13')!;
    const sel = await this.getQ13Selections(telegramId);
    const noneIdx = question.options.length - 1;
    let marketCount = 0;
    const texts: string[] = [];
    sel.forEach((i) => { if (i !== noneIdx) marketCount++; texts.push(question.options[i].text); });

    await this.prisma.quiz_response.upsert({
      where: { telegram_id_platform_question_key: { telegram_id: telegramId, platform: this.platform, question_key: 'q13' } },
      update: { answer_value: texts.join(', '), answer_score: marketCount },
      create: { telegram_id: telegramId, platform: this.platform, question_key: 'q13', answer_value: texts.join(', '), answer_score: marketCount },
    });

    await this.telegram.editMessage(chatId, messageId, `✅ سوال ${QUIZ_QUESTIONS.findIndex((q) => q.key === 'q13') + 1}: ${texts.join('، ')}`);
    await this.saveQ13Selections(telegramId, new Set());

    const qIndex = QUIZ_QUESTIONS.findIndex((q) => q.key === 'q13');
    const nextIndex = qIndex + 1;
    if (nextIndex < QUIZ_QUESTIONS.length) {
      await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { current_step: `quiz_${QUIZ_QUESTIONS[nextIndex].key}` } });
      await this.sendQuizQuestion(telegramId, chatId, nextIndex);
    } else {
      await this.completeQuiz(userId, chatId);
    }
  }

  // ── Ambassador: My Referral Link (forwardable single message) ──
  private async handleMyReferral(userId: number, chatId: number, messageId: number): Promise<void> {
    const telegramId = userId.toString();
    let user = await this.prisma.telegram_user.findUnique({ where: this.userWhere(telegramId) });
    if (user && !user.referral_code) {
      await this.prisma.telegram_user.update({ where: this.userWhere(telegramId), data: { referral_code: this.generateReferralCode() } });
      user = await this.prisma.telegram_user.findUnique({ where: this.userWhere(telegramId) });
    }
    const botUsername = this.platform === 'bale' ? 'acapitalbot' : 'acapitalsbot';
    const refLink = this.platform === 'bale'
      ? `https://ble.ir/${botUsername}?start=ref_${user?.referral_code}`
      : `https://t.me/${botUsername}?start=ref_${user?.referral_code}`;

    // Single forwardable message — no photo, clean text
    const text = [
      `🚀 کمپین سفیران ACAP`,
      ``,
      `تو فقط معرفی نمی‌کنی…`,
      `تو یک سیستم درآمد می‌سازی 💰`,
      ``,
      `━━━━━━━━━━━━━━`,
      ``,
      `🧠 اول شخصیت مالی خودتو کشف کن`,
      ``,
      `در کمتر از ۳ دقیقه:`,
      `✅ سبک سرمایه‌گذاری خودت`,
      `✅ میزان ریسک‌پذیری`,
      `✅ ترکیب دارایی مناسب`,
      `✅ نقشه رشد مالی شخصی`,
      ``,
      `━━━━━━━━━━━━━━`,
      ``,
      `💰 درآمد از معرفی ACAP`,
      ``,
      `بعد از تست، لینک اختصاصی خودتو می‌گیری.`,
      `هر کسی که وارد بشه:`,
      `🔹 در پنل تو ثبت میشه`,
      `🔹 تست رو انجام میده`,
      `🔹 اگر خرید کنه → تو درآمد می‌گیری 💸`,
      ``,
      `━━━━━━━━━━━━━━`,
      ``,
      `💸 کمیسیون: 30% از هر فروش`,
      `📦 اشتراک ۳ ماهه: 2,450,000 تومان`,
      `💰 سود تو: 735,000 تومان`,
      ``,
      `👥 10 فروش → 7.35 میلیون`,
      `👥 50 فروش → 36.75 میلیون`,
      `👥 100 فروش → 73+ میلیون`,
      ``,
      `━━━━━━━━━━━━━━`,
      ``,
      `🔗 لینک اختصاصی شما:`,
      ``,
      `${refLink}`,
      ``,
      `━━━━━━━━━━━━━━`,
      `⏱️ تست: کمتر از ۳ دقیقه`,
      `💡 نتیجه: شناخت + درآمد`,
      ``,
      `📈 A | CAP — اولین دستیار مدیریت سرمایه بر اساس شخصیت مالی`,
    ].join('\n');

    // Clean delete + send forwardable message
    await this.clearTrackedMessages(telegramId, chatId);
    await this.telegram.deleteMessage(chatId, messageId);

    const r = await this.sendAndTrack(telegramId, chatId, text, {
      inline_keyboard: [
        [{ text: '🤝 سفیران A | Cap', callback_data: 'ambassador_menu' }],
        [{ text: '🔙 بازگشت', callback_data: 'main_menu' }],
      ],
    });
  }

  // ── Ambassador: Menu ──
  private async showAmbassadorMenu(userId: number, chatId: number, messageId: number): Promise<void> {
    const telegramId = userId.toString();
    const user = await this.prisma.telegram_user.findUnique({ where: this.userWhere(telegramId) });
    const referralCount = user?.referral_count || 0;
    const tier = this.getAmbassadorTier(referralCount);

    const text = [
      `🤝 سفیران A | Cap`,
      ``,
      `👤 ${user?.full_name || user?.first_name || 'کاربر'}`,
      `🏅 سطح: ${tier.name}`,
      `💰 نرخ کمیسیون: ${Math.round(tier.commission * 100)}%`,
      `👥 دعوت‌شده‌ها: ${referralCount} نفر`,
      ``,
      `━━━━━━━━━━━━━━`,
      ``,
      `یکی از گزینه‌ها را انتخاب کنید:`,
    ].join('\n');

    // Clean previous messages then show menu
    await this.clearTrackedMessages(telegramId, chatId);
    await this.telegram.deleteMessage(chatId, messageId);
    const r = await this.sendAndTrack(telegramId, chatId, text, {
      inline_keyboard: [
        [{ text: '🏆 فروشندگان برتر', callback_data: 'ambassador_leaderboard' }],
        [{ text: '📋 دستور عمل فروش', callback_data: 'ambassador_guide' }],
        [{ text: '🔗 لینک دعوت من', callback_data: 'my_referral' }],
        [{ text: '🔙 بازگشت', callback_data: 'main_menu' }],
      ],
    });
  }

  // ── Ambassador: Leaderboard ──
  private async showLeaderboard(userId: number, chatId: number, messageId: number): Promise<void> {
    const telegramId = userId.toString();

    let text = `🏆 فروشندگان برتر ACAP\n\n━━━━━━━━━━━━━━\n\n`;

    try {
      const entries = await this.sheetsService.getLeaderboard(10);
      if (entries.length === 0) {
        text += `هنوز اطلاعاتی ثبت نشده است.\n\nاولین سفیر ACAP باش! 🚀`;
      } else {
        const medals = ['🥇', '🥈', '🥉'];
        entries.forEach((entry, idx) => {
          const medal = idx < 3 ? medals[idx] : `${idx + 1}.`;
          const tier = this.getAmbassadorTier(entry.sales);
          text += `${medal} ${entry.name}\n`;
          text += `   📊 فروش: ${entry.sales} | 👥 دعوت: ${entry.referrals}\n`;
          if (entry.commission > 0) {
            text += `   💰 درآمد: ${entry.commission.toLocaleString()} تومان\n`;
          }
          text += `   🏅 ${tier.name}\n\n`;
        });
      }
    } catch (error) {
      this.logger.error(`Leaderboard error: ${error}`);
      text += `❌ خطا در دریافت اطلاعات. لطفاً بعداً تلاش کنید.`;
    }

    await this.clearTrackedMessages(telegramId, chatId);
    await this.telegram.deleteMessage(chatId, messageId);
    await this.sendAndTrack(telegramId, chatId, text, {
      inline_keyboard: [
        [{ text: '🔙 بازگشت به سفیران', callback_data: 'ambassador_menu' }],
        [{ text: '🔙 بازگشت به منو', callback_data: 'main_menu' }],
      ],
    });
  }

  // ── Ambassador: Sales Guide ──
  private async showSalesGuide(userId: number, chatId: number, messageId: number): Promise<void> {
    const telegramId = userId.toString();

    await this.clearTrackedMessages(telegramId, chatId);
    await this.telegram.deleteMessage(chatId, messageId);

    // User's exact guide text
    const guideText = `🎁 کمیسیون فروش\n\nبه ازای هر خرید موفق اشتراک ACAP Plus:\n\n💸 30٪ مبلغ پرداختی به حساب همکاری تو اضافه می‌شود.\n\nهرچه افراد بیشتری معرفی کنی، درآمد بیشتری خواهی داشت.\n\nمثال مبلغی👇\n\n💰 قیمت اشتراک ۳ ماهه ACAP Plus:\n\n2,450,000 تومان\n\n💰 735 هزار تومان کمیسیون برای تو\n\n👥 10 فروش = 7.35 میلیون تومان درآمد\n\n👥 20 فروش = 14.7 میلیون تومان درآمد\n\n👥 50 فروش = 36.75 میلیون تومان درآمد\n\nهرچه افراد بیشتری معرفی کنی، درآمد بیشتری خواهی داشت.\n\n━━━━━━━━━━━━━━\n\n 🏆 باشگاه سفیران ACAP\n\n🥉 Partner\n\n0 تا 10 فروش موفق\n\n30٪ کمیسیون\n\nــــــــــــــــــــــ\n\n🥈 Silver Partner\n\n10 تا 50 فروش موفق\n\n35٪ کمیسیون\n\n یک ماه اشتراک رایگان ACAP Plus\n\nــــــــــــــــــــــ\n\n🥇 Gold Partner\n\n50 تا 200 فروش موفق\n\n40٪ کمیسیون\n\n اشتراک یکسال رایگان ACAP Plus\n\n نشان ویژه سفیر طلایی\n\nــــــــــــــــــــــ\n\n👑 Ambassador\n\nبیش از 200 فروش موفق\n\n45٪ کمیسیون\n\n عضویت ویژه سفیران ACAP\n\n مزایای اختصاصی و کمپین‌های ویژه\n\n━━━━━━━━━━━━━━\n\n 🎯 جوایز دعوت فعال\n\nعلاوه بر کمیسیون فروش:\n\n👥 5 دعوت فعال\n\n🎁 یک هفته اشتراک رایگان\n\n👥 10 دعوت فعال\n\n💎 یک ماه اشتراک رایگان\n\n👥 20 دعوت فعال\n\n💎 دو ماه اشتراک رایگان\n\n👥 50 دعوت فعال\n\n👑 یک سال اشتراک رایگان ACAP Plus\n\n━━━━━━━━━━━━━━\n\n 📊 داشبورد اختصاصی سفیران\n\nدر پنل خود مشاهده کن:\n\n✅ تعداد کلیک لینک\n\n✅ تعداد ثبت‌نام\n\n✅ تعداد تست‌های تکمیل‌شده\n\n✅ تعداد خریدهای موفق\n\n✅ درآمد قابل برداشت\n\n✅ درآمد کل\n\n━━━━━━━━━━━━━━\n\n🚀 همین حالا شروع کن\n\n⏱️ زمان انجام تست: کمتر از ۳ دقیقه\n\n🎯 نتیجه: شناخت شخصیت مالی و فرصت کسب درآمد\n\nشخصیت مالی خودت را رایگان کشف کن و به جمع سفیران ACAP بپیوند.\n\n«اولین دستیار مدیریت سرمایه مبتنی بر شخصیت مالی»\n\nما برای شما نقشه مدیریت ثروت شخصی می‌سازیم`;

    // Send infographic photo first (no caption), then reply to it with full text + buttons
    // This creates a visually connected pair since Telegram caption limit is 1024 chars
    const infographicPath = this.telegram.getImagePath('ambassador_infographic.jpg');
    const photoResult = await this.telegram.sendPhoto(chatId, infographicPath, '');
    const photoMsgId = photoResult?.result?.message_id;
    if (photoMsgId) await this.trackMessage(telegramId, photoMsgId);

    // Reply to the photo with the full text — creates a linked message pair
    const replyMarkup = {
      inline_keyboard: [
        [{ text: '🔗 لینک دعوت من', callback_data: 'my_referral' }],
        [{ text: '🔙 بازگشت به سفیران', callback_data: 'ambassador_menu' }],
        [{ text: '🔙 بازگشت به منو', callback_data: 'main_menu' }],
      ],
    };
    const textResult = await this.telegram.sendMessage(chatId, guideText, replyMarkup, photoMsgId);
    if (textResult?.result?.message_id) await this.trackMessage(telegramId, textResult.result.message_id);
  }

  // ── Ambassador tier helper ──
  private getAmbassadorTier(salesOrReferrals: number): { name: string; commission: number } {
    if (salesOrReferrals >= 200) return { name: '👑 Ambassador', commission: 0.45 };
    if (salesOrReferrals >= 50) return { name: '🥇 Gold Partner', commission: 0.40 };
    if (salesOrReferrals >= 10) return { name: '🥈 Silver Partner', commission: 0.35 };
    return { name: '🥉 Partner', commission: 0.30 };
  }

  // ── Complete quiz ──
  private async completeQuiz(userId: number, chatId: number): Promise<void> {
    const telegramId = userId.toString();

    const responses = await this.prisma.quiz_response.findMany({ where: { telegram_id: telegramId, platform: this.platform } });
    const scores: QuizScores = {};
    responses.forEach((r: any) => { scores[r.question_key as keyof QuizScores] = r.answer_score; });

    const totalScore = calculateScore(scores);
    const investorType = classifyInvestor(totalScore);
    const portfolio = getPortfolioRecommendation(investorType);
    const maxDrawdown = getExpectedMaxDrawdown(investorType);
    const description = getInvestorTypeDescription(investorType);

    const user = await this.prisma.telegram_user.findUnique({ where: this.userWhere(telegramId) });
    const newCount = (user?.quiz_count || 0) + 1;

    await this.prisma.telegram_user.update({
      where: this.userWhere(telegramId),
      data: { quiz_completed: true, total_score: totalScore, investor_type: investorType, current_step: 'completed', quiz_count: newCount, synced_to_sheet: false },
    });

    await this.prisma.quiz_attempt.upsert({
      where: { telegram_id_platform_attempt_number: { telegram_id: telegramId, platform: this.platform, attempt_number: newCount } },
      update: { total_score: totalScore, investor_type: investorType },
      create: { telegram_id: telegramId, platform: this.platform, attempt_number: newCount, total_score: totalScore, investor_type: investorType },
    });

    // ── Delete all quiz conversation messages ──
    await this.clearTrackedMessages(telegramId, chatId);

    // ── Send clean result (forwardable with bot footer) ──
    const userName = user?.full_name || user?.first_name || 'کاربر';
    const scoreBar = '█'.repeat(Math.round(totalScore / 10)) + '░'.repeat(10 - Math.round(totalScore / 10));
    const resultMessage = [
      `📊 <b>نتیجه آزمون سنجش ریسک A | Cap</b>`,
      ``,
      `${userName} عزیز، نتیجه آزمون شما:`,
      ``,
      `🎯 <b>امتیاز: ${totalScore} از 100</b>  [${scoreBar}]`,
      `🔢 <b>آزمون شماره: ${newCount}</b>`,
      ``,
      description,
      ``,
      `━━━━━━━━━━━━━━`,
      ``,
      `💼 <b>سبد پیشنهادی:</b>`,
      ``,
      formatPortfolioString(portfolio),
      ``,
      `📉 <b>حداکثر افت قابل انتظار: ${maxDrawdown}</b>`,
      ``,
      `━━━━━━━━━━━━━━`,
      `🤖 ${this.platform === 'bale' ? '@acapitalbot' : '@acapitalsbot'}`,
      ``,
      `📈 A | CAP — مدیریت هوشمند سرمایه`,
    ].join('\n');

    await this.telegram.sendMessage(chatId, resultMessage, {
      inline_keyboard: [
        [{ text: '🚀 A | Cap Plus➕', callback_data: 'acap_plus' }],
        [{ text: '📈 سابقه آزمون‌ها', callback_data: 'view_results' }],
        [{ text: '🔙 بازگشت به منو', callback_data: 'main_menu' }],
        [{ text: '🔄 تست مجدد', callback_data: 'start_quiz' }],
      ],
    });

    // Sync to Google Sheets (non-blocking)
    this.sheetsService.syncUserToSheet(telegramId, this.platform).catch((err) => {
      this.logger.warn(`Sheet sync: ${err.message}`);
    });
  }
}
