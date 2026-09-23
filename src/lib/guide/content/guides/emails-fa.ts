/**
 * UX-B: Emails guide — Persian (فارسی) content dictionary.
 *
 * این دیکشنری برابر فارسیِ دقیقِ emails-en.ts است. همان شکل، همان تعداد
 * فیلدها، همان توکن‌های فنی (deliveryId UUID، کدهای وضعیت مثل queued /
 * provider_accepted / delivered / deferred / bounced / complained / rejected /
 * failed / unknown، کدهای sourceType مثل broadcast / transactional / otp،
 * کدهای provider مثل smtp، providerMessageId، مهرهای زمانی ISO، نام متدهای
 * HTTP، placeholder های {{var}}، آدرس ایمیل) به‌صورت LTR باقی می‌مانند.
 *
 * قرارداد بومی‌سازی (REGRESSION-PROTECTED):
 *   - stage.dir = "rtl" و stage.locale = "fa" — مرحله نهاده به‌صورت دائمی
 *     dir="ltr" نیست.
 *   - برچسب‌های انسانی (عنوان، زیرعنوان، برچسب‌های جدول، متن بنرها، متن
 *     راهنما) به فارسی روان ترجمه می‌شوند.
 *   - اعداد فارسی (۰۱–۰۶) فقط در جاهایی به کار رفته‌اند که در نسخهٔ انگلیسی
 *     هم اعداد لاتین در متن طبیعی به کار رفته‌اند (مثل نشان‌های مرحله در
 *     timeline یا زمان‌های نسبی مثل «۲ دقیقه پیش»). اعداد فنی (مثل
 *     deliveryId، ISO timestampها، کدهای وضعیت) همگی LTR باقی می‌مانند.
 *   - توکن‌های فنی در زمان رندر با <Ltr> پیچیده می‌شوند تا در صفحهٔ RTL
 *     به‌درستی نمایش داده شوند.
 *
 * Audit-grade factual accuracy (re-verified this pass):
 *   هر ادعایی در این فایل بر اساس:
 *     - src/app/dashboard/emails/page.tsx                       (placeholder UI)
 *     - src/app/api/dashboard/deliveries/route.ts                (list endpoint)
 *     - src/app/api/dashboard/deliveries/[deliveryId]/route.ts   (detail endpoint)
 *     - src/lib/deliverability/service.ts                       (state machine + never-regress)
 *     - prisma/schema.prisma                                     (EmailDelivery + EmailDeliveryEvent)
 *     - src/i18n/fa.ts                                          (dashboard.emails.* labels)
 *   بازبینی شده است. متنِ فارسی، معادل دقیقِ متنِ انگلیسی است.
 */

import type { EmailsGuideContent } from "./emails-types";

export const emailsFa: EmailsGuideContent = {
  slug: "emails",
  routeKey: "emails",
  backHref: "/dashboard/emails",
  stepCount: 6,
  durationMin: 5,
  category: "messaging",
  dashboardRoute: "/dashboard/emails",
  title: "ایمیل‌های ارسالی",
  description:
    "هر ایمیلی که Nixify از طرف شما ارسال کرده است را پیگیری کنید — sent، delivered، deferred، bounced، complained، rejected، failed و حالت بازیابی unknown. صفحهٔ داشبورد امروز یک placeholder است؛ این راهنما مفهوم ردیابی تحویل ایمیل را صادقانه آموزش می‌دهد.",
  chapters: [
    {
      id: "intro",
      title: "ایمیل‌های ارسالی",
      steps: [
        {
          id: "emailsOverview",
          caption:
            "این صفحهٔ واقعی «ایمیل‌های ارسالی» است که امروز عرضه شده — یک placeholder ۳۱ خطی: هدری با کاشی سبز رنگ آیکن Mail و زیرعنوان «هر ایمیلی که Nixify از طرف شما ارسال کرده است را پیگیری کنید» به‌علاوهٔ یک کارت خالیِ مرکزی با متن «هنوز ایمیلی ارسال نشده است. اولین OTP را از محیط تست ارسال کنید.» هیچ فهرستی، هیچ فیلتری، هیچ نشان وضعیتی وجود ندارد. صفحه هنوز از API تحویل فراخوانی نمی‌کند.",
          duration: 7500,
          scene: "emailsOverview",
        },
        {
          id: "conceptPreview",
          caption:
            "پشتِ placeholder، بک‌اند تحویل‌پذیری واقعی است و از قبل عرضه شده. به‌محض اتصال صفحه به GET /api/dashboard/deliveries، هر ردیف EmailDelivery که Nixify برایتان پردازش کرده را فهرست می‌کند — گیرنده، موضوع، منبع، نشان وضعیت، کد خطا، زمان ایجاد. این صحنه یک پیش‌نمایش مفهومی است، نه UI زندهٔ امروز — با برچسب روشن تا بدانید چه چیزی واقعی است و چه چیزی ابزار آموزشی.",
          duration: 8000,
          scene: "conceptPreview",
        },
        {
          id: "deliveryRow",
          caption:
            "هر ردیف یک نشان وضعیت رنگی دارد. queued یعنی Nixify ردیف تحویل را ایجاد کرده اما هنوز ارسال نکرده. provider_accepted یعنی MTA بالادستی پاکت نامه را پذیرفته — نه اینکه پیام به صندوق ورودی گیرنده رسیده. delivered یعنی یک ارائه‌دهندهٔ دارای webhook، تحویل به صندوق را گزارش داده. برای SMTP ساده، تحویل‌ها برای همیشه در provider_accepted می‌مانند؛ این درست است، نه باگ.",
          duration: 8500,
          scene: "deliveryRow",
        },
        {
          id: "eventTimeline",
          caption:
            "روی یک ردیف کلیک کنید، صفحه یک کشوی جزئیات باز می‌کرد که کل تاریخچهٔ EmailDeliveryEvent را نشان می‌داد. هر رویدادی که تاکنون دیده شده به‌صورت تغییرناپذیر ذخیره می‌شود، با کلید (provider, providerEventId) دی‌دیوپ می‌شود. رویدادها بر اساس occurredAt مرتب می‌شوند — نه بر اساس زمان دریافت webhook — تا یک webhook خارج از ترتیب نتواند وضعیت قابل‌مشاهده را برگرداند.",
          duration: 8000,
          scene: "eventTimeline",
        },
        {
          id: "bounceSuppression",
          caption:
            "bounce سخت و شکایت عوارض جانبی دارند: ایمیل گیرنده به‌طور خودکار به فهرست مسدودی شما اضافه می‌شود (دلیل = hard_bounce یا complaint). bounce نرم / موقتی (deferred) مسدود نمی‌کند — به‌عنوان رویداد ثبت می‌شوند اما تحویل برای retry واجد شرایط می‌ماند. مسدودی‌ها در داشبورد Suppressions قابل‌مشاهده‌اند و به‌جز دلایل lift-blocked شد hard_bounce و complaint، قابل رفع هستند.",
          duration: 8500,
          scene: "bounceSuppression",
        },
        {
          id: "relatedSources",
          caption:
            "هر تحویل به یک منبع بازمی‌گردد. Broadcastها به ازای هر گیرنده در snapshot یک EmailDelivery ایجاد می‌کنند. ارسال‌های transactional (مثلاً ایمیل‌های خوش‌آمد از Automations یا پیام‌های API) به ازای هر پیام یک EmailDelivery ایجاد می‌کنند. ایمیل‌های OTP به‌عنوان sourceType جداگانه برای استفادهٔ آینده رزرو شده‌اند. همبستگی منبع ساختاری است — broadcastRecipientId یا emailMessageId — تا هر تحویل همیشه قابل ردیابی به کمپین یا پیامِ تولیدکننده باشد.",
          duration: 8000,
          scene: "relatedSources",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "placeholder را صادقانه بخوانید",
      body: "صفحهٔ «ایمیل‌های ارسالی» امروز یک placeholder ۳۱ خطی است. یک هدر (کاشی سبز آیکن Mail + «ایمیل‌های ارسالی» + زیرعنوان «هر ایمیلی که Nixify از طرف شما ارسال کرده است را پیگیری کنید.») و یک کارت خالیِ مرکزی با متن «هنوز ایمیلی ارسال نشده است. اولین OTP را از محیط تست ارسال کنید.» نمایش می‌دهد. صفحه /api/dashboard/deliveries را فراخوانی نمی‌کند. هیچ فهرستی، هیچ فیلتری، هیچ نشان وضعیتی نیست. هر چیزی که در این راهنما شبیه فهرست به‌نظر می‌رسد، یک پیش‌نمایش مفهومی است — با برچسب روشن — تا زمانی که placeholder جایگزین شود، آنچه صفحه قرار است تصویر کند را آموزش دهد.",
    },
    {
      title: "آنچه بک‌اند تحویل‌پذیری از قبل ارائه می‌کند را درک کنید",
      body: "بک‌اند واقعی است و در Phase 11 عرضه شده. GET /api/dashboard/deliveries ردیف‌های EmailDelivery صفحه‌بندی‌شده را با فیلترهای اختیاری برمی‌گرداند: sourceType (broadcast | transactional | otp)، status (queued | provider_accepted | delivered | deferred | bounced | complained | rejected | failed)، provider (smtp)، page، pageSize. GET /api/dashboard/deliveries/{deliveryId} یک ردیف به‌علاوهٔ کل تاریخچهٔ تغییرناپذیر EmailDeliveryEvent را برمی‌گرداند. دسترسی نیازمند کلید امکان CONTACTS است؛ 401 یعنی ورود لازم است، 403 یعنی feature_not_available.",
    },
    {
      title: "یک ردیف تحویل + نشان وضعیت آن را بخوانید",
      body: "هر ردیف EmailDelivery یک فیلد currentStatus دارد. queued یعنی ردیف ایجاد شده اما هنوز ارائه‌دهنده فراخوانی نشده. provider_accepted یعنی provider.send() با accepted=true برگشته — MTA بالادستی پاکت را پذیرفته. delivered یعنی یک ارائه‌دهندهٔ دارای webhook، تحویل به صندوق را گزارش داده. deferred یعنی bounce نرم/موقتی — واجد شرایط retry. bounced (سخت) یعنی شکست دائمی — پایانی. complained یعنی گیرنده ایمیل را به‌عنوان spam علامت زده — پایانی. rejected یعنی ارائه‌دهنده پیش از پذیرش پیام را رد کرده — پایانی. failed یعنی provider.send() پیش از پذیرش استثنا پرتاب کرده — پایانی. unknown یعنی provider.send() موفق شد اما ماندگاری DB وضعیت شکست خورد — پایانی نسبت به retry خودکار، اما یک webhook بعدی می‌تواند آن را پیش ببرد.",
    },
    {
      title: "تاریخچهٔ رویداد را بررسی کنید (تغییرناپذیر، دی‌دیوپ‌شده، مرتب)",
      body: "هر رویدادی که برای یک تحویل دیده شده در EmailDeliveryEvent ذخیره می‌شود، با محدودیت یکتا (provider, providerEventId) دی‌دیوپ می‌شود. حتی رویدادهایی که currentStatus را تغییر نمی‌دهند ذخیره می‌شوند — یک «delivered» دیررس پس از یک «complained» نباید شکایت را بی‌صدا پنهان کند. ترتیب رویدادها بر اساس occurredAt (مهر زمانی خود ارائه‌دهنده) است، نه زمان دریافت webhook. currentStatus از occurredAt مشتق می‌شود: یک رویداد delivered که پس از یک رویداد complained می‌رسد اما پیش از آن رخ داده، وضعیت را به delivered برنمی‌گرداند.",
    },
    {
      title: "قرارداد SMTP-در-برابر-webhook را درک کنید",
      body: "پذیرش SMTP ≠ تحویل به صندوق. ارائه‌دهندهٔ SMTP deliveryWebhooks=false دارد، پس تحویل‌های SMTP برای همیشه در provider_accepted می‌مانند — این رفتار درست است، نه حالت گیرکرده. MTA بالادستی پذیرفتن پاکت فقط یعنی مسئولیت پیام را پذیرفته؛ تنها یک ارائه‌دهندهٔ دارای webhook می‌تواند یک تحویل را به delivered ببرد. برای جریان‌های OTP/transactional که امروز از SMTP استفاده می‌کنند، ردیف تحویل در provider_accepted متوقف می‌شود و این همان وضعیت پایانیِ قابل‌مشاهدهٔ مورد انتظار است.",
    },
    {
      title: "یک تحویل را به منبعش ردیابی کنید",
      body: "هر تحویل یک sourceType دارد. تحویل‌های broadcast یک broadcastRecipientId دارند که به ردیف snapshot کمپین پیوند می‌خورد. تحویل‌های transactional یک emailMessageId دارند که به EmailMessage تولیدکننده پیوند می‌خورد. otp یک sourceType رزروشده برای استفادهٔ آینده است. همبستگی ساختاری است (FK مرکب روی ردیف DB) — پس همیشه می‌توانید یک ردیف تحویل را به کمپین یا پیام دقیق تولیدکننده ردیابی کنید، حتی پس از حذف والد (FK با ON DELETE SET NULL نال می‌شود اما خود ردیف تحویل برای انطباق حفظ می‌شود).",
    },
  ],
  whyWhen: [
    {
      title: "چرا صفحه امروز placeholder است",
      body: "بک‌اند تحویل‌پذیری در Phase 11 به‌عنوان پایه‌ای اصلاح-بحرانی عرضه شد: ماشین حالت EmailDelivery، تاریخچهٔ رویداد تغییرناپذیر، یکپارچگی مسدودی. صفحهٔ داشبورد که آن داده‌ها را به کاربران نمایش می‌دهد لایهٔ بعدی است — و هنوز متصل نشده. به جای عرضهٔ UI نیمه‌ساخته که گمراه‌کننده باشد، placeholder صادقانه می‌گوید «هنوز ایمیلی ارسال نشده» تا UI کامل آماده شود. بک‌اند production-grade است؛ بصری‌سازی، شکاف است.",
    },
    {
      title: "چرا تحویل‌های SMTP در provider_accepted می‌مانند",
      body: "پذیرش SMTP یعنی MTA بالادستی پاکت را پذیرفته (دامنهٔ گیرنده، صندوق پستی گیرنده، اندازهٔ پیام، اتصال). به این معنی نیست که پیام به صندوق ورودی گیرنده رسیده. تنها یک ارائه‌دهندهٔ دارای webhook می‌تواند این را تأیید کند — و SMTP webhook ندارد. پس برای تحویل‌های SMTP، provider_accepted عمیق‌ترین وضعیت پایانیِ قابل‌مشاهده است. این درست است، نه باگ. برای دیدن وضعیت‌های delivered به یک ارائه‌دهندهٔ دارای webhook (مثلاً یک ESP که رویدادهای تحویل را پست می‌کند) سوییچ کنید.",
    },
    {
      title: "چرا تاریخچهٔ رویداد تغییرناپذیر + دی‌دیوپ‌شده است",
      body: "تحویل webhook ذاتاً غیرقابل‌اعتماد است: رویدادها ممکن است خارج از ترتیب برسند، چندبار تحویل شوند، یا دقایق/ساعت‌ها دیررس باشند. ذخیرهٔ هر رویداد دیده‌شده (دی‌دیوپ با provider + providerEventId) یعنی گزارش رویداد، یک سابقهٔ وفادار از آنچه ارائه‌دهنده به شما گفته، به ترتیبی است که ارائه‌دهنده گفته رخ داده (بر اساس occurredAt). یک «delivered» دیررس پس از یک «complained» نباید شکایت را بی‌صدا پنهان کند — آگاهانه نسبت به انطباق: شکایت برنده است. تاریخچهٔ تغییرناپذیر، رد حسابرسی است.",
    },
    {
      title: "چه زمان به Sent Emails مراجعه کنید و چه زمان به Suppressions",
      body: "Sent Emails (هنگام عرضه) برای تحقیقات سطح تحویل است: آیا پیام از Nixify خارج شد، آیا ارائه‌دهنده پذیرفت، آیا ارائه‌دهنده گزارش داد، آخرین رویداد چه بود. Suppressions برای تصمیمات سطح گیرنده است: کدام آدرس‌ها مسدود شده‌اند، چرا، و آیا رفع مسدودی ممکن است. یک bounce سخت یا شکایت در هر دو دیده می‌شود — ردیف Sent Emails وضعیت=bounced/complained و یک نشان مسدودی نشان می‌دهد، و فهرست Suppressions یک ورودی جدید با دلیل=hard_bounce/complaint دارد. از Sent Emails برای تحقیق استفاده کنید؛ از Suppressions برای اقدام.",
    },
  ],
  mistakes: [
    {
      title: "فرض کردن اینکه صفحه امروز دادهٔ واقعی نمایش می‌دهد",
      body: "نمی‌کند. صفحهٔ فعلی placeholder است. اگر همین حالا /dashboard/emails را بارگذاری کنید، هدر و یک کارت خالی را می‌بینید. هیچ فهرستی، هیچ نشان وضعیتی، هیچ کشوی جزئیاتی نیست. هر چیزی که در این راهنما شبیه فهرست به‌نظر می‌رسد، پیش‌نمایش مفهومی است — API زیرین وجود دارد، اتصال صفحه نه. هنوز برای تحقیقات تحویل به صفحه تکیه نکنید؛ مستقیماً API را بررسی کنید یا فهرست Suppressions را برای عوارض جانبی bounce سخت/شکایت زیر نظر بگیرید.",
    },
    {
      title: "provider_accepted را به‌جای «delivered» خواندن",
      body: "provider_accepted فقط یعنی MTA بالادستی پاکت را پذیرفته. به این معنی نیست که پیام به صندوق ورودی گیرنده رسیده. برای SMTP، تحویل‌ها برای همیشه در provider_accepted می‌مانند (بدون webhook). برای ارائه‌دهندگان دارای webhook، یک رویداد delivered بعدی ردیف را پیش می‌برد. provider_accepted را به‌عنوان «پیام از دست‌های Nixify خارج شد و بالادستی مسئولیت را پذیرفت» ببینید — نه به‌عنوان تأیید صندوق ورودی.",
    },
    {
      title: "انتظار مسدود شدن bounce نرم",
      body: "فقط bounceهای HARD و شکایت‌ها مسدودی را فعال می‌کنند. bounceهای نرم/موقتی (deferred) به‌عنوان رویداد ثبت می‌شوند اما تحویل واجد شرایط retry می‌ماند و گیرنده مسدود نمی‌شود. یک تحویل deferred معمولاً با retry به delivered می‌رسد یا اگر همهٔ retryها تمام شوند به failed می‌رود. انتظار نداشته باشید گیرندهٔ deferred در فهرست Suppressions شما ظاهر شود — ظاهر نمی‌شود.",
    },
    {
      title: "تلاش برای retry دستی یک bounce سخت",
      body: "bounce سخت پایانی است — ایمیل گیرنده وجود ندارد، دامنه نامعتبر است، یا صندوق پستی برای همیشه غیرقابل‌دسترسی است. retry یک bounce سخت دیگر تولید می‌کند و سهمیه را هدر می‌دهد. اقدام درست این است: آدرس را از مخاطب خود حذف کنید (از قبل به‌طور خودکار مسدود شده) یا برای آدرسی که گمان می‌کنید typo بوده، پس از اصلاح، مسدودی را از طریق داشبورد Suppressions رفع کنید.",
    },
    {
      title: "unknown را به‌عنوان شکست بی‌صدا دیدن",
      body: "unknown یک وضعیت پایانی آگاهانه-به‌بازیابی است، نه شکست بی‌صدا. یعنی provider.send() موفق شد (پیام احتمالاً از Nixify خارج شد) اما ماندگاری DB وضعیت تحویل شکست خورد. ردیف هرگز retry خودکار نمی‌شود (ما ریسک ارسال دوگانه را نمی‌پذیریم). اما یک webhook بعدی با occurredAt جدیدتر می‌تواند آن را به delivered، bounced، complained یا rejected ببرد. اگر ردیفی را مدت طولانی در unknown گیر کرده دیدید، اقدام درست این است که مستقیماً در سمت ارائه‌دهنده تحقیق کنید — پیام احتمالاً ارسال شده.",
    },
  ],
  proTips: [
    {
      title: "امروز برای تحقیقات زنده مستقیماً از API استفاده کنید",
      body: "تا زمانی که صفحه placeholder است، API تحویل‌پذیری کاملاً کاربردی است. GET /api/dashboard/deliveries?status=bounced یا ?sourceType=broadcast را بزنید تا ردیف‌ها را مستقیماً بررسی کنید. &pageSize=50 را برای دیدن وسیع‌تر اضافه کنید. پاسخ شامل deliveryId، currentStatus، lastErrorCode، lastProviderEventAt و همهٔ مهرهای زمانی هر وضعیت است. برای تحقیقات عمیق، GET /api/dashboard/deliveries/{deliveryId} کل تاریخچهٔ رویداد را برمی‌گرداند.",
    },
    {
      title: "برای سهولت تریاژ بر اساس status فیلتر کنید",
      body: "هنگام عرضه صفحه، مفیدترین فیلتر status=bounced,complained است — آن ردیف‌هایی هستند که عارضه جانبی (مسدودی) دارند. مفیدترین بعدی status=failed و status=unknown است — ردیف‌هایی که ارائه‌دهنده پرتاب کرد یا ماندگاری DB پس از پذیرش شکست خورد. deferred عادی است و با retry خود حل می‌شود؛ مگر اینکه مدت‌ها گیر کرده باشد، آن را تریاژ نکنید.",
    },
    {
      title: "با Suppressions متقاطع ارجاع دهید",
      body: "وقتی ردیفی با status=bounced (سخت) یا complained دیدید، آن گیرنده به فهرست مسدودی شما اضافه شده. داشبورد Suppressions را باز کنید، آدرس را پیدا کنید و دلیل + منبع مسدودی را بررسی کنید. bounceهای سخت از ارسال broadcast منبع=broadcast_bounce خواهند داشت؛ شکایت‌ها منبع=complaint. این دو نما مکمل هستند: Sent Emails رد حسابرسی هر تحویل است؛ Suppressions تصمیم هر گیرنده است.",
    },
    {
      title: "برای ارتقا به ارائه‌دهندهٔ دارای webhook برنامه‌ریزی کنید",
      body: "اگر به تأیید واقعی تحویل به صندوق (وضعیت delivered) نیاز دارید، به یک ارائه‌دهندهٔ دارای webhook نیاز دارید. SMTP نمی‌تواند گزارش دهد. سرویس Deliverability برای دریافت رویدادهای webhook از طریق ingestProviderEvent ساخته شده — سوییچ به ESP که رویدادهای delivered/bounced/complained را پست می‌کند، آن وضعیت‌ها را به‌طور خودکار ظاهر می‌کند. زیرساخت وجود دارد؛ فقط یکپارچه‌سازی ارائه‌دهنده شکاف است.",
    },
  ],
  troubleshooting: [
    {
      title: "صفحه کارت placeholder خالی را نشان می‌دهد",
      body: "این انتظار می‌رود. صفحهٔ «ایمیل‌های ارسالی» امروز placeholder است. هیچ فهرستی برای بارگذاری وجود ندارد. برای بررسی دادهٔ واقعی تحویل، مستقیماً از GET /api/dashboard/deliveries استفاده کنید. صفحه در فاز آینده با UI واقعی جایگزین می‌شود؛ این راهنما مفهوم را آموزش می‌دهد تا امروز بتوانید از API استفاده کنید و هنگام عرضه صفحه را درک کنید.",
    },
    {
      title: "API با 401 unauthorized برمی‌گردد",
      body: "ورود لازم است. ابتدا POST /api/auth/login را بزنید تا کوکی session دریافت کنید، سپس تلاش کنید. کوکی session از نوع httpOnly + secure + sameSite=lax است و توسط getAuthenticatedUser() در هر درخواست اعتبارسنجی می‌شود. بدون کوکی = 401.",
    },
    {
      title: "API با 403 feature_not_available برمی‌گردد",
      body: "داشبورد تحویل‌پذیری نیازمند کلید امکان CONTACTS است. طرح فعلی شما شامل آن نیست. به طرحی با Contacts ارتقا دهید — ایمیل‌های Broadcast و Sent Emails هر دو به همان امکان وابسته‌اند. پاسخ 403 دارای code = feature_not_available است.",
    },
    {
      title: "تحویل در provider_accepted گیر کرده",
      body: "اگر از SMTP استفاده می‌کنید، این درست و مورد انتظار است — SMTP هیچ webhook تحویلی ندارد، پس ردیف برای همیشه در provider_accepted می‌ماند. پیام احتمالاً به MTA بالادستی رسیده و ممکن است تحویل شده باشد، اما Nixify بدون webhook نمی‌تواند تحویل به صندوق را تأیید کند. اگر وضعیت‌های delivered واقعی می‌خواهید، به یک ارائه‌دهندهٔ دارای webhook سوییچ کنید.",
    },
    {
      title: "تحویل در وضعیت unknown",
      body: "provider.send() موفق شد اما نوشتن DB وضعیت نتیجه شکست خورد (اختلال شبکه، timeout پایگاه داده). ردیف هرگز retry خودکار نمی‌شود (ما ریسک ارسال دوگانه را نمی‌پذیریم). پیام احتمالاً از Nixify خارج شده. یک webhook بعدی با occurredAt جدیدتر همچنان می‌تواند آن را به یک وضعیت پایانی مشخص (delivered، bounced، complained، rejected) ببرد. اگر unknown دیدید، منتظر webhook بمانید یا مستقیماً در سمت ارائه‌دهنده تحقیق کنید.",
    },
    {
      title: "گیرنده مسدود شده اما انتظارش را نداشتید",
      body: "ردیف Sent Emails را بررسی کنید (فعلاً از طریق API): اگر status=bounced (سخت) یا complained است، گیرنده به‌طور خودکار مسدود شده. ردیف SuppressionEvent دلیل (hard_bounce یا complaint) و منبع را ثبت می‌کند. bounceهای سخت و شکایت‌ها به‌طرز طراحی LIFT-BLOCKED هستند — فقط با درخواست پشتیبانی قابل رفع هستند، نه با resubscribe عادی، زیرا ارسال مجدد به آدرس بد-شناخته‌شده یا شکایت‌کننده، ریسک تحویل‌پذیری است.",
    },
  ],
  checklist: [
    { label: "بدانید صفحه امروز placeholder است — هنوز فهرست زنده‌ای نیست" },
    { label: "۹ کد وضعیت را بدانید و کدام پایانی هستند" },
    { label: "بدانید provider_accepted ≠ delivered (به‌ویژه برای SMTP)" },
    { label: "بدانید فقط bounceهای سخت + شکایت‌ها مسدودی را فعال می‌کنند" },
    { label: "بدانید تاریخچهٔ رویداد تغییرناپذیر، دی‌دیوپ‌شده و بر اساس occurredAt مرتب است" },
    { label: "بدانید چگونه مستقیماً از GET /api/dashboard/deliveries برای تحقیقات استفاده کنید" },
  ],
  whatNext:
    "هنگام عرضه صفحهٔ Sent Emails، از آن برای تریاژ بر اساس status استفاده کنید — با bounced و complained شروع کنید (این‌ها عارضهٔ مسدودی دارند)، سپس failed و unknown (این‌ها تحقیق می‌خواهند)، سپس deferred (معمولاً خودحل‌شونده). برای تصمیمات هر گیرنده با داشبورد Suppressions متقاطع ارجاع دهید. برای تأیید تحویل بلادرنگ، مهاجرت به یک ارائه‌دهندهٔ دارای webhook برنامه‌ریزی کنید تا وضعیت delivered قابل‌مشاهده شود.",
  related: [
    { label: "داشبورد ایمیل‌های ارسالی", href: "/dashboard/emails" },
    { label: "راهنمای Broadcasts", href: "/guide/broadcasts" },
    { label: "راهنمای Suppressions", href: "/guide/suppressions" },
  ],

  /* ─── Stage copy ──────────────────────────────────────────────────────── */
  stage: {
    dir: "rtl",
    locale: "fa",

    header: {
      title: "ایمیل‌های ارسالی",
      subtitle: "هر ایمیلی که Nixify از طرف شما ارسال کرده است را پیگیری کنید.",
      backToDashboard: "بازگشت به نمای کلی",
    },

    placeholder: {
      body: "هنوز ایمیلی ارسال نشده است. اولین OTP را از محیط تست ارسال کنید.",
      calloutTitle: "امروز placeholder",
      calloutBody:
        "این صحنه صفحهٔ واقعی /dashboard/emails را دقیقاً همان‌طور که عرضه شده بازتاب می‌دهد — یک placeholder ۳۱ خطی با یک کارت خالی. هیچ فهرستی، هیچ فیلتری، هیچ فراخوانی API. بک‌اند تحویل‌پذیری وجود دارد؛ اتصال صفحه نه.",
    },

    concept: {
      tag: "پیش‌نمایش مفهومی — UI واقعی امروز نیست",
      cardTitle: "ایمیل‌های ارسالی",
      cardSubtitle:
        "آنچه صفحه هنگام اتصال به GET /api/dashboard/deliveries شبیه آن می‌شود. فقط داده‌های دمو محلی — هرگز فراخوانی نمی‌شود.",
      caption:
        "هر ردیف یک EmailDelivery است. نشان وضعیت رنگ ردیف را تعیین می‌کند. bounceهای سخت و شکایت‌ها یک نشان مسدودی دارند — آن گیرنده‌ها همچنین در فهرست Suppressions شما هستند.",
    },

    table: {
      recipient: "گیرنده",
      subject: "موضوع",
      source: "منبع",
      status: "وضعیت",
      error: "خطا",
      created: "ایجاد شده",
    },

    statusLabels: {
      queued: "در صف",
      provider_accepted: "پذیرفته‌شده توسط ارائه‌دهنده",
      delivered: "تحویل شده",
      deferred: "به تعویق افتاده",
      bounced: "bounce شده",
      complained: "شکایت شده",
      rejected: "رد شده",
      failed: "ناموفق",
      unknown: "ناشناخته",
    },

    suppressionPill: "مسدود شده",

    sourceLabels: {
      broadcast: "Broadcast",
      transactional: "تراکنشی",
      otp: "OTP",
    },

    filters: {
      sourceType: "نوع منبع",
      status: "وضعیت",
      provider: "ارائه‌دهنده",
      all: "همه",
      apply: "اعمال",
      reset: "بازنشانی",
    },

    noMatches: "هیچ تحویلی با فیلترهای شما مطابقت ندارد.",

    pagination: {
      pageOf: (page, total) => `صفحه ${page} · ${total} مجموع`,
      prev: "قبلی",
      next: "بعدی",
    },

    eventTimeline: {
      tag: "پیش‌نمایش مفهومی — UI واقعی امروز نیست",
      cardTitle: "جزئیات تحویل",
      cardSubtitle:
        "آنچه کشوی جزئیات نشان می‌داد: ردیف EmailDelivery + کل تاریخچهٔ تغییرناپذیر EmailDeliveryEvent، مرتب بر اساس occurredAt.",
      deliveryIdLabel: "شناسه تحویل",
      recipientLabel: "گیرنده",
      statusLabel: "وضعیت",
      providerLabel: "ارائه‌دهنده",
      sourceLabel: "منبع",
      historyTitle: "تاریخچهٔ رویداد",
      footnote:
        "تغییرناپذیر + دی‌دیوپ‌شده با (provider, providerEventId). مرتب بر اساس occurredAt — webhookهای خارج از ترتیب نمی‌توانند currentStatus را برگردانند. یک «delivered» دیررس پس از یک «complained» به‌عنوان رویداد ذخیره می‌شود اما شکایت را لغو نمی‌کند.",
      dismiss: "بستن",
    },

    sourcesCard: {
      title: "نحوهٔ ارتباط ایمیل‌ها با سایر سطوح",
      subtitle:
        "هر EmailDelivery به یک منبع بازمی‌گردد — یک broadcast، یک پیام transactional، یا (رزروشده برای استفادهٔ آینده) یک OTP. همبستگی ساختاری است: یک FK مرکب روی خود ردیف.",
      rows: [
        {
          key: "broadcast",
          label: "Broadcasts",
          desc: "به ازای هر گیرنده در snapshot کمپین یک EmailDelivery. پیوند از طریق broadcastRecipientId.",
          token: "broadcastRecipientId",
          tone: "broadcast",
        },
        {
          key: "transactional",
          label: "تراکنشی",
          desc: "به ازای هر پیام API یا ایمیل فعال‌شده توسط automation یک EmailDelivery. پیوند از طریق emailMessageId.",
          token: "emailMessageId",
          tone: "transactional",
        },
        {
          key: "otp",
          label: "OTP (رزروشده)",
          desc: "sourceType رزروشده برای تحویل‌های همبسته با OTP آینده. در حال حاضر توسط داشبورد منتشر نمی‌شود.",
          token: "sourceType: \"otp\"",
          tone: "otp",
        },
      ],
      footnote:
        "FK مرکب (userId, broadcastRecipientId) یا (userId, emailMessageId) است. ON DELETE SET NULL بدون حذف تحویل، FK را نال می‌کند — ردیف برای حسابرسی انطباق حفظ می‌شود.",
    },

    /* تحویل‌های دمو نشان‌داده‌شده در فهرست شبیه‌سازی‌شده. هرگز فراخوانی نمی‌شوند.
     * اعداد طوری انتخاب شده‌اند که هر وضعیت قابل‌مشاهده را پوشش دهند: queued،
     * provider_accepted، delivered، deferred، bounced، complained، rejected،
     * failed و unknown. */
    deliveries: [
      {
        id: 1,
        deliveryId: "d-7c3b9f1e-4a2d-4e7b-9c1a-8b4f5e2d3a01",
        recipient: "sara@example.com",
        subject: "MailGuard: Verify your email",
        sourceType: "transactional",
        sourceLabel: "پیام API",
        provider: "smtp",
        currentStatus: "delivered",
        suppressionApplied: false,
        lastErrorCode: null,
        createdAtRelative: "همین حالا",
        isLive: false,
      },
      {
        id: 2,
        deliveryId: "d-9f4c2a8b-3e1d-4f8a-b5c7-2e9d1a4b6c02",
        recipient: "ali@example.org",
        subject: "September product update",
        sourceType: "broadcast",
        sourceLabel: "به‌روزرسانی محصول ماهانه",
        provider: "smtp",
        currentStatus: "provider_accepted",
        suppressionApplied: false,
        lastErrorCode: null,
        createdAtRelative: "۲ دقیقه پیش",
        isLive: false,
      },
      {
        id: 3,
        deliveryId: "d-2e8a1c5d-7b9f-4e2a-8c1d-5f3b7e9a4c03",
        recipient: "leo@baddomain.xyz",
        subject: "September product update",
        sourceType: "broadcast",
        sourceLabel: "به‌روزرسانی محصول ماهانه",
        provider: "smtp",
        currentStatus: "bounced",
        suppressionApplied: true,
        lastErrorCode: "smtp_5xx_permanent",
        createdAtRelative: "۳ دقیقه پیش",
        isLive: false,
      },
      {
        id: 4,
        deliveryId: "d-5b3d9e2a-1c4f-4b8a-9e5d-2a7c1b3d8e04",
        recipient: "maria@example.com",
        subject: "Welcome, {{first_name}}!",
        sourceType: "transactional",
        sourceLabel: "اتوماسیون: سری خوش‌آمد",
        provider: "smtp",
        currentStatus: "queued",
        suppressionApplied: false,
        lastErrorCode: null,
        createdAtRelative: "همین حالا",
        isLive: true,
      },
      {
        id: 5,
        deliveryId: "d-8f1b4c7e-2a5d-4e9b-8c1a-3d6b5e9a2c05",
        recipient: "noah@example.net",
        subject: "Your one-time passcode",
        sourceType: "transactional",
        sourceLabel: "پیام API",
        provider: "smtp",
        currentStatus: "deferred",
        suppressionApplied: false,
        lastErrorCode: "smtp_4xx_transient",
        createdAtRelative: "۵ دقیقه پیش",
        isLive: false,
      },
      {
        id: 6,
        deliveryId: "d-3a7e5b9c-1d4f-4c2a-9e8b-5a3d7c1b9e06",
        recipient: "ana@oldprovider.com",
        subject: "September product update",
        sourceType: "broadcast",
        sourceLabel: "به‌روزرسانی محصول ماهانه",
        provider: "smtp",
        currentStatus: "complained",
        suppressionApplied: true,
        lastErrorCode: null,
        createdAtRelative: "۱۲ دقیقه پیش",
        isLive: false,
      },
      {
        id: 7,
        deliveryId: "d-6c2a9e1b-4d8f-4a5c-b3e7-9f1a2b5c8d07",
        recipient: "jun@oversize.invalid",
        subject: "September product update",
        sourceType: "broadcast",
        sourceLabel: "به‌روزرسانی محصول ماهانه",
        provider: "smtp",
        currentStatus: "rejected",
        suppressionApplied: false,
        lastErrorCode: "provider_message_too_large",
        createdAtRelative: "۸ دقیقه پیش",
        isLive: false,
      },
      {
        id: 8,
        deliveryId: "d-1d5b8c3a-9e7f-4c2b-a8d1-6c4b2e9a7f08",
        recipient: "kai@example.com",
        subject: "Your one-time passcode",
        sourceType: "transactional",
        sourceLabel: "پیام API",
        provider: "smtp",
        currentStatus: "failed",
        suppressionApplied: false,
        lastErrorCode: "provider_connection_timeout",
        createdAtRelative: "۱۵ دقیقه پیش",
        isLive: false,
      },
      {
        id: 9,
        deliveryId: "d-4e8a1b6c-3d7f-4a9b-8c5e-1b3a7d9c2e09",
        recipient: "ren@example.com",
        subject: "Welcome, {{first_name}}!",
        sourceType: "transactional",
        sourceLabel: "پیام API",
        provider: "smtp",
        currentStatus: "unknown",
        suppressionApplied: false,
        lastErrorCode: "db_persistence_failed_post_accept",
        createdAtRelative: "۲۰ دقیقه پیش",
        isLive: false,
      },
    ],

    /* ردیف‌های تاریخچهٔ رویداد دمو برای overlay تایم‌لاین. هرگز فراخوانی نمی‌شوند.
     * مرتب صعودی بر اساس occurredAt. */
    events: [
      {
        id: 1,
        type: "queued",
        desc: "ردیف تحویل با currentStatus = queued ایجاد شد. ارائه‌دهنده هنوز فراخوانی نشده.",
        occurredAt: "2026-09-21T08:42:11.000Z",
        token: "queued",
        tone: "neutral",
      },
      {
        id: 2,
        type: "accepted",
        desc: "provider.send() با accepted=true برگشت. MTA بالادستی پاکت را پذیرفت.",
        occurredAt: "2026-09-21T08:42:11.820Z",
        token: "provider_accepted",
        tone: "good",
      },
      {
        id: 3,
        type: "deferred",
        desc: "bounce نرم / موقتی. تحویل واجد شرایط retry می‌ماند. بدون مسدودی.",
        occurredAt: "2026-09-21T08:42:48.140Z",
        token: "deferred · bounceType=soft",
        tone: "warn",
      },
      {
        id: 4,
        type: "delivered",
        desc: "ارائه‌دهنده موفقیت تحویل به صندوق را گزارش داد (رویداد webhook). currentStatus به delivered پیش می‌رود.",
        occurredAt: "2026-09-21T08:43:02.550Z",
        token: "delivered",
        tone: "good",
      },
      {
        id: 5,
        type: "complained",
        desc: "گیرنده ایمیل را به‌عنوان spam علامت زد (رویداد webhook). currentStatus به complained پیش می‌رود. مسدودی با دلیل = complaint اعمال شد.",
        occurredAt: "2026-09-21T09:14:33.012Z",
        token: "complained · suppressionApplied=true",
        tone: "bad",
      },
    ],
  },

  /* ─── Creative section copy ──────────────────────────────────────────── */
  creative: {
    /* ۱. چرخهٔ حیات ایمیل — ماشین حالت EmailDelivery */
    lifecycle: {
      heading: "چرخهٔ حیات ایمیل",
      subheading:
        "هر ردیف EmailDelivery از یک ماشین حالت کوچک عبور می‌کند. هر وضعیت یک رنگ نشان، یک عارضهٔ جانبی (مسدودی؟ retry؟) و یک قانون انتقال دارد. این قرارداد توسط src/lib/deliverability/service.ts اعمال می‌شود — مسیرها و سایر سرویس‌ها نباید مستقیماً ردیف‌های EmailDelivery را تغییر دهند.",
      statesTitle: "وضعیت‌ها",
      states: [
        {
          code: "queued",
          label: "در صف",
          desc: "حالت اولیه. ردیف تحویل ایجاد شده (توسط سرویس broadcast یا پیام‌رسانی تراکنشی) اما provider.send() هنوز فراخوانی نشده.",
          terminal: false,
          canAdvance: true,
        },
        {
          code: "provider_accepted",
          label: "پذیرفته‌شده توسط ارائه‌دهنده",
          desc: "provider.send() با accepted=true برگشت. MTA بالادستی پاکت را پذیرفت. برابر با تحویل به صندوق نیست — SMTP webhook ندارد، پس تحویل‌های SMTP برای همیشه اینجا می‌مانند.",
          terminal: false,
          canAdvance: true,
        },
        {
          code: "delivered",
          label: "تحویل شده",
          desc: "یک ارائه‌دهندهٔ دارای webhook موفقیت تحویل به صندوق را گزارش داد. پایانی — به‌جز override صریح delivered → complained (قانون برنده‌بودن شکایت).",
          terminal: true,
          canAdvance: true,
          sideEffect: "انطباق: همچنان می‌تواند توسط یک webhook بعدی به complained پیش برود.",
        },
        {
          code: "deferred",
          label: "به تعویق افتاده",
          desc: "bounce نرم/موقتی (مثلاً صندوق پستی پر، مشکل موقت DNS). غیرپایانی و واجد شرایط retry. مسدودی را فعال نمی‌کند.",
          terminal: false,
          canAdvance: true,
        },
        {
          code: "bounced",
          label: "bounce شده (سخت)",
          desc: "bounce سخت — گیرنده وجود ندارد، دامنه نامعتبر است، یا صندوق پستی برای همیشه غیرقابل‌دسترسی. پایانی. مسدودی را با دلیل = hard_bounce فعال می‌کند.",
          terminal: true,
          canAdvance: false,
          sideEffect: "گیرنده را مسدود می‌کند (hard_bounce).",
        },
        {
          code: "complained",
          label: "شکایت شده",
          desc: "گیرنده ایمیل را به‌عنوان spam علامت زد (رویداد webhook از ارائه‌دهنده). پایانی. مسدودی را با دلیل = complaint فعال می‌کند.",
          terminal: true,
          canAdvance: false,
          sideEffect: "گیرنده را مسدود می‌کند (complaint).",
        },
        {
          code: "rejected",
          label: "رد شده",
          desc: "provider.send() با accepted=false برگشت — ارائه‌دهنده پیش از پذیرش پیام را رد کرد (مثلاً پیام خیلی بزرگ، نقض سیاست). پایانی. بدون مسدودی (پیام هرگز به گیرنده نرسید).",
          terminal: true,
          canAdvance: false,
        },
        {
          code: "failed",
          label: "ناموفق",
          desc: "provider.send() پیش از پذیرش استثنا پرتاب کرد (مثلاً timeout اتصال، شکست auth). پایانی. بدون مسدودی (پیام احتمالاً هرگز به بالادستی نرسید).",
          terminal: true,
          canAdvance: false,
        },
        {
          code: "unknown",
          label: "ناشناخته",
          desc: "provider.send() موفق شد اما ماندگاری DB وضعیت تحویل شکست خورد. پایانی نسبت به retry خودکار (هرگز دوباره ارسال نمی‌شود، برای جلوگیری از ارسال دوگانه). اما یک webhook بعدی با occurredAt جدیدتر همچنان می‌تواند آن را به یک وضعیت پایانی مشخص ببرد.",
          terminal: true,
          canAdvance: true,
          sideEffect: "آگاهانه به بازیابی: یک رویداد webhook جدیدتر هنوز می‌تواند آن را حل کند.",
        },
      ],
      transitionsTitle: "انتقال‌ها",
      transitions: [
        {
          label: "پذیرش پاکت توسط ارائه‌دهنده",
          from: "queued",
          to: "provider_accepted",
          desc: "provider.send() با accepted=true برگشت. به‌روزرسانی CAS — فقط یک worker برندهٔ queued → provider_accepted می‌شود. acceptedAt + providerMessageId را تنظیم می‌کند.",
          sideEffect: "lastProviderEventAt پیش نمی‌رود (فقط رویدادهای webhook آن را پیش می‌برند).",
          tone: "normal",
        },
        {
          label: "Webhook: تحویل شده",
          from: "provider_accepted",
          to: "delivered",
          desc: "یک ارائه‌دهندهٔ دارای webhook یک رویداد delivered با occurredAt ≥ آخرین رویداد دیده‌شده پست کرد.",
          sideEffect: "deliveredAt را تنظیم می‌کند. بدون مسدودی.",
          tone: "good",
        },
        {
          label: "Webhook: deferred (bounce نرم)",
          from: "provider_accepted",
          to: "deferred",
          desc: "یک رویداد webhook با type=deferred یا type=bounced + bounceType=soft. غیرپایانی؛ واجد شرایط retry.",
          sideEffect: "lastProviderEventAt را پیش می‌برد. بدون مسدودی (bounceهای نرم مسدود نمی‌کنند).",
          tone: "warn",
        },
        {
          label: "Webhook: bounce سخت",
          from: "provider_accepted",
          to: "bounced",
          desc: "یک رویداد webhook با type=bounced + bounceType=hard. شکست دائمی. پایانی.",
          sideEffect: "bouncedAt را تنظیم می‌کند. گیرنده را با دلیل = hard_bounce مسدود می‌کند.",
          tone: "bad",
        },
        {
          label: "Webhook: شکایت",
          from: "provider_accepted",
          to: "complained",
          desc: "یک رویداد webhook با type=complained. گیرنده ایمیل را به‌عنوان spam علامت زد. پایانی.",
          sideEffect: "complainedAt را تنظیم می‌کند. گیرنده را با دلیل = complaint مسدود می‌کند.",
          tone: "bad",
        },
        {
          label: "رد پیام توسط ارائه‌دهنده",
          from: "queued",
          to: "rejected",
          desc: "provider.send() با accepted=false برگشت (مثلاً پیام خیلی بزرگ، نقض سیاست). به‌روزرسانی CAS از queued → rejected. rejectedAt + lastErrorCode را تنظیم می‌کند.",
          sideEffect: "بدون مسدودی (پیام هرگز به گیرنده نرسید).",
          tone: "bad",
        },
        {
          label: "پرتاب استثنا توسط فراخوان ارائه‌دهنده",
          from: "queued",
          to: "failed",
          desc: "provider.send() پیش از پذیرش استثنا پرتاب کرد (timeout اتصال، شکست auth). به‌روزرسانی CAS از queued → failed. failedAt + lastErrorCode را تنظیم می‌کند.",
          sideEffect: "بدون مسدودی (پیام احتمالاً هرگز به بالادستی نرسید).",
          tone: "bad",
        },
        {
          label: "برنده‌بودن شکایت (override)",
          from: "delivered",
          to: "complained",
          desc: "تنها انتقال رو به‌جلو مجاز از یک وضعیت پایانی. یک شکایت پس از یک delivered رسید. شکایت سیگنال قوی‌تر انطباق است.",
          sideEffect: "complainedAt را تنظیم می‌کند. گیرنده را با دلیل = complaint مسدود می‌کند.",
          tone: "bad",
        },
        {
          label: "بازیابی از unknown",
          from: "unknown",
          to: "delivered",
          desc: "یک رویداد webhook بعدی با occurredAt جدیدتر یک ردیف unknown را به یک وضعیت پایانی مشخص (delivered، bounced، complained یا rejected) می‌برد.",
          sideEffect: "رد حسابرسی ردیف را بازیابی می‌کند. همچنان بدون retry خودکار ارسال اصلی.",
          tone: "recovery",
        },
      ],
      footnote:
        "وضعیت‌های پایانی (delivered، bounced، complained، rejected، failed) انتقال دیگری ندارند — به‌جز override صریح delivered → complained. unknown نسبت به retry خودکار پایانی تلقی می‌شود اما همچنان می‌تواند توسط یک رویداد webhook جدیدتر پیش برود. قوانین never-regress زیر از انطباق محافظت می‌کنند: یک «delivered» دیررس پس از یک «complained» به‌عنوان رویداد ذخیره می‌شود اما شکایت را لغو نمی‌کند.",
      smtpNote:
        "SMTP دارای deliveryWebhooks=false است. تحویل‌های SMTP برای همیشه در provider_accepted می‌مانند — MTA بالادستی پاکت را پذیرفت، اما هیچ راهی برای SMTP جهت تأیید تحویل به صندوق وجود ندارد. این رفتار درست است. برای دیدن وضعیت‌های delivered به یک ارائه‌دهندهٔ دارای webhook سوییچ کنید.",
    },

    /* ۲. تفسیر وضعیت — ماتریس معنای هر وضعیت */
    statusInterpretation: {
      heading: "تفسیر وضعیت",
      subheading:
        "هر یک از ۹ کد وضعیت یک محرک، یک عارضهٔ جانبی و یک اقدام ممکن دارد. هنگام تریاژ یک ردیف تحویل از این ماتریس استفاده کنید: وضعیت به شما می‌گوید چه اتفاقی افتاده؛ عارضهٔ جانبی می‌گوید بعد چه بررسی کنید (فهرست Suppressions؟ retry؟ لاگ‌های ارائه‌دهنده؟).",
      matrixTitle: "مرجع هر وضعیت",
      matrixSubtitle:
        "کد وضعیت (LTR) → برچسب انسانی → چه چیزی فعالش کرد → عارضهٔ جانبی → چه کاری می‌توانید انجام دهید.",
      colStatus: "وضعیت",
      colTrigger: "محرک",
      colSideEffect: "عارضهٔ جانبی",
      colAction: "اقدام",
      rows: [
        {
          code: "queued",
          label: "در صف",
          trigger: "createDelivery() توسط سرویس broadcast یا پیام‌رسانی تراکنشی فراخوانی شد.",
          sideEffect: "هیچ. ردیف در انتظار ارسال توسط ارائه‌دهنده.",
          action: "صبر کنید — یک worker پس‌زمینه در عرض ثانی‌ها آن را claim می‌کند. اگر دقایق گیر کرد، سلامت worker را بررسی کنید.",
          tone: "neutral",
        },
        {
          code: "provider_accepted",
          label: "پذیرفته‌شده توسط ارائه‌دهنده",
          trigger: "provider.send() با accepted=true برگشت. MTA بالادستی پاکت را پذیرفت.",
          sideEffect: "acceptedAt + providerMessageId تنظیم شد. lastProviderEventAt تنظیم نشد (فقط رویدادهای webhook آن را پیش می‌برند).",
          action: "برای SMTP: این عمیق‌ترین وضعیت پایانیِ قابل‌مشاهده است — webhook‌ای برای پیشبردن بیشتر نیست. برای ارائه‌دهندگان دارای webhook: منتظر webhook delivered/bounced/complained بمانید.",
          tone: "good",
        },
        {
          code: "delivered",
          label: "تحویل شده",
          trigger: "یک ارائه‌دهندهٔ دارای webhook یک رویداد delivered با occurredAt ≥ آخرین دیده‌شده پست کرد.",
          sideEffect: "deliveredAt تنظیم شد. بدون مسدودی. همچنان می‌تواند توسط یک webhook شکایت بعدی به complained برسد.",
          action: "هیچ‌چیز — پیام طبق گفتهٔ ارائه‌دهنده به صندوق ورودی گیرنده رسید. برای یک رویداد شکایت بعدی زیر نظر بگیرید.",
          tone: "good",
        },
        {
          code: "deferred",
          label: "به تعویق افتاده",
          trigger: "یک رویداد webhook با type=deferred، یا type=bounced + bounceType=soft (موقتی).",
          sideEffect: "lastProviderEventAt پیش رفت. بدون مسدودی (bounceهای نرم مسدود نمی‌کنند). واجد شرایط retry.",
          action: "صبر کنید — معمولاً با retry به delivered حل می‌شود، یا اگر همهٔ retryها تمام شوند به failed می‌رود. گیرنده را مسدود نکنید.",
          tone: "warn",
        },
        {
          code: "bounced",
          label: "bounce شده (سخت)",
          trigger: "یک رویداد webhook با type=bounced + bounceType=hard. شکست دائمی.",
          sideEffect: "bouncedAt تنظیم شد. مسدودی با دلیل = hard_bounce اعمال شد. پایانی.",
          action: "آدرس را از مخاطب حذف کنید (از قبل مسدود شده). retry نکنید — دوباره bounce می‌خورید و سهمیه را هدر می‌دهید.",
          tone: "bad",
        },
        {
          code: "complained",
          label: "شکایت شده",
          trigger: "یک رویداد webhook با type=complained. گیرنده ایمیل را به‌عنوان spam علامت زد.",
          sideEffect: "complainedAt تنظیم شد. مسدودی با دلیل = complaint اعمال شد. پایانی.",
          action: "مسدودی را رعایت کنید — retry نکنید. محتوای کمپین/فرکانسی که شکایت تولید کرد را تحقیق کنید.",
          tone: "bad",
        },
        {
          code: "rejected",
          label: "رد شده",
          trigger: "provider.send() با accepted=false برگشت (پیام خیلی بزرگ، نقض سیاست و غیره).",
          sideEffect: "rejectedAt + lastErrorCode تنظیم شد. بدون مسدودی (پیام هرگز به گیرنده نرسید). پایانی.",
          action: "lastErrorCode را بررسی کنید. پیام را اصلاح (اندازه، سیاست محتوا، نحوی گیرنده) و به‌عنوان یک تحویل جدید دوباره ارسال کنید.",
          tone: "bad",
        },
        {
          code: "failed",
          label: "ناموفق",
          trigger: "provider.send() پیش از پذیرش استثنا پرتاب کرد (timeout اتصال، شکست auth).",
          sideEffect: "failedAt + lastErrorCode تنظیم شد. بدون مسدودی (پیام احتمالاً هرگز به بالادستی نرسید). پایانی.",
          action: "lastErrorCode را بررسی کنید. احتمالاً یک مشکل موقت ارائه‌دهنده — پس از رفع علت، به‌عنوان یک تحویل جدید retry کنید.",
          tone: "bad",
        },
        {
          code: "unknown",
          label: "ناشناخته",
          trigger: "provider.send() موفق شد اما ماندگاری DB وضعیت نتیجه شکست خورد (اختلال شبکه، timeout DB).",
          sideEffect: "بدون مسدودی. هرگز retry خودکار نمی‌شود (ما ریسک ارسال دوگانه را نمی‌پذیریم). یک webhook بعدی با occurredAt جدیدتر می‌تواند آن را پیش ببرد.",
          action: "retry خودکار نکنید. برای یک رویداد webhook صبر کنید یا مستقیماً در سمت ارائه‌دهنده تحقیق کنید — پیام احتمالاً از Nixify خارج شده.",
          tone: "recovery",
        },
      ],
      smtpDeliveredNote:
        "برای ارائه‌دهندگان SMTP، وضعیت delivered غیرقابل‌دسترس است — SMTP webhook تحویلی ندارد. تحویل‌های SMTP در provider_accepted می‌مانند. برای دیدن وضعیت‌های delivered به یک ESP دارای webhook که رویدادهای تحویل را پست می‌کند سوییچ کنید.",
      unknownRecoveryNote:
        "unknown نسبت به retry خودکار پایانی تلقی می‌شود (هرگز دوباره ارسال نمی‌شود) تا از ارسال دوگانه جلوگیری شود. اما یک رویداد webhook بعدی با occurredAt جدیدتر همچنان می‌تواند آن را به delivered، bounced، complained یا rejected ببرد — رد حسابرسی را بدون ارسال مجدد پیام اصلی بازیابی می‌کند.",
      neverRegressNote:
        "قوانین never-regress: (۱) delivered → سپس یک deferred دیررس → در delivered بمان. (۲) complained → سپس یک delivered دیررس → در complained بمان (برنده‌بودن شکایت). (۳) bounced (سخت) → پایانی، بدون برگشت. (۴) تنها انتقال رو به‌جلو مجاز از یک وضعیت پایانی delivered → complained است (override انطباق).",
    },

    /* ۳. تایم‌لاین تحویل — تاریخچهٔ EmailDeliveryEvent + قوانین never-regress */
    deliveryTimeline: {
      heading: "تایم‌لاین تحویل",
      subheading:
        "هر رویدادی که برای یک تحویل دیده شده در EmailDeliveryEvent ذخیره می‌شود — تغییرناپذیر، دی‌دیوپ‌شده و مرتب بر اساس occurredAt. currentStatus قابل‌مشاهده از این تایم‌لاین مشتق می‌شود. درک نحوه ذخیره و ترتیب رویدادها توضیح می‌دهد چرا یک webhook دیررس نمی‌تواند دربارهٔ آنچه رخ داده دروغ بگوید.",
      stepsTitle: "نحوهٔ ذخیرهٔ رویدادها",
      steps: [
        {
          badge: "۰۱",
          title: "رویداد از طریق webhook می‌رسد",
          body: "یک ارائه‌دهنده یک رویداد webhook را به endpoint دریافت پست می‌کند. رویداد شامل provider، providerMessageId (برای حل ردیف تحویل)، providerEventId (برای دی‌دیوپ)، type، occurredAt (مهر زمانی خود ارائه‌دهنده) و bounceType + safeMetadata اختیاری است.",
          token: "POST /api/dashboard/deliveries/{deliveryId}/events (یا URL webhook)",
          tone: "ui",
        },
        {
          badge: "۰۲",
          title: "دی‌دیوپ با (provider, providerEventId)",
          body: "محدودیت یکتا (provider, providerEventId) در سطح DB اعمال می‌شود. یک webhook تکراری (همان providerEventId) گرفته می‌شود — رویداد یک‌بار و فقط یک‌بار ثبت می‌شود. P2002 از محدودیت یکتا بیرون تراکنش گرفته می‌شود و با بازخوانی حل می‌شود.",
          token: "@@unique([provider, providerEventId])",
          tone: "state",
        },
        {
          badge: "۰۳",
          title: "ترتیب بر اساس occurredAt، نه زمان دریافت",
          body: "رویدادها بر اساس مهر زمانی occurredAt (مهر خود ارائه‌دهنده) مرتب می‌شوند، نه بر اساس زمان دریافت webhook. یک رویداد delivered که پس از یک رویداد complained می‌رسد اما پیش از آن رخ داده، وضعیت را به delivered برنمی‌گرداند. تحویل webhook ذاتاً غیرقابل‌اعتماد است؛ occurredAt منبع حقیقت است.",
          token: "occurredAt ASC",
          tone: "state",
        },
        {
          badge: "۰۴",
          title: "مشتق‌سازی currentStatus",
          body: "currentStatus از آخرین رویداد قابل-عدم-برگشت مشتق می‌شود. اگر رویداد ورودی قدیمی‌تر از occurredAt آخرین رویداد دیده‌شده باشد، در تاریخچه ذخیره می‌شود اما currentStatus تغییر نمی‌کند (قانون never-regress).",
          token: "if (incoming.occurredAt < lastEventAt) → ذخیره، بدون انتقال",
          tone: "state",
        },
        {
          badge: "۰۵",
          title: "عوارض جانبی هنگام انتقال فعال می‌شوند",
          body: "اگر currentStatus تغییر کند، عوارض جانبی فعال می‌شوند: bounce سخت → suppressEmail(reason=hard_bounce)؛ شکایت → suppressEmail(reason=complaint). bounceهای نرم و سایر وضعیت‌ها مسدودی را فعال نمی‌کنند. مسدودی در همان تراکنش DB نوشته می‌شود.",
          token: "suppressEmailInTx(...)",
          tone: "downstream",
        },
        {
          badge: "۰۶",
          title: "رد حسابرسی حفظ می‌شود",
          body: "حتی وقتی یک رویداد currentStatus را تغییر نمی‌دهد (مثلاً یک delivered دیررس پس از یک complained)، رویداد در EmailDeliveryEvent ذخیره می‌شود. رد حسابرسی وفادار است — انطباق آن را الزامی می‌کند. پنهان کردن یا حذف رویدادهای دیررس نقض انطباق است.",
          token: "store-all-events invariant",
          tone: "downstream",
        },
      ],
      regressTitle: "قوانین never-regress",
      regressSubtitle:
        "webhookها ممکن است دیررس، خارج از ترتیب یا تکراری برسند. قوانین never-regress از وضعیت قابل‌مشاهده در برابر بازنویسی بی‌صدای سیگنال‌های قدیمی محافظت می‌کنند. این قوانین فقط برای مشتق‌سازی currentStatus اعمال می‌شوند — تاریخچهٔ رویداد همیشه هر رویداد دیده‌شده را ذخیره می‌کند.",
      regressRules: [
        {
          scenario: "delivered → deferred دیررس",
          outcome: "در delivered بمان",
          rationale: "یک سیگنال bounce نرم دیررس نمی‌تواند یک ردیف delivered را به یک وضعیت واجد شرایط retry برگرداند. پیام طبق رویداد قبلی تحویل شده بود.",
        },
        {
          scenario: "complained → delivered دیررس",
          outcome: "در complained بمان",
          rationale: "آگاهانه به انطباق: شکایت یعنی گیرنده ایمیل را spam علامت زد. یک سیگنال «delivered» دیررس نمی‌تواند آن مسدودی را لغو کند. شکایت سیگنال قوی‌تر است.",
        },
        {
          scenario: "bounced (سخت) → deferred دیررس",
          outcome: "در bounced بمان",
          rationale: "bounce سخت پایانی است — گیرنده برای همیشه غیرقابل‌دسترسی. یک سیگنال موقت دیررس نمی‌تواند آن را برگرداند. گیرنده مسدود می‌ماند.",
        },
        {
          scenario: "delivered → complained جدیدتر",
          outcome: "به complained پیش ببر",
          rationale: "تنها انتقال رو به‌جلو مجاز از یک وضعیت پایانی. یک شکایت که پس از یک delivered، با occurredAt جدیدتر می‌رسد، وضعیت را پیش می‌برد. شکایت برنده است.",
        },
      ],
      comparisonTitle: "ترتیب رویداد",
      comparison: [
        {
          dimension: "رویداد پیش از occurredAt آخرین دیده‌شده می‌رسد",
          beforeValue: "در تاریخچه ذخیره، currentStatus بدون تغییر",
          afterValue: "—",
        },
        {
          dimension: "رویداد در یا پس از occurredAt آخرین دیده‌شده می‌رسد",
          beforeValue: "—",
          afterValue: "در تاریخچه ذخیره، currentStatus ممکن است پیش برود (طبق قوانین never-regress)",
        },
        {
          dimension: "تکراری (provider, providerEventId)",
          beforeValue: "توسط محدودیت یکتا رد شد",
          afterValue: "توسط محدودیت یکتا رد شد",
        },
      ],
      footnote:
        "ذخیرهٔ هر رویداد دیده‌شده — حتی آنهایی که currentStatus را تغییر نمی‌دهند — یک الزام انطباق است. یک «delivered» دیررس پس از یک «complained» نباید شکایت را بی‌صدا پنهان کند. تاریخچه، رد حسابرسی است؛ وضعیت قابل‌مشاهده، خلاصهٔ مشتق‌شده است.",
    },

    /* ۴. عیب‌یابی ایمیل ناموفق — فلوچارت تصمیم تشخیصی */
    failedTroubleshooting: {
      heading: "عیب‌یابی ایمیل ناموفق",
      subheading:
        "وقتی یک تحویل به delivered نمی‌رسد، حالت شکست به شما می‌گوید چه کنید. bounceهای سخت و شکایت‌ها عارضهٔ جانبی (مسدودی) دارند و پایانی هستند. bounceهای نرم واجد شرایط retry هستند. rejected یعنی ارائه‌دهنده پیش از پذیرش پیام را رد کرد. failed یعنی فراخوان ارائه‌دهنده پرتاب کرد. unknown یعنی ماندگاری پس از پذیرش شکست خورد. هر مسیر یک اقدام مشخص دارد.",
      pathsTitle: "مسیرهای شکست",
      paths: [
        {
          key: "hard_bounce",
          title: "bounce سخت",
          token: "bounced (hard)",
          symptom: "currentStatus = bounced. lastErrorCode معمولاً = smtp_5xx_permanent. نشان مسدودی روی ردیف.",
          cause: "گیرنده وجود ندارد، دامنه نامعتبر است، یا صندوق پستی برای همیشه غیرقابل‌دسترسی. شکست دائمی.",
          action: "retry نکنید. گیرنده از قبل با دلیل = hard_bounce مسدود شده. آدرس را از مخاطب حذف کنید. برای یک typo مشکوک، پس از اصلاح آدرس، مسدودی را از طریق داشبورد Suppressions رفع کنید (توجه: مسدودی‌های hard_bounce به‌طور پیش‌فرض lift-blocked هستند — نیازمند درخواست پشتیبانی).",
          tone: "bad",
          suppressionApplied: true,
          retryEligible: false,
        },
        {
          key: "soft_bounce",
          title: "bounce نرم / موقتی",
          token: "deferred",
          symptom: "currentStatus = deferred. lastErrorCode معمولاً = smtp_4xx_transient. بدون نشان مسدودی.",
          cause: "صندوق پستی پر، مشکل موقت DNS، greylisting، محدودیت نرخ، یا سایر شرایط موقت.",
          action: "صبر کنید — معمولاً با retry به delivered حل می‌شود، یا اگر همهٔ retryها تمام شوند به failed می‌رود. گیرنده را مسدود نکنید (bounceهای نرم مسدود نمی‌کنند). ردیف را برای تغییرات وضعیت در دقایق آینده زیر نظر بگیرید.",
          tone: "warn",
          suppressionApplied: false,
          retryEligible: true,
        },
        {
          key: "complaint",
          title: "شکایت",
          token: "complained",
          symptom: "currentStatus = complained. نشان مسدودی روی ردیف.",
          cause: "گیرنده ایمیل را به‌عنوان spam علامت زد (رویداد webhook از ارائه‌دهنده). این قوی‌ترین سیگنال منفی تحویل‌پذیری است.",
          action: "مسدودی را رعایت کنید — retry نکنید. محتوای کمپین/فرکانسی که شکایت تولید کرد را تحقیق کنید. گیرنده با دلیل = complaint مسدود شده (به‌طور پیش‌فرض lift-blocked — نیازمند درخواست پشتیبانی). نرخ شکایت بالا به اعتبار فرستنده شما آسیب می‌زند.",
          tone: "bad",
          suppressionApplied: true,
          retryEligible: false,
        },
        {
          key: "rejected",
          title: "رد توسط ارائه‌دهنده",
          token: "rejected",
          symptom: "currentStatus = rejected. lastErrorCode معمولاً = provider_message_too_large یا provider_policy_violation. بدون نشان مسدودی.",
          cause: "provider.send() با accepted=false برگشت — ارائه‌دهنده پیش از پذیرش پیام را رد کرد. علل شایع: پیام خیلی بزرگ، نقض سیاست محتوا، نحوی گیرنده نامعتبر.",
          action: "lastErrorCode را بررسی کنید. پیام را اصلاح (اندازه، محتوا، نحوی گیرنده) و به‌عنوان یک تحویل جدید دوباره ارسال کنید. ردیف تحویل اصلی برای حسابرسی در وضعیت rejected می‌ماند.",
          tone: "bad",
          suppressionApplied: false,
          retryEligible: false,
        },
        {
          key: "failed",
          title: "پرتاب فراخوان ارائه‌دهنده",
          token: "failed",
          symptom: "currentStatus = failed. lastErrorCode معمولاً = provider_connection_timeout یا provider_auth_failure. بدون نشان مسدودی.",
          cause: "provider.send() پیش از پذیرش استثنا پرتاب کرد. timeout اتصال، شکست auth، خطای TLS، اختلال شبکه. پیام احتمالاً هرگز به بالادستی نرسید.",
          action: "lastErrorCode را بررسی کنید. احتمالاً یک مشکل موقت ارائه‌دهنده — پس از رفع علت، به‌عنوان یک تحویل جدید retry کنید. ردیف اصلی برای حسابرسی در وضعیت failed می‌ماند.",
          tone: "bad",
          suppressionApplied: false,
          retryEligible: false,
        },
        {
          key: "unknown",
          title: "شکست ماندگاری پس از پذیرش",
          token: "unknown",
          symptom: "currentStatus = unknown. lastErrorCode معمولاً = db_persistence_failed_post_accept. بدون نشان مسدودی.",
          cause: "provider.send() موفق شد (پیام احتمالاً از Nixify خارج شد) اما نوشتن DB وضعیت نتیجه شکست خورد. متمایز از failed (ارائه‌دهنده پیش از پذیرش پرتاب کرد) — ایمیل خارجی ممکن است تحویل شده باشد.",
          action: "retry خودکار نکنید (ما ریسک ارسال دوگانه را نمی‌پذیریم). برای یک رویداد webhook با occurredAt جدیدتر صبر کنید تا وضعیت را پیش ببرد، یا مستقیماً در سمت ارائه‌دهنده تحقیق کنید. بازیابی broadcast گیرنده‌های unknown را رد می‌کند (بدون ارسال مجدد خودکار).",
          tone: "recovery",
          suppressionApplied: false,
          retryEligible: false,
        },
      ],
      decisionTreeTitle: "جریان تصمیم",
      decisionTree: [
        {
          question: "آیا تحویل در یک وضعیت پایانی است؟",
          yes: "بله —> وضعیت پایانی را شناسایی و طبق آن اقدام کنید (مسیرهای بالا را ببینید).",
          no: "خیر —> queued، provider_accepted یا deferred است. منتظر رویداد بعدی بمانید.",
        },
        {
          question: "آیا نشان مسدودی روی ردیف هست؟",
          yes: "بله —> گیرنده در فهرست Suppressions شما است. دلیل (hard_bounce یا complaint) را متقاطع بررسی کنید و تصمیم بگیرید آیا رفع کنید (معمولاً lift-blocked).",
          no: "خیر —> تحویل مسدودی را فعال نکرده. گیرنده برای ارسال‌های آینده واجد شرایط می‌ماند.",
        },
        {
          question: "آیا ارائه‌دهنده SMTP است؟",
          yes: "بله —> provider_accepted عمیق‌ترین وضعیت قابل‌مشاهده است. webhook‌ای برای پیشبردن آن نیست. برای وضعیت‌های delivered به یک ارائه‌دهندهٔ دارای webhook سوییچ کنید.",
          no: "خیر —> یک ارائه‌دهندهٔ دارای webhook در استفاده است. انتظار رویدادهای webhook delivered/bounced/complained برای پیشبردن وضعیت را داشته باشید.",
        },
        {
          question: "آیا lastErrorCode تنظیم شده؟",
          yes: "بله —> کد را بررسی کنید. این طبقه‌بندی خطای امن و پاک‌سازی‌شده است (مثلاً smtp_5xx_permanent، provider_connection_timeout) — هرگز stack trace خام ارائه‌دهنده نیست.",
          no: "خیر —> وضعیت از طریق یک رویداد webhook (delivered، complained، soft-deferred) رسید، نه از طریق یک خطای محلی ارائه‌دهنده.",
        },
      ],
      suppressionFootnote:
        "bounceهای سخت و شکایت‌ها مسدودی‌هایی تولید می‌کنند که به‌طور پیش‌فرض lift-blocked هستند — برای رفع نیازمند درخواست پشتیبانی هستند، زیرا ارسال مجدد به آدرس بد-شناخته‌شده یا شکایت‌کننده ریسک تحویل‌پذیری است. برای ماتریس کامل واجد شرایط بودن رفع، راهنمای Suppressions را ببینید.",
      warningTitle: "هرگز یک bounce سخت را retry خودکار نکنید",
      warningBody:
        "bounce سخت یعنی گیرنده برای همیشه غیرقابل‌دسترسی است. retry یک bounce سخت دیگر تولید می‌کند، سهمیهٔ پیام‌رسانی شما را هدر می‌دهد و به اعتبار فرستنده‌تان آسیب می‌زند. گیرنده از قبل مسدود شده — مسدودشده باقی بمانید. برای یک typo مشکوک، پس از اصلاح آدرس، مسدودی را از طریق داشبورد Suppressions رفع کنید.",
    },
  },
};
