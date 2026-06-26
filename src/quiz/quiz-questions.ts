/**
 * All 14 quiz questions with their options and scoring
 */

export interface QuizOption {
  text: string;
  score: number;
}

export interface QuizQuestion {
  key: string;
  section: string;
  text: string;
  options: QuizOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    key: 'q1',
    section: 'بخش اول: تخصیص سرمایه',
    text: 'اگر امروز 100 میلیون تومان پول نقد داشته باشید، چه می‌کنید؟',
    options: [
      { text: 'همه را سرمایه‌گذاری می‌کنم', score: 0 },
      { text: 'بخش زیادی را سرمایه‌گذاری می‌کنم', score: 1 },
      { text: 'بخشی را سرمایه‌گذاری و بخشی را نگه می‌دارم', score: 2 },
      { text: 'بیشتر آن را نقد نگه می‌دارم', score: 3 },
      { text: 'ترجیح می‌دهم در بانک بماند', score: 4 },
    ],
  },
  {
    key: 'q2',
    section: 'بخش اول: تخصیص سرمایه',
    text: 'منبع درآمد شما چقدر پایدار است؟',
    options: [
      { text: 'کاملاً پایدار', score: 0 },
      { text: 'نسبتاً پایدار', score: 1 },
      { text: 'متوسط', score: 2 },
      { text: 'ناپایدار', score: 3 },
      { text: 'بسیار ناپایدار', score: 4 },
    ],
  },
  {
    key: 'q3',
    section: 'بخش اول: تخصیص سرمایه',
    text: 'اگر ۶ ماه درآمد نداشته باشید:',
    options: [
      { text: 'هیچ مشکلی ندارم', score: 0 },
      { text: 'به سختی مدیریت می‌کنم', score: 1 },
      { text: 'بخشی از سرمایه را مصرف می‌کنم', score: 2 },
      { text: 'دچار مشکل می‌شوم', score: 3 },
      { text: 'بحران مالی خواهم داشت', score: 4 },
    ],
  },
  {
    key: 'q4',
    section: 'بخش دوم: تحمل ریسک',
    text: 'اگر سبد شما در یک ماه 10٪ افت کند:',
    options: [
      { text: 'خرید بیشتری انجام می‌دهم', score: 0 },
      { text: 'نگهداری می‌کنم', score: 1 },
      { text: 'کمی نگران می‌شوم', score: 2 },
      { text: 'بخشی را می‌فروشم', score: 3 },
      { text: 'سریع خارج می‌شوم', score: 4 },
    ],
  },
  {
    key: 'q5',
    section: 'بخش دوم: تحمل ریسک',
    text: 'بیشترین ضرر قابل تحمل شما چقدر است؟',
    options: [
      { text: '5%', score: 0 },
      { text: '10%', score: 1 },
      { text: '20%', score: 2 },
      { text: '30%', score: 3 },
      { text: 'بیش از 30%', score: 4 },
    ],
  },
  {
    key: 'q6',
    section: 'بخش دوم: تحمل ریسک',
    text: 'کدام جمله به شما نزدیک‌تر است؟',
    options: [
      { text: 'سود بالا مهم‌تر از ریسک است', score: 0 },
      { text: 'ریسک و بازده باید متعادل باشند', score: 1 },
      { text: 'حفظ سرمایه از سود مهم‌تر است', score: 2 },
    ],
  },
  {
    key: 'q7',
    section: 'بخش سوم: رفتار روانشناختی',
    text: 'وقتی دیگران از سودهای بزرگ صحبت می‌کنند:',
    options: [
      { text: 'سریع وارد می‌شوم', score: 0 },
      { text: 'بررسی می‌کنم', score: 1 },
      { text: 'بی‌تفاوت هستم', score: 2 },
      { text: 'محتاط‌تر می‌شوم', score: 3 },
    ],
  },
  {
    key: 'q8',
    section: 'بخش سوم: رفتار روانشناختی',
    text: 'چند بار بر اساس احساسات تصمیم مالی گرفته‌اید؟',
    options: [
      { text: 'تقریباً همیشه', score: 0 },
      { text: 'زیاد', score: 1 },
      { text: 'گاهی', score: 2 },
      { text: 'کم', score: 3 },
      { text: 'تقریباً هیچ‌وقت', score: 4 },
    ],
  },
  {
    key: 'q9',
    section: 'بخش سوم: رفتار روانشناختی',
    text: 'در بازار نزولی:',
    options: [
      { text: 'فرصت خرید می‌بینم', score: 0 },
      { text: 'صبر می‌کنم', score: 1 },
      { text: 'مضطرب می‌شوم', score: 2 },
      { text: 'سرمایه را خارج می‌کنم', score: 3 },
    ],
  },
  {
    key: 'q10',
    section: 'بخش چهارم: افق سرمایه‌گذاری',
    text: 'هدف اصلی شما چیست؟',
    options: [
      { text: 'حفظ سرمایه', score: 0 },
      { text: 'درآمد ثابت', score: 1 },
      { text: 'رشد سرمایه', score: 2 },
      { text: 'ثروت‌سازی بلندمدت', score: 3 },
      { text: 'بازدهی حداکثری', score: 4 },
    ],
  },
  {
    key: 'q11',
    section: 'بخش چهارم: افق سرمایه‌گذاری',
    text: 'افق سرمایه‌گذاری شما:',
    options: [
      { text: 'کمتر از ۶ ماه', score: 0 },
      { text: '۶ تا ۱۲ ماه', score: 1 },
      { text: '۱ تا ۳ سال', score: 2 },
      { text: '۳ تا ۵ سال', score: 3 },
      { text: 'بیش از ۵ سال', score: 4 },
    ],
  },
  {
    key: 'q12',
    section: 'بخش پنجم: دانش مالی',
    text: 'سطح دانش مالی خود را چگونه ارزیابی می‌کنید؟',
    options: [
      { text: 'مبتدی', score: 0 },
      { text: 'متوسط', score: 1 },
      { text: 'خوب', score: 2 },
      { text: 'پیشرفته', score: 3 },
      { text: 'حرفه‌ای', score: 4 },
    ],
  },
  {
    key: 'q13',
    section: 'بخش پنجم: دانش مالی',
    text: 'در کدام بازار تجربه دارید؟ (می‌توانید چند گزینه انتخاب کنید)',
    options: [
      { text: 'بورس', score: 1 },
      { text: 'طلا', score: 1 },
      { text: 'ارز', score: 1 },
      { text: 'کریپتو', score: 1 },
      { text: 'صندوق‌ها', score: 1 },
      { text: 'هیچکدام', score: 0 },
    ],
  },
  {
    key: 'q14',
    section: 'بخش پنجم: دانش مالی',
    text: 'چند سال سابقه سرمایه‌گذاری دارید؟',
    options: [
      { text: 'کمتر از ۱ سال', score: 0 },
      { text: '۱ تا ۳ سال', score: 1 },
      { text: '۳ تا ۵ سال', score: 2 },
      { text: 'بیش از ۵ سال', score: 3 },
    ],
  },
];

/**
 * Contact info collection steps before quiz
 */
export const CONTACT_STEPS = [
  { key: 'name', prompt: '👤 لطفاً نام و نام خانوادگی خود را وارد کنید:' },
  { key: 'phone', prompt: '📱 لطفاً با زدن دکمه زیر، شماره تلفن خود را ارسال کنید:', requestContact: true },
  { key: 'age_range', prompt: '🎂 بازه سنی خود را انتخاب کنید:', options: ['زیر ۲۰', '۲۰-۳۰', '۳۰-۴۰', '۴۰-۵۰', 'بالای ۵۰'] },
  { key: 'capital', prompt: '💰 میزان سرمایه نقد کنار گذاشته یا قابل سرمایه‌گذاری شما چقدر است؟', options: ['زیر ۵۰ میلیون', '۵۰ تا ۱۰۰ میلیون', '۱۰۰ تا ۵۰۰ میلیون', '۵۰۰ میلیون تا ۱ میلیارد', 'بیش از ۱ میلیارد'] },
];
