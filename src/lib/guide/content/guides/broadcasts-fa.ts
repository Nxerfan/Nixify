/**
 * UX-B: Broadcasts guide — Persian content dictionary.
 *
 * همان استاندارد محتوای انگلیسی، با ترجمهٔ روان و وفادار.
 * توکن‌های فنی (شناسهٔ broadcast، کدهای نوع مخاطب مثل all_contacts/group،
 * رشته‌های وضعیت مثل draft/queued/sending/completed/cancelled/
 * review_pending/paused_quota/rejected/failed، دلایل skip،
 * {{contact.name}}/{{contact.email}}/{{unsubscribe_url}}،
 * مهرهای زمانی ISO، رشته‌های بدنهٔ HTML، آدرس‌های ایمیل، نام متدهای HTTP،
 * اعداد تعداد گیرندگان) به‌صورت رشتهٔ خام ذخیره می‌شوند و در زمان رندر
 * توسط <Ltr> به‌صورت چپ‌به‌راست نمایش داده می‌شوند.
 *
 * دقت محتوایی (بازرسی مجدد در این پاس):
 *   - صفحهٔ واقعی Broadcasts وضعیت را با جایگزینی زیرخط با فاصله نمایش
 *     می‌دهد (b.status.replace(/_/g, " ")). نشان‌ها از نقشهٔ STATUS_COLORS
 *     رنگ می‌گیرند — draft=slate، review_pending=amber، queued=blue،
 *     sending=blue، paused_quota=orange، completed=emerald، cancelled=rose،
 *     rejected=rose، failed=rose.
 *   - هر ردیف شامل: نام + نشان وضعیت + نشان اختیاری «در انتظار بازبینی»
 *     (amber)، موضوع (با <Ltr>)، آمار مجموع/ارسال‌شده/نادیده/ناموفق/در انتظار،
 *     و دکمه‌های اقدام (پیش‌نمایش + راه‌اندازی روی پیش‌نویس؛ انصراف روی
 *     وضعیت‌های قابل‌لغو).
 *   - راه‌اندازی برگشت‌ناپذیر است: فقط وضعیت draft قابل راه‌اندازی است.
 *     انتقال به‌صورت CAS است — فقط یک راه‌اندازی برای هر broadcast برنده است.
 *   - راه‌اندازی سه کار اتمیک انجام می‌دهد: (1) اسنپ‌شات مخاطب با
 *     INSERT...SELECT سمت DB (بدون آرایهٔ کامل شناسه‌ها در حافظهٔ Node)،
 *     (2) فریز محتوا (بدون ویرایش بعد از draft)، (3) بررسی آستانهٔ بازبینی.
 *     recipientCount > 1000 → review_pending؛ در غیر این صورت queued.
 *   - پیش‌نمایش مخاطب فقط‌خواندنی و رایگان است — POST /preview
 *     marketingStatus + تعداد عدم‌ارسال‌ها را سمت DB تجمیع می‌کند. بدون ارسال،
 *     بدون سهمیه.
 *   - انصراف idempotent است و فقط برای review_pending، queued، sending،
 *     paused_quota کار می‌کند. وضعیت‌های پایانی (completed، cancelled،
 *     rejected، failed) no-op هستند.
 *   - BROADCAST_REVIEW_THRESHOLD = 1000. recipientCount > آستانه →
 *     review_pending (نیازمند تأیید مدیر) به جای queued.
 *   - API راه‌اندازی یک scheduledAt با فرمت ISO می‌پذیرد. صفحهٔ داشبورد
 *     page.tsx در حال حاضر انتخاب‌گر تاریخ نمایش نمی‌دهد — بدنهٔ {} را
 *     می‌فرستد. مسیر زمان‌بندی فعلاً فقط API است.
 *   - متغیرها: {{contact.name}}، {{contact.email}}، {{unsubscribe_url}}.
 *   - فوتر لغو اشتراک به‌طور خودکار اضافه می‌شود اگر در بدنهٔ HTML نباشد.
 *   - رضایت/عدم‌ارسال در زمان ارسال دوباره بررسی می‌شود، نه در زمان اسنپ‌شات.
 *     مخاطب مشترکی که بعد از راه‌اندازی لغو اشتراک کند، skip می‌شود
 *     (not_subscribed).
 *
 * این دیکشنری همچنین شامل:
 *   - stage: رشته‌های انسانی صفحهٔ شبیه‌سازی‌شدهٔ BroadcastsStage به فارسی
 *   - creative: محتوای چهار بخش خلاقانه (چرخهٔ حیات، چک‌لیست پیش از ارسال،
 *     جریان مخاطب + قالب، ارسال فوری در برابر زمان‌بندی)
 * که همگی از طریق BroadcastsGuideContent تایپ می‌شوند.
 */

import type { BroadcastsGuideContent } from "./broadcasts-types";

export const broadcastsFa: BroadcastsGuideContent = {
  slug: "broadcasts",
  routeKey: "broadcasts",
  backHref: "/dashboard/broadcasts",
  stepCount: 6,
  durationMin: 5,
  category: "messaging",
  dashboardRoute: "/dashboard/broadcasts",
  title: "Broadcasts",
  description:
    "ارسال کمپین بازاریابی به مخاطبان اسنپ‌شات‌شده. پیش‌نویس، پیش‌نمایش، راه‌اندازی (برگشت‌ناپذیر) و رصد زندهٔ تحویل.",
  chapters: [
    {
      id: "intro",
      title: "Broadcasts",
      steps: [
        {
          id: "broadcastsOverview",
          caption:
            "این لیست Broadcasts است. هر ردیف یک کمپین با نشان وضعیت رنگی است — draft، queued، sending، paused_quota، completed، cancelled — به‌همراه تعداد گیرندگان و اقدام‌های موجود در ردیف.",
          duration: 7000,
          scene: "broadcastsOverview",
        },
        {
          id: "createBroadcast",
          caption:
            "برای پیش‌نویس یک کمپین روی «Broadcast جدید» کلیک کنید. نام، موضوع، بدنهٔ HTML و مخاطب (همهٔ مخاطبین یا گروه خاص) را تنظیم می‌کنید. فوتر لغو اشتراک در صورت نبودن خودکار اضافه می‌شود. ذخیره یک پیش‌نویس می‌سازد — هنوز چیزی ارسال نشده.",
          duration: 7500,
          scene: "createBroadcast",
          typedText: "به‌روزرسانی محصول ماهانه",
        },
        {
          id: "previewAudience",
          caption:
            "قبل از راه‌اندازی، روی «پیش‌نمایش» در یک پیش‌نویس کلیک کنید. Nixify یک تجمیع سمت DB اجرا می‌کند و مجموع · واجد شرایط · ناشناخته · لغو اشتراک‌شده · مسدودشده را گزارش می‌دهد. پیش‌نمایش رایگان است — بدون ارسال، بدون سهمیه. صلاحیت در زمان ارسال دوباره بررسی می‌شود، بنابراین ارسال واقعی ممکن است متفاوت باشد.",
          duration: 7500,
          scene: "previewAudience",
        },
        {
          id: "launchDecision",
          caption:
            "وقتی آماده بودید روی «راه‌اندازی» کلیک کنید. این کار برگشت‌ناپذیر است. Nixify مخاطب را اسنپ‌شات می‌کند (INSERT...SELECT)، محتوا را فریز می‌کند و آستانهٔ بازبینی را بررسی می‌کند. بیش از ۱۰۰۰ گیرنده → review_pending. در غیر این صورت broadcast به queued می‌رود.",
          duration: 8000,
          scene: "launchDecision",
        },
        {
          id: "inFlightProgress",
          caption:
            "وقتی در queued قرار گرفت، یک ورک‌ر پس‌زمینه دسته‌هایی از گیرندگان را برداشت و ارسال می‌کند. صلاحیت هر گیرنده در زمان ارسال دوباره بررسی می‌شود — مخاطبینی که لغو اشتراک کرده‌اند یا تازه مسدود شده‌اند skip می‌شوند، نه ارسال. تعدادها به‌صورت زنده به‌روز می‌شوند.",
          duration: 7500,
          scene: "inFlightProgress",
        },
        {
          id: "completedOrCancelled",
          caption:
            "هر broadcast در یکی از دو وضعیت پایانی پایان می‌یابد: completed (همهٔ گیرندگان پردازش شده — ارسال‌شده، نادیده یا ناموفق) یا cancelled (شما هنگام queued/sending/paused_quota روی انصراف کلیک کردید). broadcastهای پایانی قابل ویرایش یا راه‌اندازی مجدد نیستند.",
          duration: 7000,
          scene: "completedOrCancelled",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "خواندن لیست broadcasts",
      body: "صفحهٔ Broadcasts همهٔ کمپین‌های حساب شما را فهرست می‌کند. هر ردیف شامل نام، نشان وضعیت رنگی (draft، queued، sending، completed، cancelled و غیره)، خط موضوع و تفکیک گیرندگان است: مجموع · ارسال‌شده · نادیده · ناموفق · در انتظار. وضعیت دکمه‌های اقدام سمت راست را تعیین می‌کند — ردیف‌های draft دکمه‌های «پیش‌نمایش» و «راه‌اندازی» را نشان می‌دهند؛ ردیف‌های قابل‌لغو دکمهٔ «انصراف».",
    },
    {
      title: "پیش‌نویس broadcast جدید",
      body: "روی «Broadcast جدید» کلیک کنید. دیالوگ نیازمند نام، موضوع، بدنهٔ HTML و مخاطب (همهٔ مخاطبین یا گروه خاص) است. موضوع متغیرهایی مثل {{contact.name}} و {{contact.email}} را می‌پذیرد. فوتر لغو اشتراک به‌طور خودکار به بدنهٔ HTML اضافه می‌شود اگر شما آن را نگذاشته باشید. ذخیره یک پیش‌نویس می‌سازد — چیزی در صف نیست و چیزی ارسال نمی‌شود.",
    },
    {
      title: "پیش‌نمایش مخاطب قبل از راه‌اندازی",
      body: "روی یک ردیف پیش‌نویس، «پیش‌نمایش» را کلیک کنید. Nixify یک تجمیع سمت DB اجرا می‌کند و پنج عدد می‌دهد: مجموع، واجد شرایط، ناشناخته، لغو اشتراک‌شده و مسدودشده. «واجد شرایط» یعنی مشترک و در حال حاضر غیرمسدود. پیش‌نمایش رایگان است — سهمیه‌ای مصرف نمی‌کند و ردیف گیرنده‌ای نمی‌نویسد. اعداد وضعیت رضایت کنونی را منعکس می‌کنند؛ رضایت در زمان ارسال دوباره بررسی می‌شود، بنابراین مجموعهٔ ارسال واقعی ممکن است متفاوت باشد.",
    },
    {
      title: "راه‌اندازی (برگشت‌ناپذیر)",
      body: "برای شروع broadcast روی «راه‌اندازی» کلیک کنید. این کار برگشت‌ناپذیر است. نقطهٔ پایانی راه‌اندازی به‌صورت اتمیک مخاطب را با INSERT...SELECT اسنپ‌شات می‌کند (بدون آرایهٔ کامل شناسه‌ها در حافظهٔ Node)، محتوا را فریز می‌کند و آستانهٔ بازبینی ۱۰۰۰ گیرنده را بررسی می‌کند. بالاتر از آستانه → review_pending (نیازمند تأیید مدیر). پایین‌تر از آستانه → queued. draft تنها وضعیتی است که از آن راه‌اندازی مجاز است؛ پس از queued، محتوا قابل ویرایش نیست.",
    },
    {
      title: "انصراف هنگام در حال اجرا",
      body: "اگر broadcast در review_pending، queued، sending یا paused_quota باشد، می‌توانید روی «انصراف» کلیک کنید. انصراف idempotent است — فراخوانی آن روی یک broadcast قبلاً لغو‌شده no-op است. وضعیت‌های پایانی (completed، cancelled، rejected، failed) قابل انصراف نیستند. انصراف ارسال‌های بیشتر را متوقف می‌کند اما ایمیل‌هایی که قبلاً به صندوق گیرنده رسیده‌اند را برگشت نمی‌دهد.",
    },
    {
      title: "رصد چرخهٔ حیات تا وضعیت پایانی",
      body: "هر broadcast به یکی از سه وضعیت پایانی می‌رسد: completed (همهٔ گیرندگان پردازش شده — مجموع ارسال‌شده + نادیده + ناموفق)، cancelled (شما آن را متوقف کردید) یا failed (خطای سطح سیستم، مثل قطعی ارائه‌دهنده). تعداد گیرندگان از ردیف‌های BroadcastRecipient استخراج می‌شود — شمارنده‌های حساس به retry نیستند. گیرندگان نادیده‌شده سهمیه مصرف نمی‌کنند. گیرندگان ناموفق با یک کد خطای امن (provider_error، quota_error، provider_outcome_unknown و غیره) برچسب می‌شوند — هرگز استک‌تریس خام ارائه‌دهنده.",
    },
  ],
  whyWhen: [
    {
      title: "چه زمانی از broadcast استفاده کنیم و چه زمانی از اتوماسیون",
      body: "وقتی می‌خواهید یک کمپین بازاریابی یک‌باره به مخاطبان اسنپ‌شات‌شده بفرستید — خبرنامهٔ ماهانه، راه‌اندازی محصول، یک پرومو — از broadcast استفاده کنید. وقتی ارسال باید به‌طور خودکار در پاسخ به رویداد کاربر شلیک شود (مثلاً OTP تأیید شد → ایمیل خوش‌آمد)، از اتوماسیون استفاده کنید. broadcastها با کلیک انسان trigger می‌شوند؛ اتوماسیون‌ها با یک رویداد.",
    },
    {
      title: "چرا راه‌اندازی برگشت‌ناپذیر است",
      body: "راه‌اندازی به‌صورت اتمیک مخاطب را اسنپ‌شات و محتوا را فریز می‌کند. اسنپ‌شات، لیست گیرندگان در لحظهٔ راه‌اندازی است — با مشترک شدن، لغو اشتراک یا مسدود شدن مخاطبین بعد از آن تغییر نمی‌کند. فریز جلوی bait-and-switch را می‌گیرد: نسخه‌ای که پیش‌نمایش کردید همان نسخه‌ای است که ارسال می‌شود. اجازهٔ ویرایش پیش‌نویس بعد از راه‌اندازی این قرارداد را می‌شکند.",
    },
    {
      title: "چرا رضایت در زمان ارسال دوباره بررسی می‌شود",
      body: "اسنپ‌شات مخاطب فقط اینکه چه کسانی در نظر گرفته می‌شوند را ثبت می‌کند. رضایت و عدم‌ارسال اسنپ‌شات نمی‌شوند — بلافاصله قبل از ارسال به ارائه‌دهنده از طریق getMarketingEligibility() دوباره بررسی می‌شوند. این یعنی مخاطبی که بین راه‌اندازی و ارسال لغو اشتراک می‌کند، skip می‌شود نه ارسال. این برای انطباق CAN-SPAM / GDPR ضروری است — رضایت باید در لحظهٔ ارسال واقعی محترم شمرده شود، نه در لحظهٔ کلیک راه‌اندازی.",
    },
  ],
  mistakes: [
    {
      title: "انتظار برگشت‌پذیری راه‌اندازی",
      body: "راه‌اندازی برگشت‌ناپذیر است. به‌محض کلیک، مخاطب اسنپ‌شات و محتوا فریز می‌شود. تنها راه توقف ارسال‌های بیشتر «انصراف» است — و انصراف ایمیل‌هایی که قبلاً تحویل داده شده‌اند را برگشت نمی‌دهد. ابتدا مخاطب را پیش‌نمایش کنید؛ ابتدا محتوا را بررسی کنید؛ سپس راه‌اندازی کنید.",
    },
    {
      title: "اعتماد به تعداد پیش‌نمایش به‌عنوان تعداد دقیق ارسال",
      body: "پیش‌نمایش صلاحیت را در لحظهٔ پیش‌نمایش گزارش می‌کند. بین پیش‌نمایش و راه‌اندازی، مخاطبین ممکن است مشترک شوند، لغو اشتراک کنند یا مسدود شوند. بین راه‌اندازی و ارسال، رضایت دوباره بررسی می‌شود. تعداد ارسال واقعی تقریباً همیشه کمتر از تعداد واجد شرایط پیش‌نمایش است. این فاصله را در نظر بگیرید.",
    },
    {
      title: "فراموش کردن فوتر لغو اشتراک",
      body: "داشبورد در صورت نبودن فوتر لغو اشتراک در بدنهٔ HTML شما، آن را به‌طور خودکار اضافه می‌کند — اما تکیه بر افزودن خودکار شکننده است. بهترین روش این است که لینک {{unsubscribe_url}} را صریحاً در طراحی خود بگنجانید. افزودن خودکار یک تور ایمنی است، نه سازوکار اصلی.",
    },
    {
      title: "ویرایش پیش‌نویس پس از بازبینی تیم",
      body: "محتوا در راه‌اندازی فریز می‌شود — اما فاز پیش‌نویس چنین قفلی ندارد. اگر همکارتان پیش‌نویس را پیش‌نمایش کند و سبز بدهد، سپس شما قبل از کلیک «راه‌اندازی» بدنهٔ HTML را ویرایش کنید، محتوای راه‌اندازی‌شده نسخهٔ ویرایش‌شده خواهد بود — نه نسخه‌ای که همکارتان تأیید کرده. با پیش‌نویس تا راه‌اندازی به‌صورت قابل‌تغییر رفتار کنید؛ پس از راه‌اندازی غیرقابل‌تغییر است.",
    },
    {
      title: "انتظار بازگرداندن ایمیل‌های ارسال‌شده توسط «انصراف»",
      body: "انصراف ارسال‌های بیشتر را متوقف می‌کند. ایمیل‌هایی که قبلاً به صندوق گیرنده تحویل داده شده را برگشت نمی‌دهد. وقتی گیرنده در وضعیت sent است، ایمیل در صندوق اوست — انصراف نمی‌تواند به آن برسد. زود انصراف کنید؛ هرچه بیشتر منتظر بمانید، گیرندگان بیشتری پیام را دریافت کرده‌اند.",
    },
  ],
  proTips: [
    {
      title: "قبل از هر راه‌اندازی پیش‌نمایش بگیرید — همیشه",
      body: "پیش‌نمایش رایگان، سریع و دقیق است: تفکیک کامل مجموع/واجد شرایط/ناشناخته/لغو اشتراک‌شده/مسدودشده. اشتباهات مخاطب را قبل از اینکه سهمیه costing کند یا اعتبار فرستنده شما را خراب کند، می‌گیرد. از آن عادت بسازید: بدون پیش‌نمایش، بدون راه‌اندازی.",
    },
    {
      title: "برای آزمایش مخاطب بزرگ از «گروه خاص» استفاده کنید",
      body: "اگر می‌خواهید یک broadcast را قبل از ارسال گسترده روی برش کوچکی آزمایش کنید، یک Contact Group با چند تستر داخلی بسازید، broadcast را با audience = گروه خاص پیش‌نویس کنید و راه‌اندازی کنید. اسنپ‌شات کوچک است، ارسال مهار شده، و می‌توانید ایمیل رندرشده و فوتر لغو اشتراک را قبل از ارسال به همه تأیید کنید.",
    },
    {
      title: "به مسیر review_pending توجه کنید",
      body: "broadcastهای بیش از ۱۰۰۰ گیرنده از بازبینی مدیر عبور می‌کنند (review_pending). بر اساس آن برنامه بزنید: اگر پروموی حساس به زمان دارید، یک روز زودتر راه‌اندازی کنید تا مدیر فرصت تأیید داشته باشد. پس از تأیید، broadcast به queued می‌رود و ارسال به‌طور عادی شروع می‌شود.",
    },
    {
      title: "skipped را ویژگی بدانید، نه باگ",
      body: "skipped یعنی گیرنده در اسنپ‌شات مخاطب بود اما در زمان ارسال واجد شرایط نبود (لغو اشتراک، مسدود، یا حذف مخاطب). این سیستم است که رضایت را در زمان واقعی اعمال می‌کند. تعداد skip بالا در یک broadcast تازه معمولاً یعنی مخاطب شما قدیمی شده — قبل از ارسال بعدی آن را پاک کنید.",
    },
  ],
  troubleshooting: [
    {
      title: "Broadcasts در دسترس نیست",
      body: "اگر «Broadcasts در دسترس نیست» را می‌بینید، طرح شما قابلیت Contacts + Broadcast Emails را شامل نمی‌شود. broadcasts به هر دو وابسته‌اند. طرح خود را ارتقا دهید تا دسترسی پیدا کنید. پاسخ 403 کد feature_not_available دارد.",
    },
    {
      title: "راه‌اندازی با validation_failed ناموفق بود",
      body: "نقطهٔ پایانی راه‌اندازی محتوا را یک بار دیگر قبل از خروج از draft اعتبارسنجی می‌کند. اگر موضوع خالی، بدنهٔ HTML خالی، یا HTML بیش از ۵۰۰ KB باشد، 400 با کد validation_failed می‌گیرید. محتوا را در پیش‌نویس اصلاح و دوباره تلاش کنید.",
    },
    {
      title: "راه‌اندازی review_pending برگرداند",
      body: "تعداد گیرندگان از آستانهٔ بازبینی ۱۰۰۰ فراتر رفته است. broadcast اکنون در review_pending با نشان «در انتظار بازبینی» است. یک مدیر باید آن را قبل از انتقال به queued تأیید کند. این بر اساس طراحی است — ارسال‌های بزرگ یک بررسی انسانی در حلقه دارند.",
    },
    {
      title: "دکمهٔ انصراف موجود نیست",
      body: "انصراف فقط روی ردیف‌های review_pending، queued، sending یا paused_quota ظاهر می‌شود. اگر ردیف در draft، completed، cancelled، rejected یا failed باشد، دکمهٔ انصراف نیست — ردیف‌های draft به‌جای آن «پیش‌نمایش» + «راه‌اندازی» دارند؛ ردیف‌های پایانی هیچ اقدامی ندارند.",
    },
    {
      title: "تعداد ارسال کمتر از واجد شرایط است",
      body: "این انتظاری است. «واجد شرایط» یعنی مشترک و غیرمسدود در زمان پیش‌نمایش. بین پیش‌نمایش و ارسال، برخی مخاطبین ممکن است لغو اشتراک یا مسدود شده باشند. این مخاطبین در زمان ارسال skip می‌شوند. تعداد skip در ردیف این را منعکس می‌کند — خطا نیست، رضایت در زمان واقعی است که اعمال می‌شود.",
    },
    {
      title: "broadcast در sending گیر کرده است",
      body: "اگر broadcast مدت طولانی در sending بوده و پیشرفتی نداشته، ممکن است ورک‌ر وسط یک دسته کرش کرده باشد. گیرندگان processing قدیمی ظرف ۱۰ دقیقه به‌طور خودکار بازیابی می‌شوند (به pending برمی‌گردند). گیرندگان dispatching قدیمی — که ممکن است به ارائه‌دهنده زنگ زده باشند — پس از ۳۰ دقیقه به‌صورت پایانی failed با errorCode = provider_outcome_unknown منتقل می‌شوند. در هر صورت، broadcast به وضعیت پایانی می‌رسد.",
    },
  ],
  checklist: [
    { label: "broadcast در وضعیت draft است (تنها وضعیت قابل راه‌اندازی)" },
    { label: "پیش‌نمایش مخاطب واجد شرایط > ۰ را نشان می‌دهد" },
    { label: "موضوع و بدنهٔ HTML غیرخالی و زیر محدودیت‌های اندازه هستند" },
    { label: "بدنهٔ HTML شامل {{unsubscribe_url}} است یا به افزودن خودکار تکیه می‌کند" },
    { label: "متغیرهای {{contact.name}} و {{contact.email}} در پیش‌نمایش حل می‌شوند" },
    { label: "تعداد گیرندگان زیر ۱۰۰۰ است (یا برای review_pending برنامه‌ریزی کرده‌اید)" },
  ],
  whatNext:
    "پس از راه‌اندازی، آمار ردیف را تماشا کنید تا ورک‌ر پس‌زمینه ارسال را به‌روزرسانی کند. از Sent Emails برای بررسی تحویل‌های فردی، از Suppressions برای دیدن اینکه کدام مخاطبین skip شدند و چرا، و از Templates برای استفادهٔ مجدد از محتوای broadcast به‌عنوان یک قالب نسخه‌بندی‌شده برای کمپین بعدی استفاده کنید.",
  related: [
    { label: "داشبورد Broadcasts", href: "/dashboard/broadcasts" },
    { label: "راهنمای Templates", href: "/guide/templates" },
    { label: "راهنمای Contacts", href: "/guide/contacts" },
  ],

  /* ─── Stage copy ──────────────────────────────────────────────────────── */
  stage: {
    dir: "rtl",
    locale: "fa",

    header: {
      title: "Broadcasts",
      subtitle:
        "کمپین‌های بازاریابی. فقط مخاطبین مشترک شده و غیرمسدود شده می‌توانند Broadcasts دریافت کنند.",
      create: "Broadcast جدید",
    },

    card: {
      title: "Broadcasts",
      subtitle:
        "کمپین‌های بازاریابی. فقط مخاطبین مشترک شده و غیرمسدود شده می‌توانند Broadcasts دریافت کنند.",
    },

    statusLabels: {
      draft: "پیش‌نویس",
      review_pending: "در انتظار بازبینی",
      queued: "در صف",
      sending: "در حال ارسال",
      paused_quota: "متوقف‌شده سهمیه",
      completed: "تکمیل‌شده",
      cancelled: "لغو‌شده",
      rejected: "رد‌شده",
      failed: "ناموفق",
    },
    reviewPendingBadge: "در انتظار بازبینی",

    stats: {
      total: "مجموع",
      sent: "ارسال شده",
      skipped: "نادیده",
      failed: "ناموفق",
      pending: "در انتظار",
      audience: "مخاطب",
    },

    actions: {
      preview: "پیش‌نمایش",
      launch: "راه‌اندازی",
      cancel: "انصراف",
      launching: "در حال راه‌اندازی…",
      cancelling: "در حال انصراف…",
    },

    empty: {
      title: "هنوز Broadcastی وجود ندارد",
      description: "یکی در بالا ایجاد کنید.",
    },

    pagination: {
      pageOf: (page, total) => `صفحه ${page} · ${total} مجموع`,
      prev: "قبلی",
      next: "بعدی",
    },

    notAvailable: {
      title: "Broadcasts در دسترس نیست",
      description:
        "Broadcasts بخشی از امکان مخاطبین است که در طرح فعلی شما در دسترس نیست.",
      cta: "مشاهده طرح‌ها",
    },

    createDialog: {
      title: "Broadcast جدید",
      description:
        "یک پیش‌نویس Broadcast ایجاد کنید. می‌توانید از مخاطب پیش‌نمایش بگیرید و هنگام آماده بودن راه‌اندازی کنید. هر گیرنده به‌طور خودکار یک فوتر لغو اشتراک دریافت خواهد کرد.",
      nameLabel: "نام",
      namePlaceholder: "خبرنامهٔ ماهانه",
      subjectLabel: "موضوع",
      subjectPlaceholder: "سلام {{contact.name}}!",
      variablesHelp:
        "متغیرها: {{contact.name}}، {{contact.email}}، {{unsubscribe_url}}",
      htmlLabel: "محتوای HTML",
      htmlPlaceholder:
        "<p>Hello {{contact.name}}!</p>\n<p>Welcome to our newsletter.</p>",
      htmlHelp:
        "اگر وجود نداشته باشد، یک فوتر لغو اشتراک به‌طور خودکار اضافه می‌شود.",
      audienceLabel: "مخاطب",
      audienceHelp:
        "فقط مخاطبین مشترک شده و غیرمسدود شده Broadcast را دریافت خواهند کرد.",
      allContacts: "همهٔ مخاطبین",
      specificGroup: "گروه خاص",
      cancel: "انصراف",
      submit: "ایجاد پیش‌نویس",
      creating: "در حال ایجاد...",
    },

    previewBanner: {
      title: "پیش‌نمایش مخاطب",
      rowLabel: (label, count) => `${label}: ${count}`,
      labels: {
        total: "مجموع",
        eligible: "واجد شرایط",
        unknown: "ناشناخته",
        unsubscribed: "لغو اشتراک‌شده",
        suppressed: "مسدودشده",
      },
      note: "پیش‌نمایش صلاحیت، وضعیت رضایت کنونی را منعکس می‌کند. رضایت در زمان ارسال دوباره بررسی می‌شود.",
      dismiss: "بستن",
    },

    launchBanner: {
      titleLaunched: "Broadcast راه‌اندازی شد",
      titleReview: "Broadcast برای بازبینی مدیر ارسال شد",
      bodyReview: "تعداد گیرندگان از آستانهٔ بازبینی فراتر می‌رود.",
      recipientCountLabel: (n) => `${n} گیرنده`,
      dismiss: "بستن",
    },

    cancelBanner: {
      title: "Broadcast لغو شد",
      dismiss: "بستن",
    },

    broadcasts: [
      {
        id: 1,
        broadcastId: "bc_monthly_2026_09",
        name: "به‌روزرسانی محصول ماهانه",
        subject: "Hello {{contact.name}} — what's new in September",
        status: "draft",
        reviewPending: false,
        audienceType: "all_contacts",
        audienceLabel: "همهٔ مخاطبین",
        totalRecipients: 0,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        createdAtRelative: "همین حالا",
      },
      {
        id: 2,
        broadcastId: "bc_welcome_series_03",
        name: "سری خوش‌آمد — ایمیل آشناسی ۳",
        subject: "{{contact.name}}, here's how to get started",
        status: "queued",
        reviewPending: false,
        audienceType: "group",
        audienceLabel: "ثبت‌نام‌های جدید (۷ روز گذشته)",
        totalRecipients: 482,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0,
        pendingCount: 482,
        createdAtRelative: "۲ دقیقه پیش",
      },
      {
        id: 3,
        broadcastId: "bc_summer_promo_2026",
        name: "پرومو تابستان — فروش رعدآسای ۴۸ ساعته",
        subject: "48 hours only — 30% off for {{contact.name}}",
        status: "sending",
        reviewPending: false,
        audienceType: "all_contacts",
        audienceLabel: "همهٔ مخاطبین",
        totalRecipients: 1284,
        sentCount: 612,
        skippedCount: 41,
        failedCount: 3,
        pendingCount: 628,
        createdAtRelative: "۸ دقیقه پیش",
      },
      {
        id: 4,
        broadcastId: "bc_q2_newsletter",
        name: "خبرنامهٔ Q2 — مرور سال",
        subject: "Q2 recap — what {{contact.name}} missed",
        status: "completed",
        reviewPending: false,
        audienceType: "all_contacts",
        audienceLabel: "همهٔ مخاطبین",
        totalRecipients: 938,
        sentCount: 871,
        skippedCount: 60,
        failedCount: 7,
        pendingCount: 0,
        createdAtRelative: "۳ روز پیش",
      },
      {
        id: 5,
        broadcastId: "bc_blackfriday_dryrun",
        name: "آزمایش جمعهٔ سیاه (dry-run)",
        subject: "Coming soon — Black Friday deals for {{contact.name}}",
        status: "cancelled",
        reviewPending: false,
        audienceType: "group",
        audienceLabel: "تسترهای داخلی",
        totalRecipients: 24,
        sentCount: 12,
        skippedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        createdAtRelative: "۵ روز پیش",
      },
      {
        id: 6,
        broadcastId: "bc_holiday_mega_2026",
        name: "ارسال بزرگ تعطیلات ۲۰۲۶",
        subject: "Holiday greetings from the team",
        status: "review_pending",
        reviewPending: true,
        audienceType: "all_contacts",
        audienceLabel: "همهٔ مخاطبین",
        totalRecipients: 2150,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        createdAtRelative: "۱ ساعت پیش",
      },
    ],

    previewBreakdown: [
      { key: "total", count: 1284, tone: "neutral" },
      { key: "eligible", count: 942, tone: "good" },
      { key: "unknown", count: 187, tone: "warn" },
      { key: "unsubscribed", count: 124, tone: "warn" },
      { key: "suppressed", count: 31, tone: "warn" },
    ],
  },

  /* ─── Creative section copy ──────────────────────────────────────────── */
  creative: {
    /* 1. چرخهٔ حیات broadcast — ماشین وضعیت */
    lifecycle: {
      heading: "چرخهٔ حیات broadcast",
      subheading:
        "هر broadcast از یک ماشین حالت کوچک عبور می‌کند. هر وضعیت رنگ نشان و دکمه‌های اقدام قابل‌مشاهده را تعیین می‌کند. فقط وضعیت draft قابل راه‌اندازی است؛ فقط وضعیت‌های قابل‌لغو قابل انصراف هستند؛ پس از پایانی، ردیف پایانی می‌ماند.",
      statesTitle: "وضعیت‌ها",
      states: [
        {
          tone: "draft",
          label: "پیش‌نویس",
          desc: "حالت اولیه پس از ایجاد. محتوا و مخاطب قابل‌ویرایش هستند. پیش‌نمایش موجود است. راه‌اندازی موجود است.",
          cancellable: false,
          terminal: false,
        },
        {
          tone: "review_pending",
          label: "در انتظار بازبینی",
          desc: "راه‌اندازی با بیش از ۱۰۰۰ گیرنده کلیک شده بود. یک مدیر باید قبل از انتقال broadcast به queued تأیید کند. انصراف موجود است.",
          cancellable: true,
          terminal: false,
        },
        {
          tone: "queued",
          label: "در صف",
          desc: "مخاطب اسنپ‌شات شد، محتوا فریز شد، منتظر ورک‌ر پس‌زمینه برای برداشت اولین دسته. انصراف موجود است.",
          cancellable: true,
          terminal: false,
        },
        {
          tone: "sending",
          label: "در حال ارسال",
          desc: "ورک‌ر به‌طور فعال دسته‌ها را برداشت و به ارائه‌دهنده ارسال می‌کند. تعدادها به‌صورت زنده به‌روز می‌شوند. انصراف موجود است.",
          cancellable: true,
          terminal: false,
        },
        {
          tone: "paused_quota",
          label: "متوقف‌شده سهمیه",
          desc: "سهمیه BROADCAST_EMAILS در میانهٔ ارسال تمام شد. broadcast منتظر پر شدن سهمیه (چرخهٔ ماهانه) یا ارتقا می‌ماند. انصراف موجود است.",
          cancellable: true,
          terminal: false,
        },
        {
          tone: "completed",
          label: "تکمیل‌شده",
          desc: "همهٔ گیرندگان به وضعیت پایانی رسیدند (ارسال‌شده، نادیده یا ناموفق). بدون انتقال بعدی. بدون اقدام.",
          cancellable: false,
          terminal: true,
        },
        {
          tone: "cancelled",
          label: "لغو‌شده",
          desc: "شما هنگام قابل‌لغو بودن broadcast روی انصراف کلیک کردید. ایمیل‌های قبلاً ارسال‌شده برگشت نمی‌خورند. بدون انتقال بعدی.",
          cancellable: false,
          terminal: true,
        },
        {
          tone: "rejected",
          label: "رد‌شده",
          desc: "مدیر broadcast را در حین بازبینی رد کرد. بدون ارسال. بدون انتقال بعدی.",
          cancellable: false,
          terminal: true,
        },
        {
          tone: "failed",
          label: "ناموفق",
          desc: "خطای سطح سیستم (مثلاً قطعی ارائه‌دهنده). گیرنده‌هایی که ارسال شده بودند ممکن است همچنان ایمیل را دریافت کرده باشند؛ شکست، وضعیت سطح broadcast را منعکس می‌کند، نه نتایج گیرندهٔ فردی را.",
          cancellable: false,
          terminal: true,
        },
      ],
      transitionsTitle: "انتقال‌ها",
      transitions: [
        {
          label: "ایجاد",
          from: "draft",
          to: "draft",
          desc: "POST /api/dashboard/broadcasts یک پیش‌نویس می‌سازد. هنوز اسنپ‌شات مخاطب نیست، سهمیه‌ای مصرف نشده.",
          sideEffect: "ردیف broadcast با status = draft در لیست ظاهر می‌شود.",
        },
        {
          label: "راه‌اندازی (≤ ۱۰۰۰ گیرنده)",
          from: "draft",
          to: "queued",
          desc: "POST /launch با recipientCount ≤ 1000. مخاطب با INSERT...SELECT اسنپ‌شات شد، محتوا فریز، CAS draft → queued.",
          sideEffect: "ردیف‌های BroadcastRecipient با status = pending ساخته شدند. سهمیه BROADCAST_EMAILS هنوز مصرف نشده.",
        },
        {
          label: "راه‌اندازی (> ۱۰۰۰ گیرنده)",
          from: "draft",
          to: "review_pending",
          desc: "POST /launch با recipientCount > 1000. همان اسنپ‌شات + فریز، اما reviewStatus = pending. منتظر تأیید مدیر.",
          sideEffect: "نشان «در انتظار بازبینی» کنار نشان وضعیت ظاهر می‌شود. تا تأیید، ارسالی وجود ندارد.",
        },
        {
          label: "تأیید مدیر",
          from: "review_pending",
          to: "queued",
          desc: "مدیر در داشبورد مدیر روی «تأیید» کلیک می‌کند. broadcast به queued می‌رود؛ ورک‌ر به‌طور عادی برداشت می‌کند.",
          sideEffect: "نشان «در انتظار بازبینی» ناپدید می‌شود. ارسال ورک‌ر شروع می‌شود.",
        },
        {
          label: "برداشت دسته توسط ورک‌ر",
          from: "queued",
          to: "sending",
          desc: "ورک‌ر پس‌زمینه اولین دستهٔ ۲۵ گیرنده را با CAS اتمیک برداشت می‌کند. وضعیت از queued به sending منتقل می‌شود.",
          sideEffect: "تعدادها شروع به به‌روزرسانی می‌کنند. تعداد ارسال‌شده/نادیده/ناموفق با رسیدن گیرندگان به وضعیت پایانی رشد می‌کند.",
        },
        {
          label: "سهمیه تمام شد",
          from: "sending",
          to: "paused_quota",
          desc: "checkUsage() در میانهٔ ارسال false برمی‌گرداند. broadcast متوقف می‌شود. گیرندگان در انتظار، در انتظار می‌مانند.",
          sideEffect: "تا پر شدن سهمیه ارسال بیشتری نیست. انصراف همچنان موجود است.",
        },
        {
          label: "همهٔ گیرندگان پردازش شدند",
          from: "sending",
          to: "completed",
          desc: "pendingCount = 0 و processingCount = 0 و dispatchingCount = 0. broadcast به completed منتقل می‌شود.",
          sideEffect: "تعداد نهایی پایدار هستند. بدون انتقال بعدی. بدون اقدام.",
        },
        {
          label: "انصراف (قابل‌لغو)",
          from: "sending",
          to: "cancelled",
          desc: "POST /cancel از داشبورد. idempotent — فراخوانی روی یک broadcast قبلاً لغو‌شده no-op است.",
          sideEffect: "گیرندگان در انتظار با دلیل = broadcast_cancelled skip می‌شوند. ایمیل‌های قبلاً ارسال‌شده برگشت نمی‌خورند.",
        },
      ],
      footnote:
        "تعدادها از ردیف‌های BroadcastRecipient استخراج می‌شوند (بدون شمارنده‌های حساس به retry). ارسال‌شده + نادیده + ناموفف = totalRecipients در پایانی. گیرندگان نادیده‌شده سهمیه مصرف نمی‌کنند؛ گیرندگان ناموفق با یک کد خطای امن (provider_error، quota_error، provider_outcome_unknown و غیره) برچسب می‌شوند — هرگز استک‌تریس خام ارائه‌دهنده.",
    },

    /* 2. چک‌لیست ایمنی پیش از ارسال */
    preSendChecklist: {
      heading: "چک‌لیست ایمنی پیش از ارسال",
      subheading:
        "این چک‌لیست را قبل از کلیک «راه‌اندازی» روی هر broadcast اجرا کنید. راه‌اندازی برگشت‌ناپذیر است — به‌محض کلیک، مخاطب اسنپ‌شات و محتوا فریز می‌شود. این چک‌لیست اشتباهاتی را می‌گیرد که از یک نگاه سریع جان سالم به در می‌برند اما یک ارسال واقعی را خراب می‌کنند.",
      checklistTitle: "قبل از راه‌اندازی این‌ها را اجرا کنید",
      items: [
        {
          key: "draft-status",
          label: "broadcast در وضعیت draft است",
          desc: "فقط ردیف‌های draft دکمهٔ «راه‌اندازی» را نشان می‌دهند. اگر «پیش‌نمایش» + «راه‌اندازی» می‌بینید، خوب است. اگر «انصراف» می‌بینید، broadcast قبلاً در حال اجراست.",
          token: "status === draft",
        },
        {
          key: "preview-run",
          label: "پیش‌نمایش واجد شرایط > ۰ را نشان می‌دهد",
          desc: "POST /preview مجموع/واجد شرایط/ناشناخته/لغو اشتراک‌شده/مسدودشده را برمی‌گرداند. اگر eligible = 0، راه‌اندازی یک مخاطب خالی اسنپ‌شات می‌کند — هر گیرنده‌ای skip خواهد شد.",
          token: "POST /preview",
        },
        {
          key: "content-valid",
          label: "موضوع و بدنهٔ HTML غیرخالی و زیر محدودیت‌ها هستند",
          desc: "موضوع ≤ ۲۰۰ کاراکتر، بدنهٔ HTML ≤ ۵۰۰ KB، بدنهٔ متن ≤ ۲۰۰ KB. نقطهٔ پایانی راه‌اندازی دوباره اعتبارسنجی می‌کند؛ اگر نامعتبر باشد 400 validation_failed می‌گیرید.",
          token: "subject ≤ 200, html ≤ 500KB",
        },
        {
          key: "unsubscribe-footer",
          label: "بدنهٔ HTML شامل لینک لغو اشتراک است",
          desc: "بهترین روش: {{unsubscribe_url}} را صریحاً در طراحی خود بگنجانید. داشبورد در صورت نبودن فوتر را خودکار اضافه می‌کند، اما تکیه بر آن شکننده است.",
          token: "{{unsubscribe_url}}",
        },
        {
          key: "variables-resolve",
          label: "متغیرها در پیش‌نمایش حل می‌شوند",
          desc: "موضوع و بدنهٔ HTML از {{contact.name}}، {{contact.email}}، {{unsubscribe_url}} استفاده می‌کنند. آن‌ها را در خروجی رندرشده پیش‌نمایش کنید — یک اشتباه تایپی مثل {{contact.nme}} به‌صورت خاموش خالی رندر می‌شود.",
          token: "{{contact.name}}",
        },
        {
          key: "review-threshold",
          label: "تعداد گیرندگان زیر ۱۰۰۰ است (یا برای بازبینی برنامه‌ریزی کرده‌اید)",
          desc: "بالاتر از ۱۰۰۰ → review_pending. اگر ارسال شما حساس به زمان است، یک روز زودتر راه‌اندازی کنید تا مدیر فرصت تأیید داشته باشد.",
          token: "BROADCAST_REVIEW_THRESHOLD = 1000",
        },
        {
          key: "audience-fresh",
          label: "مخاطب قدیمی نیست (پیش‌نمایش لغو اشتراک/مسدود کم را نشان می‌دهد)",
          desc: "تعداد skip بالا در یک broadcast قبلی معمولاً یعنی مخاطب شما قدیمی شده. قبل از ارسال بعدی آن را پاک کنید (یا به «گروه خاص» سوییچ کنید).",
          token: "skipped / total < 10%",
        },
      ],
      allCheckedTitle: "آمادهٔ راه‌اندازی",
      allCheckedBody:
        "همهٔ هفت بررسی عبور کردند. راه‌اندازی همچنان برگشت‌ناپذیر است، اما شما تحقیق لازم را انجام داده‌اید. روی «راه‌اندازی» کلیک کنید — مخاطب اسنپ‌شات، محتوا فریز و broadcast به queued (یا review_pending اگر بالاتر از آستانه) منتقل می‌شود.",
      notAllCheckedTitle: "هنوز آماده نیست",
      notAllCheckedBody:
        "یک یا چند بررسی هنوز ناموفق است. آن‌ها را در پیش‌نویس قبل از راه‌اندازی اصلاح کنید. راه‌اندازی الان یا با خطای اعتبارسنجی شکست می‌خورد (400 برمی‌گرداند) یا با محتوای اشتباه به مخاطب اشتباه ارسال می‌کند — و نمی‌توانید آن را برگردانید.",
    },

    /* 3. جریان مخاطب + قالب */
    audienceTemplateFlow: {
      heading: "چگونه مخاطب و محتوا ترکیب می‌شوند",
      subheading:
        "یک broadcast ضرب دکارتی مخاطب (چه کسی) و محتوا (چه چیزی) است. این‌ها ورودی‌های مستقل هستند — مخاطب را از مخاطبین یا یک گروه انتخاب می‌کنید، محتوا (موضوع + بدنهٔ HTML) را می‌نویسید، و در راه‌اندازی به‌هم می‌پیوندند و فریز می‌شوند. درک این پیوند، کلید درک این است که چرا تعداد پیش‌نمایش و تعداد ارسال نهایی ممکن است متفاوت باشند.",
      legendTitle: "کدگذاری رنگ",
      legendItems: [
        { label: "اقدام UI", tone: "ui" },
        { label: "انتقال وضعیت", tone: "state" },
        { label: "عوارض جانبی پایین‌دستی", tone: "downstream" },
      ],
      steps: [
        {
          badge: "01",
          title: "انتخاب مخاطب",
          body: "در دیالوگ ایجاد، «همهٔ مخاطبین» یا «گروه خاص» را انتخاب کنید. مخاطب یک فیلتر SQL روی جدول Contact است — هنوز چیزی مادی نشده.",
          token: "audienceType = all_contacts | group",
          tone: "ui",
        },
        {
          badge: "02",
          title: "نوشتن محتوا",
          body: "موضوع + بدنهٔ HTML + متن اختیاری. متغیرهای {{contact.name}}، {{contact.email}}، {{unsubscribe_url}} جایگزین هستند — در زمان پیش‌نویس حل نمی‌شوند.",
          token: "subject, htmlContent, textContent",
          tone: "ui",
        },
        {
          badge: "03",
          title: "ذخیرهٔ پیش‌نویس",
          body: "POST /api/dashboard/broadcasts ردیف را با status = draft ثبت می‌کند. بدون اسنپ‌شات، بدون فریز، بدون سهمیه. محتوا قابل‌ویرایش، مخاطب فقط یک فیلتر SQL است.",
          token: "POST /api/dashboard/broadcasts",
          tone: "state",
        },
        {
          badge: "04",
          title: "پیش‌نمایش مخاطب (رایگان، بدون اسنپ‌شات)",
          body: "POST /preview یک GROUP BY سمت DB روی marketingStatus + عدم‌ارسال اجرا می‌کند. مجموع/واجد شرایط/ناشناخته/لغو اشتراک‌شده/مسدودشده را برمی‌گرداند. هیچ ردیف گیرنده‌ای نوشته نمی‌شود.",
          token: "POST /preview",
          tone: "ui",
        },
        {
          badge: "05",
          title: "راه‌اندازی — اسنپ‌شات + فریز (برگشت‌ناپذیر)",
          body: "POST /launch یک تراکنش باز می‌کند. مخاطب با INSERT...SELECT در BroadcastRecipient اسنپ‌شات می‌شود. محتوا فریز. آستانهٔ بازبینی بررسی. CAS draft → queued.",
          token: "INSERT...SELECT INTO BroadcastRecipient",
          tone: "state",
        },
        {
          badge: "06",
          title: "ورک‌ر برداشت + ارسال به‌ازای گیرنده",
          body: "برای هر گیرنده: صلاحیت را با getMarketingEligibility() دوباره بررسی کن. اگر واجد شرایط: محتوا را رندر کن ({{var}} را حل کن)، provider.send() را صدا بزن، ردیف Delivery بنویس. اگر نه: با دلیل skip کن.",
          token: "getMarketingEligibility()",
          tone: "downstream",
        },
        {
          badge: "07",
          title: "تعدادها زنده به‌روز می‌شوند؛ broadcast به پایانی می‌رسد",
          body: "ارسال‌شده/نادیده/ناموفق با رسیدن گیرندگان به وضعیت پایانی رشد می‌کنند. وقتی pending = 0 و processing = 0 و dispatching = 0، broadcast به completed منتقل می‌شود.",
          token: "sent + skipped + failed = totalRecipients",
          tone: "downstream",
        },
      ],
      audienceCard: {
        badge: "مخاطب",
        title: "چه کسی این را دریافت خواهد کرد",
        body: "مخاطب یک فیلتر SQL روی جدول Contact است که در راه‌اندازی اسنپ‌شات می‌شود. هر مخاطب یک ردیف BroadcastRecipient با status = pending می‌شود. متغیرها به‌ازای گیرنده از رکورد مخاطب می‌آیند.",
        items: ["{{contact.name}}", "{{contact.email}}", "marketingStatus", "suppression state"],
      },
      contentCard: {
        badge: "محتوا (در راه‌اندازی فریز)",
        title: "چه چیزی دریافت خواهند کرد",
        body: "موضوع + بدنهٔ HTML + متن اختیاری. در راه‌اندازی فریز — نسخه‌ای که پیش‌نمایش کردید همان نسخه‌ای است که ارسال می‌شود. متغیرها در زمان ارسال به‌ازای گیرنده حل می‌شوند، نه در زمان اسنپ‌شات.",
        items: ["subject", "htmlContent", "textContent (اختیاری)", "unsubscribe footer (در صورت نبودن خودکار اضافه می‌شود)"],
      },
      footnote:
        "مخاطب + محتوا ورودی‌های مستقل هستند. اسنپ‌شات آن‌ها را به‌هم می‌پیوندد: هر مخاطب در مخاطب یک ردیف به محتوای فریز‌شده اشاره می‌کند. متغیرها ({{contact.name}}، {{contact.email}}) از مخاطب می‌آیند؛ {{unsubscribe_url}} به‌ازای گیرنده ضرب می‌شود. رضایت اسنپ‌شات نمی‌شود — در زمان ارسال دوباره بررسی می‌شود، بنابراین مخاطبی که بین راه‌اندازی و ارسال لغو اشتراک می‌کند skip می‌شود، نه ارسال.",
    },

    /* 4. ارسال فوری در برابر زمان‌بندی */
    sendNowVsSchedule: {
      heading: "ارسال فوری در برابر زمان‌بندی",
      subheading:
        "نقطهٔ پایانی راه‌اندازی یک scheduledAt با فرمت ISO اختیاری می‌پذیرد. «ارسال فوری» یعنی scheduledAt: null — broadcast وارد queued می‌شود و ورک‌ر فوراً برداشت می‌کند. «زمان‌بندی» یعنی scheduledAt: <ISO آینده> — broadcast همچنان وارد queued می‌شود، اما ارسال ورک‌ر تا زمان scheduled گیت می‌شود. داشبورد هنوز انتخاب‌گر تاریخ نمایش نمی‌دهد؛ مسیر زمان‌بندی فعلاً فقط API است.",
      sendNowCard: {
        badge: "ارسال فوری",
        title: "scheduledAt: null",
        body: "پیش‌فرض. راه‌اندازی draft → queued را فوراً منتقل می‌کند. ورک‌ر پس‌زمینه اولین دسته را ظرف ثانیه‌ها برداشت می‌کند. وقتی زمان مهم نیست — خبرنامه‌ها، پروموی تراکنشی‌حس، هر چیزی که «در اولین فرصت» هدف است — از این استفاده کنید.",
        icon: "send",
      },
      scheduleCard: {
        badge: "زمان‌بندی",
        title: "scheduledAt: 2026-09-22T09:00:00Z",
        body: "راه‌اندازی همچنان draft → queued را فوراً منتقل می‌کند، اما ارسال تا زمان scheduled گیت می‌شود. برای پروموی حساس به زمان (جمعهٔ سیاه در نیمه‌شب، تبریک سال نو در ۰۰:۰۰) از این استفاده کنید. داشبورد هنوز انتخاب‌گر تاریخ نمایش نمی‌دهد — scheduledAt را مستقیماً در بدنهٔ درخواست API بفرستید.",
        icon: "clock",
      },
      comparison: [
        {
          dimension: "فیلد API",
          sendNowValue: "scheduledAt: null",
          scheduleValue: "scheduledAt: 2026-09-22T09:00:00Z",
        },
        {
          dimension: "دکمهٔ داشبورد",
          sendNowValue: "راه‌اندازی (بدون انتخاب‌گر تاریخ)",
          scheduleValue: "راه‌اندازی (بدون انتخاب‌گر تاریخ — فقط API)",
        },
        {
          dimension: "وضعیت پس از راه‌اندازی",
          sendNowValue: "queued",
          scheduleValue: "queued",
        },
        {
          dimension: "ارسال ورک‌ر",
          sendNowValue: "فوری (ثانیه‌ها)",
          scheduleValue: "گیت تا scheduledAt",
        },
        {
          dimension: "اسنپ‌شات مخاطب",
          sendNowValue: "در کلیک راه‌اندازی",
          scheduleValue: "در کلیک راه‌اندازی (اسنپ‌شات در کلیک تازه است، نه در زمان scheduled)",
        },
        {
          dimension: "تداخل idempotency",
          sendNowValue: "همان کلید + null schedule = OK (replay)",
          scheduleValue: "همان کلید + schedule متفاوت = 409 idempotency_conflict",
        },
        {
          dimension: "پنجرهٔ انصراف",
          sendNowValue: "کوتاه (فقط هنگام queued/sending)",
          scheduleValue: "طولانی (کل فاصله بین کلیک راه‌اندازی و scheduledAt)",
        },
      ],
      uiExposedNote:
        "توجه: dashboard page.tsx در حال حاضر {} را در بدنهٔ راه‌اندازی می‌فرستد — هیچ انتخاب‌گر تاریخ UI وجود ندارد. برای زمان‌بندی یک broadcast، launch API را مستقیماً با scheduledAt تنظیم‌شده صدا بزنید. دکمهٔ انصراف همچنان روی یک broadcast زمان‌بندی‌شده (queued) کار می‌کند — می‌توانید هر زمان قبل از شروع ارسال انصراف دهید.",
      warningTitle: "زمان‌بندی تضمین نیست",
      warningBody:
        "زمان‌بندی یک broadcast، زمان اسنپ‌شات را تغییر نمی‌دهد — مخاطب در کلیک راه‌اندازی گرفته می‌شود، نه در scheduledAt. اگر مخاطبین بین کلیک راه‌اندازی و زمان scheduled لغو اشتراک کنند، در زمان ارسال skip خواهند شد (بررسی مجدد رضایت). اسنپ‌شات تازه نمی‌شود. اگر در زمان ارسال به مخاطب تازه نیاز دارید، در زمان ارسال راه‌اندازی کنید.",
    },
  },
};
