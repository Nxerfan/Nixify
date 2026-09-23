/**
 * UX-B: API Keys guide — Persian (فارسی) content dictionary.
 *
 * این دیکشنری برابر فارسیِ دقیقِ api-keys-en.ts است. همان شکل، همان تعداد
 * فیلدها، همان توکن‌های فنی (پیشوندهای کلید مثل mg_test_ و mg_live_، کلیدهای
 * کامل مثل mg_live_abC12...، توکن‌های هش مثل sha256:7c3b9f1e...، شناسه‌های
 * عددی کلید، مهرهای زمانی ISO، کدهای scope مثل full / read_only، کدهای
 * environment مثل development / production، کدهای طرح مثل FREE / PRO / MAX،
 * نام متدهای HTTP، مسیرهای فایل) به‌صورت LTR باقی می‌مانند.
 *
 * قرارداد بومی‌سازی (REGRESSION-PROTECTED):
 *   - stage.dir = "rtl" و stage.locale = "fa" — مرحله نهاده به‌صورت دائمی
 *     dir="ltr" نیست.
 *   - برچسب‌های انسانی (عنوان، زیرعنوان، برچسب‌های جدول، متن بنرها، متن
 *     راهنما، متن دیالوگ‌ها) به فارسی روان ترجمه می‌شوند.
 *   - اعداد فارسی (۰۱–۰۶) فقط در جاهایی به کار رفته‌اند که در نسخهٔ انگلیسی
 *     هم اعداد لاتین در متن طبیعی به کار رفته‌اند (مثل نشان‌های مرحله در
 *     cycle یا زمان‌های نسبی مثل «۲ ساعت پیش»). اعداد فنی (مثل شناسهٔ عددی
 *     کلید، ISO timestampها، کدهای وضعیت، کدهای طرح) همگی LTR باقی می‌مانند.
 *   - توکن‌های فنی در زمان رندر با <Ltr> پیچیده می‌شوند تا در صفحهٔ RTL
 *     به‌درستی نمایش داده شوند.
 *
 * Audit-grade factual accuracy (re-verified this pass):
 *   هر ادعایی در این فایل بر اساس:
 *     - src/app/dashboard/api-keys/page.tsx                       (~779-line real UI)
 *     - src/app/api/admin/api-keys/route.ts                       (list / create / revoke)
 *     - src/app/api/admin/api-keys/usage/route.ts                 (per-key usage buckets)
 *     - src/lib/dx/api-keys.ts                                    (key generation + verify + scope)
 *     - src/i18n/fa.ts                                            (dashboard.apiKeys.* labels)
 *   بازبینی شده است. متنِ فارسی، معادل دقیقِ متنِ انگلیسی است.
 */

import type { ApiKeysGuideContent } from "./api-keys-types";

export const apiKeysFa: ApiKeysGuideContent = {
  slug: "api-keys",
  routeKey: "api-keys",
  backHref: "/dashboard/api-keys",
  stepCount: 6,
  durationMin: 5,
  category: "developer",
  dashboardRoute: "/dashboard/api-keys",
  title: "کلیدهای API",
  description:
    "کلیدهای دسترسی برنامه‌پذیر را تولید، پایش و revoke کنید. کلید کامل فقط یک‌بار هنگام ایجاد نمایش داده می‌شود — Nixify فقط هش SHA-256 آن و یک پیشوند ۱۲ کاراکتری را برای نمایش ذخیره می‌کند. تمایز test/live، مدل scope کامل در برابر read_only، و چک‌لیست ذخیرهٔ امن را بیاموزید.",
  chapters: [
    {
      id: "intro",
      title: "کلیدهای API",
      steps: [
        {
          id: "apiKeysOverview",
          caption:
            "این صفحهٔ واقعی «کلیدهای API» است. هدر شامل آیکن سبز KeyRound، عنوان «API Keys» و زیرعنوان «تولید، پایش و revoke کلیدهای دسترسی برنامه‌پذیر» است. در زیر آن: دکمهٔ Refresh، دکمهٔ سبز «Create New Key»، سپس یک کارت سهمیه که نشان طرح شما و تعداد کلیدهای فعال استفاده‌شده در برابر سهمیهٔ طرح را نشان می‌دهد. جدول هر کلید را فهرست می‌کند — نام، پیشوند، محیط، وضعیت، آخرین استفاده و منوی عملیات هر ردیف.",
          duration: 8000,
          scene: "apiKeysOverview",
        },
        {
          id: "createDialog",
          caption:
            "برای باز کردن دیالوگ ایجاد، «Create New Key» را بزنید. یک نام (هرچیزی که کمک کند یادتان بماند این کلید برای چیست)، یک محیط (development → کلید با mg_test_ شروع می‌شود؛ production → با mg_live_)، یک scope (full = همهٔ endpointها، یا read_only = فقط GET) و یک تاریخ انقضای اختیاری انتخاب کنید. راهنمای زیر انتخابگر محیط به شما یادآوری می‌کند کلید کدام پیشوند را خواهد داشت.",
          duration: 8500,
          scene: "createDialog",
        },
        {
          id: "secretReveal",
          caption:
            "هنگام تأیید، دیالوگ ایجاد بسته می‌شود و یک دیالوگ reveal با کلید کامل باز می‌شود — دقیقاً یک‌بار. آن را همین حالا کپی کنید. Nixify فقط SHA-256(key) و ۱۲ کاراکتر اول (پیشوند) را برای نمایش ذخیره می‌کند؛ کل کامل دیگر هرگز قابل بازیابی نیست. اگر آن را گم کنید باید کلید را revoke کرده و یکی جدید بسازید. هشدار کهربایی تأکید می‌کند: «این کلید دیگر نمایش داده نخواهد شد. آن را در یک مدیریتگر امن اسرار ذخیره کنید.»",
          duration: 8500,
          scene: "secretReveal",
        },
        {
          id: "quotaReached",
          caption:
            "هر طرح یک سهمیهٔ تعداد کلید دارد — FREE = 1، PRO = 5، MAX = 20. این یک محدودیت تعداد منابع است، نه سهمیهٔ ماهانه: کلیدهای revoke‌شده جای اسلات را اشغال نمی‌کنند. هنگامی‌که activeCount >= quota، دکمهٔ Create غیرفعال می‌شود و نوار سهمیه به قرمز تبدیل می‌شود. راهنما مسیر را توضیح می‌دهد: یک کلید استفاده‌نشده را revoke کنید، یا به طرح بعدی ارتقا دهید.",
          duration: 8000,
          scene: "quotaReached",
        },
        {
          id: "revokeConfirmation",
          caption:
            "منوی عملیات یک ردیف را باز کنید و «Revoke» را بزنید. یک AlertDialog باز می‌شود: «شما در حال revoke کردن {name} هستید. هر درخواستی که از این کلید استفاده می‌کند بلافاصله متوقف خواهد شد. این عملیات قابل بازگشت نیست.» Revoke یک حذف نرم است — Nixify مقدار revokedAt = now را تنظیم می‌کند و keyHash را برای تاریخچهٔ ممیزی نگه می‌دارد. هر درخواست در جریان که با این کلید امضا شده بود بلافاصله با خطا مواجه خواهد شد.",
          duration: 8000,
          scene: "revokeConfirmation",
        },
        {
          id: "revokedState",
          caption:
            "پس از revoke، نشان وضعیت ردیف به قرمز «revoked» تبدیل می‌شود و آیتم Revoke در منوی عملیات غیرفعال می‌شود (نمی‌توانید یک کلید از‌قبل revoke‌شده را دوباره revoke کنید). پیشوند و هش کلید نگه داشته می‌شوند — مدیران هنوز می‌توانند کلید را در لاگ‌های ممیزی شناسایی کنند بدون آنکه هرگز راز را ببینند. کلیدهای revoke‌شده به سهمیهٔ شما حساب نمی‌شوند، بنابراین می‌توانید بلافاصله یک جایگزین بسازید.",
          duration: 7500,
          scene: "revokedState",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "خواندن فهرست کلیدها + کارت سهمیه",
      body: "صفحهٔ کلیدهای API با یک هدر باز می‌شود (آیکن سبز KeyRound + «API Keys» + زیرعنوان «تولید، پایش و revoke کلیدهای دسترسی برنامه‌پذیر»)؛ دکمهٔ Refresh و دکمهٔ سبز «Create New Key». در زیر آن: یک کارت سهمیه که نشان طرح (FREE / PRO / MAX) و «{activeCount} / {quota} keys used» را با یک نوار رنگی (سبز < ۸۰٪، کهربایی ۸۰–۹۹٪، قرمز در ۱۰۰٪) نشان می‌دهد. جدول کلیدها هر کلید را با ستون‌ها فهرست می‌کند: Name (آیکن KeyRound + نام + زیرخط scope)، Prefix (۱۲ کاراکتر اول + …، mono LTR)، Environment (نشان dev / prod)، Created، Last Used، Status (active / expired / revoked) و منوی Actions هر ردیف.",
    },
    {
      title: "باز کردن دیالوگ Create و انتخاب نام + محیط + scope",
      body: "«Create New Key» را بزنید. دیالوگ شامل Name (ورودی)، Environment (Select: development / production)، Scopes (Select: full — all endpoints / read_only — GET only) و یک تاریخ انقضای اختیاری است. راهنمای زیر انتخابگر محیط به شما می‌گوید کلید کدام پیشوند را خواهد داشت: mg_test_ برای development، mg_live_ برای production. دکمهٔ تأیید تا زمانی که نام خالی باشد غیرفعال است.",
    },
    {
      title: "کپی کلید کامل از دیالوگ Reveal (یک‌بار نمایش)",
      body: "هنگام تأیید، دیالوگ ایجاد بسته می‌شود و دیالوگ reveal با کلید کامل باز می‌شود (مثلاً mg_test_abC12xyz...). همین حالا کپی کنید — Nixify فقط SHA-256(key) (keyHash) و ۱۲ کاراکتر اول (prefix) را برای نمایش ذخیره می‌کند؛ راز کامل دیگر هرگز قابل بازیابی نیست. هشدار کهربایی تأکید می‌کند: «این کلید دیگر نمایش داده نخواهد شد. آن را در یک مدیریتگر امن اسرار ذخیره کنید.» Done را بزنید تا دیالوگ بسته شود؛ ردیف جدید در جدول ظاهر می‌شود.",
    },
    {
      title: "بازدید از آمار استفادهٔ یک ردیف",
      body: "منوی عملیات یک ردیف را باز کنید و «View usage» را بزنید. ردیف باز می‌شود تا سه bucket نشان دهد: last 24h، last 7d و all time. هر bucket تعداد کل درخواست‌ها به‌علاوهٔ تفکیک ✓success (2xx)، ·client (4xx) و ✗server (5xx) را نشان می‌دهد. اعداد از GET /api/admin/api-keys/usage?id=X می‌آیند که ردیف‌های RequestLog را بر اساس کد وضعیت در هر پنجره گروه‌بندی می‌کند. «Hide usage» را بزنید تا پنل بسته شود.",
    },
    {
      title: "Revoke یک کلید وقتی دیگر نیازی به آن ندارید",
      body: "منوی عملیات یک ردیف را باز کنید و «Revoke» را بزنید. یک AlertDialog باز می‌شود: «شما در حال revoke کردن {name} هستید. هر درخواستی که از این کلید استفاده می‌کند بلافاصله متوقف خواهد شد. این عملیات قابل بازگشت نیست.» تأیید کنید و Nixify مقدار revokedAt = now را تنظیم می‌کند (یک حذف نرم — keyHash برای تاریخچهٔ ممیزی نگه داشته می‌شود). نشان وضعیت به قرمز «revoked» تبدیل می‌شود و آیتم Revoke در منو غیرفعال می‌شود. کلیدهای revoke‌شده به سهمیهٔ شما حساب نمی‌شوند، بنابراین در صورت نیاز می‌توانید بلافاصله یک جایگزین بسازید.",
    },
    {
      title: "احترام به نکات امنیتی",
      body: "هشدار کهربایی Security tips در پایین صفحه سه قانون را یادآوری می‌کند: (۱) کلیدهای تست (mg_test_) برای توسعه‌اند؛ کلیدهای زنده (mg_live_) فقط باید در تولید استفاده شوند. (۲) کلیدها را به‌طور دوره‌ای rotate کنید و کلیدهای استفاده‌نشده را revoke کنید. (۳) از scope یعنی read_only برای محدود کردن ریسک استفاده کنید — کلیدهای read_only فقط می‌توانند درخواست‌های GET انجام دهند. تابع hasScope() داشبورد این‌ها را اعمال می‌کند: full هر عملیاتی را مجاز می‌کند؛ read_only فقط action === \"read\" (GET) را مجاز می‌کند.",
    },
  ],
  whyWhen: [
    {
      title: "چه‌زمانی یک کلید جدید بسازیم",
      body: "هرگاه یک ادغام جدید نیاز به دسترسی برنامه‌پذیر به حساب Nixify شما دارد — یک worker بک‌اند، یک اسکریپت CI، یک گیرندهٔ webhook شریک — یک کلید جدید بسازید. نامی به آن بدهید که کمک کند بفهمید برای چیست (مثلاً «Production backend worker»). کوچک‌ترین scope را که کار را انجام می‌دهد انتخاب کنید: read_only اگر ادغام فقط داده می‌خواند، full اگر نیاز به نوشتن دارد. در طول توسعه از کلیدهای mg_test_ استفاده کنید و برای تولید به mg_live_ سوییچ کنید.",
    },
    {
      title: "چرا کلید کامل فقط یک‌بار نمایش داده می‌شود",
      body: "ذخیرهٔ کلید کامل به این معنا بود که یک نفوذ به پایگاه‌داده می‌توانست هر کلید را نشت دهد. در عوض، Nixify فقط SHA-256(key) (یک هش یک‌طرفه) و ۱۲ کاراکتر اول (پیشوند) را برای نمایش ذخیره می‌کند. هش اجازه می‌دهد مسیر verify یک کلید ورودی را با رکورد ذخیره‌شده مقایسه کند بدون آنکه هرگز راز را ذخیره کند. بهای این کار: اگر کلید کامل را پس از بسته شدن دیالوگ reveal گم کنید، برای همیشه از دست رفته — باید revoke کنید و یکی جدید بسازید. داشبورد نمی‌تواند آن را بازیابی کند.",
    },
    {
      title: "چرا سهمیه یک تعداد است، نه استفادهٔ ماهانه",
      body: "قابلیت API_KEYS یک محدودیت تعداد منابع است (چند کلید وجود دارد)، نه یک سهمیهٔ ماهانه (چند فراخوانی انجام می‌دهند). FREE = 1 کلید، PRO = 5، MAX = 20. کلیدهای revoke‌شده جای اسلات را اشغال نمی‌کنند — فقط کلیدهای فعال حساب می‌شوند. مسیر Create از createResourceWithCapacity می‌گذرد، یک قفل ردیف تراکنشی که از تخصیص بیش‌ازحد تحت درخواست‌های هم‌زمان جلوگیری می‌کند. 402 یعنی quota_exhausted (یک کلید را revoke کنید یا ارتقا دهید)؛ 403 یعنی not_available_on_plan (قابلیت اصلاً در طرح شما نیست).",
    },
    {
      title: "چه‌زمانی از scope یعنی read_only در برابر full استفاده کنیم",
      body: "از read_only برای ادغام‌هایی استفاده کنید که فقط نیاز به خواندن داده دارند — داشبوردهای تحلیلی، pullerهای لاگ ممیزی، صفحات وضعیت، بررسی‌کننده‌های webhook شریک. یک کلید read_only می‌تواند هر endpoint GET را فراخوانی کند (action === \"read\") اما در نوشتن‌ها (POST / PUT / DELETE) رد می‌شود. فقط وقتی از full استفاده کنید که ادغام واقعاً نیاز به تغییر دارد — ارسال OTP، ایجاد مخاطب، مدیریت broadcast. scope کوچک‌تر یعنی یک کلید نشت‌شده آسیب کمتری می‌زند. توجه: hasScope() از comma-separated custom scopeها هم پشتیبانی می‌کند (مثلاً \"otp:send,contacts:read\")، اما دیالوگ create داشبورد فقط full و read_only را ارائه می‌دهد.",
    },
  ],
  mistakes: [
    {
      title: "بستن دیالوگ reveal بدون کپی",
      body: "دیالوگ reveal تنها زمانی است که کلید کامل نمایش داده می‌شود. بستن آن بدون کپی کلید یعنی کلید از دست رفته — داشبورد نمی‌تواند آن را بازیابی کند. باید کلید را revoke کنید و یکی جدید بسازید و هر ادغامی که از آن استفاده می‌کرد را به‌روز کنید. همیشه قبل از زدن Done، کلید کامل را از دیالوگ reveal در یک مدیریتگر اسرار کپی کنید.",
    },
    {
      title: "استفاده از کلیدهای mg_live_ در توسعه",
      body: "کلیدهای mg_live_ به داده‌های تولید با دسترسی‌های تولید دسترسی دارند. یک باگ در اسکریپت توسعه که با یک کلید زنده DELETE /api/.../contacts را فراخوانی کند، واقعاً مخاطبان را حذف خواهد کرد. همیشه برای توسعه از کلیدهای mg_test_ استفاده کنید. راهنما در دیالوگ create به شما یادآوری می‌کند کلید کدام پیشوند را خواهد داشت — آن را بخوانید. نشان محیط در جدول (dev کهربایی / prod سبز) یادآوری دوم شماست.",
    },
    {
      title: "commit کردن یک کلید به کنترل نسخه",
      body: "هنگامی‌که یک کلید در تاریخچهٔ git است — حتی در یک repo خصوصی — عملاً نشت کرده است. هر کسی با دسترسی repo (شامل یک نفوذ آینده یا لپ‌تاپ نشت‌شدهٔ یک مشارکت‌کننده) آن را دارد. اگر این اتفاق افتاد بلافاصله rotate کنید: کلید نشت‌شده را revoke کنید، یکی جدید بسازید، در یک مدیریتگر اسرار ذخیره کنید (نه در یک فایل .env در repo) و ترافیک غیرمنتظره در RequestLog خود را ممیزی کنید. ستون «Last used» داشبورد مسیر کارآگاهی شماست.",
    },
    {
      title: "فرض بر اینکه کلیدهای revoke‌شده به سهمیه حساب می‌شوند",
      body: "این یکی واقعاً درست است — کلیدهای revoke‌شده جای اسلات را اشغال نمی‌کنند. اما بسیاری از کاربران برعکس فرض می‌کنند: که باید کلید را کلاً حذف کنند. Nixify هرگز کلیدها را hard-delete نمی‌کند؛ revoke یک حذف نرم است که revokedAt = now را تنظیم می‌کند. keyHash برای تاریخچهٔ ممیزی نگه داشته می‌شود. پس از revoke می‌توانید بلافاصله یک کلید جدید بسازید (تعداد یک واحد کاهش می‌یابد). سعی نکنید کلیدی را «حذف» کنید — حذف وجود ندارد، فقط revoke.",
    },
    {
      title: "در نظر گرفتن read_only به‌عنوان اجازهٔ مشاهدهٔ داشبورد",
      body: "scope یعنی read_only برای API است (دسترسی برنامه‌پذیر از طریق هدر Authorization)، نه برای داشبورد. داشبورد از کوکی‌های session (یک مسیر auth جداگانه) استفاده می‌کند، نه کلیدهای API. یک کلید API یعنی read_only می‌تواند هر endpoint GET را به‌صورت برنامه‌پذیر فراخوانی کند — اما نمی‌تواند شما را به داشبورد وارد کند، صفحه‌ها را ببیند یا کار سمت UI انجام دهد. این دو مسیر auth مستقل‌اند.",
    },
  ],
  proTips: [
    {
      title: "نام‌گذاری کلیدها بر اساس کاربرد، نه محیط",
      body: "محیط از قبل در پیشوند (mg_test_ در برابر mg_live_) رمزگذاری شده و به‌عنوان نشان در جدول نمایش داده می‌شود. فیلد نام را با «test-key-1» هدر ندهید — نام آن را بر اساس کاری که انجام می‌دهد بگذارید: «Production backend worker»، «CI: nightly contact sync»، «Partner: Acme webhook receiver». وقتی شش ماه بعد نیاز به revoke یک کلید داشته باشید، نام باید به شما بگوید کدام ادغام خواهد شکست.",
    },
    {
      title: "Rotate کردن کلیدها بر اساس یک زمان‌بندی",
      body: "حتی بدون هیچ نفوذ شناخته‌شده‌ای، rotate کردن کلیدها هر ۹۰ روز یک عادت سالم است. ابتدا کلید جدید را بسازید، ادغام را به‌روز کنید تا از آن استفاده کند (از ستون «Last used» تأیید کنید)، سپس قدیمی را revoke کنید. پنل استفادهٔ هر کلید داشبورد کمک می‌کند قبل از revoke کلید قدیمی، تأیید کنید کلید جدید واقعاً استفاده می‌شود — به دنبال ترافیک غیرصفر در bucket آخرین ۲۴ ساعت بگردید.",
    },
    {
      title: "استفاده از پنل استفاده برای تشخیص ناهنجاری",
      body: "یک کلید که ناگهان حجم درخواست‌اش بالا می‌رود، یا شروع به بازگرداندن پاسخ‌های 5xx می‌کند در حالی که قبلاً 2xx برمی‌گرداند، سیگنالی است که چیزی تغییر کرده — یا ادغام بدعمل می‌کند، یا کلید به‌خطر افتاده است. روی ردیف «View usage» را بزنید و bucket آخرین ۲۴ ساعت را با all time مقایسه کنید. یک کلید سالم نسبت موفقیت پایداری دارد؛ یک کلید به‌خطرافتاده اغلب یک انفجار ناگهانی از خطاهای client (4xx) یا server (5xx) نشان می‌دهد.",
    },
    {
      title: "Revoke فوری هنگام شک به نفوذ",
      body: "اگر شک دارید یک کلید نشت کرده — در یک IP غیرمنتظره نشان داده می‌شود، مهر زمانی «Last used» اخیر است اما شما هیچ فراخوانی نکرده‌اید، یا یک شریک گزارش نقض می‌دهد — بلافاصله revoke کنید. keyHash برای ممیزی نگه داشته می‌شود (همچنان می‌توانید ردیف و تاریخچهٔ استفاده‌اش را ببینید)، اما کلید از لحظه‌ای که revokedAt تنظیم می‌شود کار نمی‌کند. می‌توانید بلافاصله یک کلید جدید بسازید؛ کلیدهای revoke‌شده به سهمیه حساب نمی‌شوند.",
    },
  ],
  troubleshooting: [
    {
      title: "دکمهٔ Create غیرفعال است",
      body: "به سهمیهٔ طرح خود رسیده‌اید. کارت سهمیه در بالای صفحه نشان طرح شما و «{activeCount} / {quota} keys used» را با یک نوار قرمز در ۱۰۰٪ نشان می‌دهد. ویژگی title دکمه (هاور) دقیقاً به شما می‌گوید چه کنید: «Quota reached — revoke a key or upgrade to {next_plan}» (اگر طرح بعدی وجود دارد) یا «All keys in use — revoke one to create a new key» (اگر روی MAX هستید). کلیدهای revoke‌شده حساب نمی‌شوند، بنابراین revoke کردن یکی بلافاصله یک اسلات آزاد می‌کند.",
    },
    {
      title: "Create برمی‌گرداند 402 (quota_exhausted)",
      body: "این معادل API دکمهٔ Create غیرفعال است. POST /api/admin/api-keys از createResourceWithCapacity گذشت، قفل ردیف تراکنشی، و activeCount از قبل در سهمیه بود. یک کلید استفاده‌نشده را revoke کنید (DELETE /api/admin/api-keys?id=X) و دوباره امتحان کنید، یا طرح خود را ارتقا دهید. کد پاسخ FORBIDDEN با وضعیت 402 است — متمایز از 403 not_available_on_plan زیر.",
    },
    {
      title: "Create برمی‌گرداند 403 (not_available_on_plan)",
      body: "قابلیت API_KEYS اصلاً در طرح شما نیست (در مقابل سهمیه، که قابلیت در طرح شماست اما همهٔ اسلات‌ها را استفاده کرده‌اید). به طرحی ارتقا دهید که شامل API Keys باشد. کد پاسخ FORBIDDEN با وضعیت 403 است. داشبورد این را به‌عنوان صفحهٔ not-available نشان می‌دهد؛ API آن را به‌عنوان 403 با code = not_available_on_plan نشان می‌دهد.",
    },
    {
      title: "Verify برمی‌گرداند invalid_format",
      body: "کلیدی که ارسال کرده‌اید با mg_live_ یا mg_test_ شروع نمی‌شود. فضای خالی، پیشوند گمشده یا یک غلط املایی را بررسی کنید. تابع verifyApiKey() در src/lib/dx/api-keys.ts قبل از هرگونه lookup پایگاه‌داده روی این کوتاه‌مدار می‌شود — یک رد سریع است. مطمئن شوید ادغام شما کلید کامل را دقیقاً همان‌طور که در دیالوگ reveal ظاهر شد (شامل پیشوند mg_test_ / mg_live_) ارسال می‌کند.",
    },
    {
      title: "Verify برمی‌گرداند revoked یا expired",
      body: "revoked یعنی revokedAt !== null روی ردیف کلید (کسی در داشبورد Revoke را زده، یا DELETE /api/admin/api-keys?id=X فراخوانی شده). expired یعنی expiresAt <= Date.now() — تاریخ انقضای اختیاری که در دیالوگ create تنظیم کرده‌اید گذشته است. هر دو نهایی‌اند: کلید بلافاصله کار نمی‌کند. یک کلید جدید با همان نام + محیط + scope بسازید تا جایگزین شود.",
    },
    {
      title: "رد شدن کلید read_only روی یک endpoint POST",
      body: "hasScope(\"read_only\", \"full\") مقدار false برمی‌گرداند — کلیدهای read_only فقط برای action === \"read\" (endpointهای GET) مجاز هستند. اگر ادغام شما نیاز به نوشتن دارد، یک کلید full لازم دارید. یا یک کلید full جدید بسازید (و کلید read_only را اگر دیگر نیازی نیست revoke کنید)، یا — اگر می‌خواهید کنترل دانه‌دانه‌تری داشته باشید — از پشتیبانی comma-separated custom scope یعنی hasScope استفاده کنید (مثلاً scopes: \"otp:send,contacts:read\"). UI داشبورد custom scopeها را ارائه نمی‌دهد؛ باید آن‌ها را مستقیماً از طریق API تنظیم کنید.",
    },
  ],
  checklist: [
    { label: "نامی انتخاب کردید که کاربرد ادغام را شناسایی کند" },
    { label: "کوچک‌ترین scope را انتخاب کردید که کار را انجام می‌دهد (ترجیح read_only)" },
    { label: "از mg_test_ برای توسعه استفاده کردید، از mg_live_ فقط برای تولید" },
    { label: "کلید کامل را از دیالوگ reveal در یک مدیریتگر اسرار کپی کردید" },
    { label: "کلید را با یک GET ساده قبل از استقرار ادغام تست کردید" },
    { label: "می‌دانید دکمهٔ revoke کجاست و اینکه revoke یک حذف نرم است (keyHash نگه داشته می‌شود)" },
  ],
  whatNext:
    "هنگامی‌که کلیدها ایجاد و به‌طور امن ذخیره شدند، آن‌ها را در بک‌اند خود با ارسال کلید به‌عنوان Bearer token در هدر Authorization ادغام کنید. با یک کلید mg_test_ یعنی read_only شروع کنید تا تأیید کنید ادغام می‌تواند داده‌هایی که نیاز دارد بخواند، سپس به یک کلید mg_live_ یعنی full ارتقا دهید وقتی مطمئن شدید. یک یادآوری ۹۰ روزه تقویم برای rotate تنظیم کنید. اگر کلیدی به‌خطر افتاد، بلافاصله آن را revoke کنید — ستون «Last used» داشبورد و پنل استفادهٔ هر کلید مسیر کارآگاهی شماست. برای سطح کامل API، به مستندات توسعه‌دهنده مراجعه کنید.",
  related: [
    { label: "داشبورد کلیدهای API", href: "/dashboard/api-keys" },
    { label: "راهنمای Webhooks", href: "/guide/webhooks" },
    { label: "راهنمای Contacts", href: "/guide/contacts" },
  ],

  /* ─── Stage copy ──────────────────────────────────────────────────────── */
  stage: {
    dir: "rtl",
    locale: "fa",

    header: {
      title: "کلیدهای API",
      subtitle: "تولید، پایش و revoke کلیدهای دسترسی برنامه‌پذیر",
      backToDashboard: "داشبورد",
      refresh: "به‌روزرسانی",
      createNewKey: "ایجاد کلید جدید",
    },

    quota: {
      planLabel: "طرح:",
      keysUsed: (used, total) => `${used} / ${total} کلید استفاده‌شده`,
      quotaReached: (nextPlan) =>
        nextPlan
          ? `سهمیه تکمیل شد — برای کلید بیشتر به ${nextPlan} ارتقا دهید`
          : "همهٔ کلیدها در استفاده‌اند — یکی را revoke کنید تا کلید جدید بسازید",
    },

    table: {
      name: "نام",
      prefix: "پیشوند",
      environment: "محیط",
      created: "ایجاد شده",
      lastUsed: "آخرین استفاده",
      status: "وضعیت",
      actions: "عملیات",
      actionsAria: "عملیات",
      neverUsed: "هرگز",
    },

    envBadges: {
      dev: "dev",
      prod: "prod",
    },

    statusLabels: {
      active: "فعال",
      expired: "منقضی",
      revoked: "revoked‌شده",
    },

    actionsMenu: {
      viewUsage: "مشاهدهٔ استفاده",
      hideUsage: "پنهان کردن استفاده",
      copyPrefix: "کپی پیشوند",
      revoke: "Revoke",
    },

    usageStats: {
      title: "آمار استفاده",
      last24h: "۲۴ ساعت گذشته",
      last7d: "۷ روز گذشته",
      allTime: "کل مدت",
      successSymbol: "✓",
      clientSymbol: "·",
      serverSymbol: "✗",
      noData: "بدون داده",
    },

    pagination: {
      pageOf: (page, total) => `صفحه ${page} · ${total} مجموع`,
      prev: "قبلی",
      next: "بعدی",
    },

    empty: {
      title: "هنوز کلید API وجود ندارد",
      body: "اولین کلید API خود را بسازید تا شروع به ادغام Nixify کنید.",
      create: "ایجاد کلید جدید",
    },

    securityTips: {
      title: "نکات امنیتی",
      tipTest: "کلیدهای تست (mg_test_) برای توسعه‌اند؛ کلیدهای زنده (mg_live_) فقط باید در تولید استفاده شوند.",
      tipRotate: "کلیدها را به‌طور دوره‌ای rotate کنید و کلیدهای استفاده‌نشده را revoke کنید.",
      tipReadOnly: "از scope یعنی read_only برای محدود کردن ریسک استفاده کنید — کلیدهای read_only فقط می‌توانند درخواست‌های GET انجام دهند.",
    },

    createDialog: {
      title: "ایجاد کلید API",
      description:
        "این تنها زمانی است که کلید کامل نمایش داده خواهد شد. همین حالا کپی کنید — Nixify فقط هش SHA-256 آن و یک پیشوند ۱۲ کاراکتری را برای نمایش ذخیره می‌کند، بنابراین راز کامل بعداً قابل بازیابی نیست.",
      nameLabel: "نام",
      namePlaceholder: "Production backend worker",
      nameRequired: "نام الزامی است.",
      environmentLabel: "محیط",
      environmentDev: "development",
      environmentProd: "production",
      keyStartsWithHint: "کلید با این پیشوند شروع خواهد شد:",
      scopesLabel: "Scopeها",
      scopeFull: "full — همهٔ endpointها",
      scopeReadOnly: "read_only — فقط GET",
      expirationLabel: "انقضا (اختیاری)",
      leaveBlank: "برای بدون انقضا خالی بگذارید.",
      cancel: "انصراف",
      submit: "ایجاد کلید",
      submitting: "در حال ایجاد…",
      limitReached: "محدودیت کلید API تکمیل شد. کلیدهای استفاده‌نشده را revoke کنید یا ارتقا دهید.",
      tooManyCreations: "تعداد زیادی کلید ایجاد شده. لطفاً کمی صبر کنید و دوباره امتحان کنید.",
      failedCreate: "ایجاد کلید API ناموفق بود.",
    },

    revealDialog: {
      title: "کلید API شما",
      description:
        "این کلید را همین حالا کپی کنید. دیگر نمایش داده نخواهد شد — Nixify فقط هش SHA-256 و یک پیشوند ۱۲ کاراکتری را ذخیره می‌کند، بنابراین راز کامل بعداً قابل بازیابی نیست.",
      copyButton: "کپی",
      copyToast: "کلید کپی شد",
      warningTitle: "دیگر نمایش داده نخواهد شد",
      warningBody:
        "این کلید دیگر نمایش داده نخواهد شد. آن را در یک مدیریتگر امن اسرار ذخیره کنید.",
      hashCaption: "ذخیره‌شده: SHA-256(key) + ۱۲ کاراکتر اول (پیشوند)",
      done: "انجام شد",
    },

    revokeDialog: {
      title: "Revoke کلید API",
      body: (name) =>
        `شما در حال revoke کردن ${name} هستید. هر درخواستی که از این کلید استفاده می‌کند بلافاصله متوقف خواهد شد. این عملیات قابل بازگشت نیست.`,
      cancel: "انصراف",
      confirm: "Revoke کلید",
      confirming: "در حال revoke…",
      softDeleteCaption: "حذف نرم — keyHash برای ممیزی نگه داشته می‌شود (revokedAt = now)",
    },

    notAvailable: {
      title: "کلیدهای API در دسترس نیست",
      description:
        "کلیدهای API بخشی از قابلیت Developer Tools هستند که در طرح فعلی شما موجود نیست.",
      cta: "مشاهده طرح‌ها",
    },

    /* طرح + ردیف‌های seed. طرح seed یعنی PRO تا کارت سهمیه استفاده‌ای
     * معنادار-اما-نه-پر نشان دهد. PRO = 5 کلید. ردیف‌های seed هر وضعیت
     * قابل‌مشاهده (active، expired، revoked) و هر ترکیب محیط × scope را
     * پوشش می‌دهند. */
    plan: "PRO",
    planQuota: 5,
    rows: [
      {
        id: 1,
        name: "Production backend worker",
        prefix: "mg_live_abC12",
        environment: "production",
        scopes: "full",
        isRevoked: false,
        isExpired: false,
        createdAtRelative: "۲ هفته پیش",
        lastUsedAtRelative: "۳ دقیقه پیش",
        usage: {
          last24h: { success: 1284, client: 18, server: 2, total: 1304 },
          last7d: { success: 8421, client: 124, server: 9, total: 8554 },
          allTime: { success: 31872, client: 482, server: 31, total: 32385 },
        },
      },
      {
        id: 2,
        name: "CI: nightly contact sync",
        prefix: "mg_test_def34",
        environment: "development",
        scopes: "full",
        isRevoked: false,
        isExpired: false,
        createdAtRelative: "۵ روز پیش",
        lastUsedAtRelative: "۱ ساعت پیش",
        usage: {
          last24h: { success: 4, client: 0, server: 0, total: 4 },
          last7d: { success: 28, client: 1, server: 0, total: 29 },
          allTime: { success: 142, client: 3, server: 1, total: 146 },
        },
      },
      {
        id: 3,
        name: "Partner: Acme webhook receiver",
        prefix: "mg_live_ghi56",
        environment: "production",
        scopes: "read_only",
        isRevoked: false,
        isExpired: false,
        createdAtRelative: "۱ ماه پیش",
        lastUsedAtRelative: "۱۲ دقیقه پیش",
        usage: {
          last24h: { success: 96, client: 2, server: 0, total: 98 },
          last7d: { success: 612, client: 14, server: 1, total: 627 },
          allTime: { success: 2408, client: 51, server: 4, total: 2463 },
        },
      },
      {
        id: 4,
        name: "Old: deprecated dashboard",
        prefix: "mg_live_jkl78",
        environment: "production",
        scopes: "read_only",
        isRevoked: false,
        isExpired: true,
        createdAtRelative: "۶ ماه پیش",
        lastUsedAtRelative: "۲ ماه پیش",
        usage: {
          last24h: { success: 0, client: 0, server: 0, total: 0 },
          last7d: { success: 0, client: 0, server: 0, total: 0 },
          allTime: { success: 187, client: 12, server: 0, total: 199 },
        },
      },
      {
        id: 5,
        name: "Leaked: committed by accident",
        prefix: "mg_test_mno90",
        environment: "development",
        scopes: "full",
        isRevoked: true,
        isExpired: false,
        createdAtRelative: "۳ ماه پیش",
        lastUsedAtRelative: "۱ ماه پیش",
        usage: {
          last24h: { success: 0, client: 0, server: 0, total: 0 },
          last7d: { success: 0, client: 0, server: 0, total: 0 },
          allTime: { success: 38, client: 4, server: 0, total: 42 },
        },
      },
    ],

    /* کلید کامل که در طول صحنهٔ createKey نمایش داده می‌شود — داده‌های
     * محلی دمو. هرگز یک کلید واقعی نیست. شبیه یک کلید واقعی mg_test_
     * (mg_test_ + ۲۴ کاراکتر url-safe) به‌نظر می‌رسد. */
    revealedKey: "mg_test_7c3b9f1e4a2d4e7b9c1a8b4f5e2d3a01",
    revealedPrefix: "mg_test_7c3",
    revealedName: "Production backend worker",
  },

  /* ─── Creative section copy ──────────────────────────────────────────── */
  creative: {
    /* 1. Key anatomy — سه بخش یک کلید API + چرخهٔ ذخیره‌سازی */
    keyAnatomy: {
      heading: "تشریح کلید",
      subheading:
        "یک کلید API سه بخش دارد: یک پیشوند (mg_test_ یا mg_live_)، یک راز (۲۴ کاراکتر url-safe) و هش SHA-256 زیرین که Nixify ذخیره می‌کند. کلید کامل هنگام ایجاد یک‌بار نمایش داده می‌شود؛ فقط هش و ۱۲ کاراکتر اول ذخیره می‌شوند. این قرارداد توسط src/lib/dx/api-keys.ts اعمال می‌شود — مسیرها بر اساس هش تأیید می‌شوند، نه راز.",
      partsTitle: "سه بخش یک کلید",
      parts: [
        {
          key: "prefix",
          label: "پیشوند",
          desc: "۸ کاراکتر اول محیط را شناسایی می‌کنند (mg_test_ برای توسعه، mg_live_ برای تولید). ۱۲ کاراکتر اول برای نمایش ذخیره می‌شوند تا مدیران بتوانند کلیدها را بدون راز شناسایی کنند.",
          token: "mg_live_abC12",
          tone: "ui",
        },
        {
          key: "secret",
          label: "راز",
          desc: "۲۴ کاراکتر url-safe با randomBytes(18).toString(\"base64url\") تولید می‌شود. یک‌بار در دیالوگ reveal نمایش داده می‌شود؛ هرگز ذخیره نمی‌شود. با پیشوند ترکیب می‌شود تا کلید کامل را بسازد که ادغام ارسال می‌کند.",
          token: "7c3b9f1e4a2d4e7b9c1a8b4f",
          tone: "secret",
        },
        {
          key: "hash",
          label: "هش SHA-256",
          desc: "در ستون keyHash روی ردیف ApiKey ذخیره می‌شود. توسط verifyApiKey() برای مقایسهٔ یک کلید ورودی با رکورد بدون آنکه هرگز راز ذخیره شود استفاده می‌شود. هش یک‌طرفه است — راز از آن قابل بازیابی نیست.",
          token: "sha256:7c3b9f1e4a2d4e7b9c1a8b4f5e2d3a01…",
          tone: "storage",
        },
      ],
      fullKey: "mg_live_7c3b9f1e4a2d4e7b9c1a8b4f",
      cycleTitle: "چرخهٔ create → store → verify → revoke",
      cycleSubtitle:
        "هر کلید از همان چرخهٔ چهار مرحله‌ای می‌گذرد. راز کامل فقط در مرحلهٔ ۱ (reveal) و سمت ادغام به‌صورت plaintext وجود دارد؛ Nixify هرگز آن را ذخیره نمی‌کند.",
      cycle: [
        {
          badge: "۰۱",
          title: "Create",
          body: "POST /api/admin/api-keys با name + environment + scopes (+ اختیاری expiresAt). از createResourceWithCapacity (قفل ردیف تراکنشی) می‌گذرد. کلید کامل را یک‌بار در پاسخ برمی‌گرداند.",
          token: "POST /api/admin/api-keys",
          tone: "ui",
        },
        {
          badge: "۰۲",
          title: "Reveal یک‌بار",
          body: "دیالوگ reveal کلید کامل را نشان می‌دهد. قبل از بستن دیالوگ آن را در یک مدیریتگر اسرار کپی کنید. Nixify فقط SHA-256(key) (keyHash) و ۱۲ کاراکتر اول (prefix) را ذخیره می‌کند؛ راز کامل برای همیشه از دست می‌رود وقتی دیالوگ بسته می‌شود.",
          token: "keyHash = SHA-256(fullKey)",
          tone: "secret",
        },
        {
          badge: "۰۳",
          title: "Verify",
          body: "هنگامی‌که ادغام کلید را در هدر Authorization ارسال می‌کند، verifyApiKey() آن را هش می‌کند، بر اساس keyHash lookup می‌کند و revokedAt + expiresAt را بررسی می‌کند. در صورت موفقیت، lastUsedAt + lastUsedIp به‌روز می‌شوند (best-effort، non-blocking). در صورت شکست، دلیل invalid_format / not_found / revoked / expired است.",
          token: "verifyApiKey(rawKey, ip)",
          tone: "storage",
        },
        {
          badge: "۰۴",
          title: "Revoke",
          body: "DELETE /api/admin/api-keys?id=X یک حذف نرم است — revokedAt = now را تنظیم می‌کند. keyHash + prefix برای تاریخچهٔ ممیزی نگه داشته می‌شوند. هر درخواست در جریان که با این کلید امضا شده بود بلافاصله با خطا مواجه می‌شود. کلیدهای revoke‌شده به سهمیه حساب نمی‌شوند.",
          token: "DELETE /api/admin/api-keys?id=X",
          tone: "revoke",
        },
      ],
      footnote:
        "همهٔ چهار مرحله در src/lib/dx/api-keys.ts پیاده‌سازی شده‌اند (createApiKey، hashKey، verifyApiKey، revokeApiKey) و توسط مسیرهای در src/app/api/admin/api-keys/ عرضه شده‌اند. داشبورد فقط از طریق آن مسیرها می‌خواند/نوشت — هرگز مستقیماً روی جدول ApiKey.",
      warningTitle: "یک‌بار نمایش، هرگز قابل بازیابی",
      warningBody:
        "داشبورد نمی‌تواند یک کلید کامل گمشده را بازیابی کند. دیالوگ reveal تنها زمانی است که در سمت Nixify به‌صورت plaintext وجود دارد. اگر آن را گم کنید، کلید را revoke کنید و یکی جدید بسازید — مسیر بازنشانی گذرواژه وجود ندارد.",
    },

    /* 2. Live vs Test — مقایسهٔ mg_live_ در برابر mg_test_ */
    liveVsTest: {
      heading: "زنده در برابر تست",
      subheading:
        "هر کلید با پیشوندی شروع می‌شود که محیط آن را شناسایی می‌کند: mg_test_ برای توسعه، mg_live_ برای تولید. پیشوند بیش از یک برچسب است — تعیین می‌کند کلید به کدام داده می‌تواند دسترسی داشته باشد. پیشوند را در انتخابگر محیط دیالوگ create انتخاب کنید؛ داشبورد آن را به‌عنوان نشان رنگی (dev کهربایی / prod سبز) روی هر ردیف نشان می‌دهد.",
      testCard: {
        badge: "تست",
        title: "mg_test_",
        body:
          "برای توسعه، staging و CI. کلیدهای تست به محیط تست هدف‌گذاری می‌شوند — باگ‌ها در اسکریپت شما نمی‌توانند به‌طور تصادفی مخاطبان تولید را حذف کنند یا OTPهای واقعی به گیرندگان واقعی ارسال کنند.",
        bullets: [
          "در طول توسعهٔ محلی و تست ادغام استفاده کنید",
          "امن برای به اشتراک‌گذاری با همکاران روی یک شاخهٔ ویژگی",
          "همچنان به سهمیهٔ طرح شما حساب می‌شود (FREE=1، PRO=5، MAX=20)",
          "همان قرارداد ذخیره‌سازی SHA-256 + reveal یک‌بار مانند کلیدهای زنده",
        ],
      },
      liveCard: {
        badge: "زنده",
        title: "mg_live_",
        body:
          "برای ادغام‌های تولید — workerهای بک‌اند، jobهای زمان‌بندی‌شده، webhookهای شریک. کلیدهای زنده به داده‌های واقعی با دسترسی‌های تولید دسترسی دارند. یک باگ در اسکریپت شما روی گیرندگان واقعی اثر می‌گذارد.",
        bullets: [
          "فقط در استقرارهای تولید استفاده کنید",
          "هرگز به کنترل نسخه commit نکنید یا در چت نچسبانید",
          "در یک مدیریتگر اسرار ذخیره کنید (AWS Secrets Manager، Doppler، Vault)",
          "بر اساس یک زمان‌بندی ۹۰ روزه rotate کنید؛ هنگام شک بلافاصله revoke",
        ],
      },
      matrixTitle: "تست در برابر زنده — یک‌نگاه",
      matrixSubtitle:
        "هر دو نوع کلید از همان خط لولهٔ تولید، هش‌کردن و تأیید استفاده می‌کنند. فقط پیشوند + داده‌ای که می‌توانند ببینند متفاوت است.",
      testCol: "تست",
      liveCol: "زنده",
      dimensionCol: "بعد",
      rows: [
        {
          key: "environment",
          dimension: "کد محیط",
          testValue: "development",
          liveValue: "production",
        },
        {
          key: "prefix",
          dimension: "پیشوند کلید",
          testValue: "mg_test_",
          liveValue: "mg_live_",
        },
        {
          key: "purpose",
          dimension: "هدف",
          testValue: "Dev، staging، CI",
          liveValue: "ادغام‌های تولید",
        },
        {
          key: "riskLevel",
          dimension: "ریسک در صورت نشت",
          testValue: "پایین — فقط دادهٔ تست",
          liveValue: "بالا — گیرندگان واقعی، دادهٔ واقعی",
        },
        {
          key: "keyStatus",
          dimension: "ذخیره‌شده به‌عنوان",
          testValue: "SHA-256(key) + پیشوند ۱۲ کاراکتری",
          liveValue: "SHA-256(key) + پیشوند ۱۲ کاراکتری",
        },
        {
          key: "rotation",
          dimension: "دورهٔ rotate",
          testValue: "هر زمان که راحت بود",
          liveValue: "هر ۹۰ روز",
        },
      ],
      warningTitle: "هرگز یک کلید زنده را commit نکنید",
      warningBody:
        "یک کلید زنده در تاریخچهٔ git عملاً نشت کرده است. هر کسی با دسترسی repo — شامل مشارکت‌کنندگان آینده و یک لپ‌تاپ به‌خطرافتاده — آن را دارد. اگر اتفاق افتاد، بلافاصله revoke کنید، یک کلید جدید بسازید، آن را در یک مدیریتگر اسرار ذخیره کنید و ترافیک غیرمنتظره در RequestLog خود را ممیزی کنید.",
    },

    /* 3. Scopes explainer — full در برابر read_only با مثال‌ها */
    scopesExplainer: {
      heading: "Scopeها",
      subheading:
        "هر کلید یک scope دارد: full (همهٔ endpointها، شامل نوشتن‌ها) یا read_only (فقط GET). کوچک‌ترین scope را که کار را انجام می‌دهد انتخاب کنید. scope توسط hasScope() در src/lib/dx/api-keys.ts روی هر درخواست احراز هویت‌شده بررسی می‌شود — full هر عملیاتی را مجاز می‌کند، read_only فقط action === \"read\" را مجاز می‌کند.",
      fullCard: {
        badge: "full",
        title: "همهٔ endpointها",
        body:
          "برای ادغام‌هایی که نیاز به نوشتن دارند — ارسال OTP، ایجاد مخاطب، مدیریت broadcast، راه‌اندازی خودکارسازی‌ها. برای workerهای بک‌اند، jobهای زمان‌بندی‌شده و هر کدی که داده را تغییر می‌دهد استفاده کنید.",
        bullets: [
          "مجاز: هر endpoint، شامل POST / PUT / DELETE",
          "به‌عنوان رشتهٔ تحت‌اللفظی \"full\" در ستون scopes ذخیره می‌شود",
          "hasScope(\"full\", anyAction) → true",
          "فقط وقتی ادغام واقعاً نیاز به دسترسی نوشتن دارد استفاده کنید",
        ],
      },
      readOnlyCard: {
        badge: "read_only",
        title: "فقط GET",
        body:
          "برای ادغام‌هایی که فقط می‌خوانند — داشبوردهای تحلیلی، pullerهای لاگ ممیزی، صفحات وضعیت، بررسی‌کننده‌های webhook شریک. یک کلید read_only نشت‌شده می‌تواند داده را بیرون بکشد اما نمی‌تواند چیزی را تغییر دهد.",
        bullets: [
          "مجاز: هر endpoint GET (action === \"read\")",
          "رد شده: هر POST / PUT / DELETE (action !== \"read\")",
          "hasScope(\"read_only\", \"read\") → true",
          "hasScope(\"read_only\", \"full\") → false",
        ],
      },
      matrixTitle: "هر scope می‌تواند چه چیزی فراخوانی کند",
      matrixSubtitle:
        "هر مسیر احراز هویت‌شده یک scope موردنیما اعلام می‌کند. hasScope() مقدار true برمی‌گرداند اگر scope کلید، عمل موردنیما را تأمین کند. مسیرهای خواندن \"read\" را می‌گذرانند؛ مسیرهای نوشتن \"full\" را.",
      methodCol: "Endpoint",
      descCol: "کارکرد",
      fullCol: "full",
      readOnlyCol: "read_only",
      examples: [
        {
          method: "GET /api/dashboard/contacts",
          desc: "فهرست مخاطبان در حساب شما.",
          full: true,
          readOnly: true,
          tone: "read",
        },
        {
          method: "POST /api/dashboard/contacts",
          desc: "ایجاد یا به‌روزرسانی یک مخاطب.",
          full: true,
          readOnly: false,
          tone: "write",
        },
        {
          method: "POST /api/otp/send",
          desc: "ارسال یک one-time passcode به یک ایمیل.",
          full: true,
          readOnly: false,
          tone: "write",
        },
        {
          method: "GET /api/dashboard/deliveries",
          desc: "فهرست ردیف‌های EmailDelivery برای کارآگاهی.",
          full: true,
          readOnly: true,
          tone: "read",
        },
        {
          method: "POST /api/dashboard/broadcasts",
          desc: "ایجاد + ارسال یک broadcast بازاریابی.",
          full: true,
          readOnly: false,
          tone: "write",
        },
        {
          method: "POST /api/dashboard/suppressions",
          desc: "افزودن یک ورودی عدم‌ارسال دستی.",
          full: true,
          readOnly: false,
          tone: "write",
        },
      ],
      customScopesNote:
        "hasScope() از comma-separated custom scopeها هم پشتیبانی می‌کند (مثلاً \"otp:send,contacts:read\") برای دسترسی دانه‌دانه‌تر. دیالوگ create داشبورد فقط full و read_only را ارائه می‌دهد — برای تنظیم یک custom scope، POST /api/admin/api-keys را مستقیماً با یک رشتهٔ custom scopes فراخوانی کنید. custom scopeها با تطابق دقیق با عملی که مسیر نیاز دارد بررسی می‌شوند.",
      footnote:
        "در src/lib/dx/api-keys.ts پیاده‌سازی شده است (hasScope). مسیرها helper را import می‌کنند و آن را با عمل موردنیما فراخوانی می‌کنند: \"read\" برای endpointهای GET، \"full\" برای همه‌چیز دیگر. داشبورد هرگز بیش از یک رشتهٔ scope در هر کلید ذخیره نمی‌کند.",
    },

    /* 4. Secure storage checklist */
    secureStorageChecklist: {
      heading: "چک‌لیست ذخیرهٔ امن",
      subheading:
        "هشدار security-tips داشبورد شما را به اصول اولیه یادآوری می‌کند. در اینجا چرخهٔ کامل یک کلید ذخیره‌شده‌ی امن — از ایجاد تا rotate تا revoke — آمده است. هر مرحله را دنبال کنید؛ داشبورد نمی‌تواند یک کلید گمشده را بازیابی کند.",
      doTitle: "انجام دهید",
      doItems: [
        {
          key: "secret-manager",
          title: "در یک مدیریتگر اسرار ذخیره کنید",
          body: "از AWS Secrets Manager، GCP Secret Manager، Doppler، Vault یا معادل پلتفرم خود استفاده کنید. هرگز یک فایل .env با plaintext در repo.",
          token: "AWS Secrets Manager",
          tone: "do",
        },
        {
          key: "bearer-header",
          title: "به‌عنوان Bearer token ارسال کنید",
          body: "کلید را در هدر Authorization به‌عنوان \"Bearer mg_live_…\" بگذارید. هرگز در URL (URLها در لاگ‌های دسترسی می‌روند).",
          token: "Authorization: Bearer mg_live_…",
          tone: "do",
        },
        {
          key: "least-privilege",
          title: "کوچک‌ترین scope را انتخاب کنید",
          body: "پیش‌فرض read_only. فقط وقتی ادغام واقعاً نیاز به نوشتن دارد به full ارتقا دهید. یک کلید read_only نشت‌شده می‌تواند داده را بیرون بکشد؛ یک کلید full نشت‌شده می‌تواند آن را تغییر دهد.",
          token: "read_only",
          tone: "do",
        },
        {
          key: "test-first",
          title: "اول با mg_test_ تست کنید",
          body: "با یک کلید mg_test_ توسعه دهید. تأیید کنید ادغام می‌تواند آنچه نیاز دارد بخواند، خطاها را با ظرافت مدیریت کند، و روی 5xx retry کند. فقط آن‌گاه به mg_live_ ارتقا دهید.",
          token: "mg_test_",
          tone: "do",
        },
      ],
      avoidTitle: "اجتناب کنید",
      avoidItems: [
        {
          key: "git-commit",
          title: "به کنترل نسخه commit نکنید",
          body: "هنگامی‌که یک کلید در تاریخچهٔ git است — حتی یک repo خصوصی — عملاً نشت کرده است. اگر اتفاق افتاد بلافاصله rotate کنید؛ داشبورد نمی‌تواند آن را بازیابی کند.",
          token: "git",
          tone: "avoid",
        },
        {
          key: "url-param",
          title: "در پارامترهای URL نگذارید",
          body: "URLها توسط proxyها، CDNها و لاگ‌های دسترسی ثبت می‌شوند. به‌جای آن از هدر Authorization استفاده کنید.",
          token: "?api_key=…",
          tone: "avoid",
        },
        {
          key: "chat-paste",
          title: "در چت یا تیکت‌ها نچسبانید",
          body: "Slack، Jira، GitHub Issues — همگی پیام‌ها را به‌طور نامحدود نگه می‌دارند. از یک ابزار اشتراک‌گذاری اسرار استفاده کنید که لینک را پس از یک مشاهده منقضی کند.",
          token: "Slack",
          tone: "avoid",
        },
        {
          key: "shared-env",
          title: "یک کلید را بین محیط‌ها دوباره استفاده نکنید",
          body: "هر محیط (dev، staging، prod) باید کلید خودش با پیشوند خودش داشته باشد. یک کلید dev نشت‌شده نباید همان راز کلید prod شما باشد.",
          token: "mg_test_ ≠ mg_live_",
          tone: "avoid",
        },
      ],
      rotateTitle: "Rotate",
      rotateItems: [
        {
          key: "schedule",
          title: "یک تقویم rotate ۹۰ روزه تنظیم کنید",
          body: "حتی بدون هیچ نفوذ شناخته‌شده‌ای، rotate کردن هر ۹۰ روز یک عادت سالم است. ابتدا کلید جدید را بسازید، ادغام را به‌روز کنید، سپس قدیمی را revoke کنید.",
          token: "90 days",
          tone: "rotate",
        },
        {
          key: "verify-usage",
          title: "تأیید کنید کلید جدید استفاده می‌شود",
          body: "پس از rotate، پنل استفادهٔ هر کلید داشبورد را بررسی کنید — bucket آخرین ۲۴ ساعت کلید جدید باید قبل از revoke قدیمی غیرصفر باشد.",
          token: "View usage",
          tone: "rotate",
        },
        {
          key: "immediate-revoke",
          title: "هنگام شک بلافاصله revoke کنید",
          body: "اگر مهر زمانی Last used اخیر است اما شما هیچ فراخوانی نکرده‌اید، یا یک شریک گزارش نقض می‌دهد، بلافاصله revoke کنید. keyHash برای ممیزی نگه داشته می‌شود؛ کلید از لحظه‌ای که revokedAt تنظیم می‌شود کار نمی‌کند.",
          token: "Revoke",
          tone: "rotate",
        },
      ],
      footnote:
        "هشدار security-tips داشبورد سه قانون با بالاترین اثر را نشان می‌دهد: (۱) mg_test_ برای dev، mg_live_ فقط برای prod. (۲) به‌طور دوره‌ای rotate کنید و کلیدهای استفاده‌نشده را revoke کنید. (۳) از scope یعنی read_only برای محدود کردن ریسک استفاده کنید. چک‌لیست کامل بالا نسخهٔ عملیاتی آن قوانین است.",
      warningTitle: "داشبورد نمی‌تواند یک کلید گمشده را بازیابی کند",
      warningBody:
        "Nixify فقط هش SHA-256 و یک پیشوند ۱۲ کاراکتری را ذخیره می‌کند — راز کامل فقط در طول دیالوگ reveal به‌صورت plaintext وجود دارد. اگر آن را گم کنید، کلید را revoke کنید و یکی جدید بسازید. مسیر بازنشانی گذرواژه وجود ندارد.",
    },
  },
};
