/**
 * UX-B: Automations guide — Persian content dictionary.
 *
 * همان استاندارد محتوای انگلیسی، با ترجمهٔ روان و وفادار.
 * توکن‌های فنی (نوع اتوماسیون «otp-verified-welcome»، نام متغیرها مثل
 * email/name، اسلاگ قالب‌ها، زمان‌های ISO، جای‌نگهدارهای {{var}}، رشته‌های
 * نسخه) به‌صورت رشتهٔ خام ذخیره می‌شوند و در زمان رندر توسط <Ltr> به‌صورت
 * چپ‌به‌راست نمایش داده می‌شوند.
 *
 * دقت محتوایی (بازرسی شده در برابر منبع):
 *   - داشبورد Automations یک کارت تنها با عنوان «OTP Verified → Welcome
 *     Email» و آیکن emerald رنگ MailCheck است. هیچ rule builder وجود ندارد،
 *     هیچ ویرایشگر چندشرطی، هیچ فلوچارت — فقط:
 *       سربرگ کارت: عنوان + توضیحات در سمت چپ؛ یک جعبهٔ حاشیه‌دار در
 *         سمت راست با یک برچسب «Enabled» / «Disabled»، یک راهنما
 *         («Auto-saves» یا «Saving…») و یک سوییچ (emerald هنگام روشن‌بودن).
 *       نوار وضعیت زیر سربرگ: نشان در میان «Active» (emerald)،
 *         «Enabled — no template» (کهربایی)، «Enabled — incompatible»
 *         (کهربایی)، «Paused» (مات) + «Updated {relativeTime}» در سمت راست.
 *       CardContent (gap-6, pt-6): بلوک انتخاب‌گر قالب، یک شبکهٔ دوستونی
 *         از جعبه‌های اطلاعاتی حاشیه‌دار (Built-in variables / Template
 *         required variables) و یک هشدار CompatibilityIndicator.
 *       پاورقی راهنما زیر کارت: «Need a template that only uses {{email}}
 *         and {{name}}?» + لینک emerald «Browse templates →».
 *
 *   - رفتار auto-save: رابط کاربری خوش‌بینانه. سوییچ‌زدن تابع handleToggle()
 *     را فعال می‌کند → PUT /api/dashboard/automations/otp-verified-welcome
 *     با `{ enabled, templateId? }`. هنگام پرواز PUT، راهنما «Saving…»
 *     می‌خواند؛ پس از موفقیت به «Auto-saves» برمی‌گردد و یک toast
 *     («Enabled» / «Disabled») ظاهر می‌شود. الگوی مشابه برای Select قالب:
 *     به‌روزرسانی خوش‌بینانه → PUT → toast («Template selected» /
 *     «Template cleared»).
 *
 *   - کلید نوع اتوماسیون رشتهٔ تحت‌اللفظی «otp-verified-welcome» است.
 *     هنگامی که یک مخاطب OTP خود را از طریق POST /api/auth/verify-email
 *     تأیید می‌کند، فعال می‌شود.
 *
 *   - متغیرهای組み込み (همیشه ارائه می‌شوند): {{email}} و {{name}}.
 *
 *   - قواعد سازگاری: setting.compatible توسط بک‌اند محاسبه می‌شود بر اساس
 *     اینکه آیا هر متغیری که قالب انتخاب‌شده ارجاع می‌دهد در builtInVariables
 *     هست یا نه. اگر compatible === false باشد، هشدار CompatibilityIndicator
 *     یک AlertTriangle کهربایی نشان می‌دهد که متغیرهای مفقود را به‌صورت
 *     نشان‌های کهربایی فهرست می‌کند — و هشدار می‌دهد «fail at send-time
 *     and retry» (اگر فعال باشد) یا «not fire when enabled» (اگر غیرفعال باشد).
 *
 *   - نقاط انتهایی واقعی API (در stage فراخوانی نمی‌شوند — فقط برای آموزش):
 *       GET  /api/dashboard/automations/otp-verified-welcome
 *       PUT  /api/dashboard/automations/otp-verified-welcome
 *            body: { enabled: boolean; templateId?: number | null }
 *       GET  /api/dashboard/templates?pageSize=100   (Dropdown را پر می‌کند)
 *
 *   - احراز هویت / استحقاق:
 *       401 → router.push("/auth")
 *       403 → نمایش entitled=false («Not available» + دکمه «View Plans»)
 *
 * این دیکشنری همچنین شامل:
 *   - stage: رشته‌های انسانی صفحهٔ شبیه‌سازی‌شدهٔ AutomationsStage به فارسی.
 *   - creative: محتوای چهار بخش خلاقانه (جریان Trigger → Action،
 *     داستان اجرای «چه اتفاقی می‌افتد هنگام شلیک؟»، سفر نمونهٔ رویداد،
 *     چک‌لیست طراحی ایمن).
 */

import type { AutomationsGuideContent } from "./automations-types";

export const automationsFa: AutomationsGuideContent = {
  slug: "automations",
  category: "automation",
  dashboardRoute: "/dashboard/automations",
  title: "اتوماسیون‌ها",
  description:
    "جریان‌های کاری ایمیل مبتنی‌برトリガر را پیکربندی کنید. اتوماسیون Welcome Email هنگامی که یک مخاطب OTP خود را تأیید کند، به‌طور خودکار فعال می‌شود.",
  routeKey: "automations",
  backHref: "/dashboard/automations",
  stepCount: 5,
  durationMin: 4,
  chapters: [
    {
      id: "intro",
      title: "اتوماسیون‌ها",
      steps: [
        {
          id: "automationOverview",
          caption:
            "صفحهٔ Automations یک کارت تنها با عنوان «OTP Verified → Welcome Email» است. هیچ rule builder وجود ندارد — فقط یک سوییچ برای فعال/غیرفعال‌کردن اتوماسیون و یک Select برای انتخاب قالب تراکنشی که هنگام تأیید OTP توسط مخاطب شلیک می‌شود. سربرگ کارت آیکن MailCheck و توضیحات را نشان می‌دهد؛ سمت راست سوییچ و راهنمای «Auto-saves» را نگه می‌دارد.",
          duration: 7000,
          scene: "automationOverview",
        },
        {
          id: "toggleSwitch",
          caption:
            "برای فعال یا غیرفعال‌کردن اتوماسیون، سوییچ را در گوشهٔ بالا-راست سربرگ کارت بزنید. برچسب بین «Enabled» (emerald) و «Disabled» تغییر می‌کند. هنگامی که PUT در حال انجام است، راهنما «Saving…» می‌خواند — پس از بازگشت پاسخ، راهنما به «Auto-saves» برمی‌گردد و یک toast وضعیت جدید را تأیید می‌کند.",
          duration: 7000,
          scene: "toggleSwitch",
        },
        {
          id: "selectTemplate",
          caption:
            "از Select زیر سوییچ، یک قالب Welcome انتخاب کنید. اولین آیتم همیشه «— No template —» است؛ زیر جداکننده، هر قالب تراکنشی که دارید با نام و اسلاگش فهرست شده است. انتخاب یکی به‌صورت خوش‌بینانه آن را تنظیم می‌کند و یک PUT شلیک می‌کند — ردیف تا زمان رسیدن پاسخ یک spinner «Saving…» نشان می‌دهد.",
          duration: 7000,
          scene: "selectTemplate",
        },
        {
          id: "autoSave",
          caption:
            "Auto-save مدل ماندگاری صفحه است — هیچ دکمهٔ Save در هیچ‌جای صفحه نیست. هر سوییچ‌زدن و هر انتخاب قالب بلافاصله یک PUT به /api/dashboard/automations/otp-verified-welcome شلیک می‌کند. رابط خوش‌بینانه مقدار جدید را فوراً نمایش می‌دهد؛ اگر PUT ناموفق باشد، مقدار بازمی‌گردد و یک toast خطا را نشان می‌دهد.",
          duration: 7000,
          scene: "autoSave",
        },
        {
          id: "activeState",
          caption:
            "هنگامی که اتوماسیون فعال است، یک قالب انتخاب شده و قالب سازگار است (فقط به {{email}} و {{name}} ارجاع می‌دهد)، نوار وضعیت یک نشان emerald «Active» با آیکن CheckCircle2 نشان می‌دهد. یعنی: در تأیید موفق بعدی OTP، Nixify قالب welcome را رندر کرده و ایمیل welcome را به‌طور خودکار می‌فرستد.",
          duration: 7500,
          scene: "activeState",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "باز کردن صفحهٔ Automations",
      body: "از نوار کناری داشبورد روی Automations کلیک کنید. سربرگ صفحه شامل دکمهٔ بازگشت، آیکن emerald رنگ Zap، عنوان h1 «Automations» و زیرعنوان «Configure automatic email workflows triggered by user events.» است. زیر آن یک کارت تنها با عنوان «OTP Verified → Welcome Email» قرار دارد. در این صفحه هیچ rule builder وجود ندارد — فقط یک سوییچ و یک Select.",
    },
    {
      title: "فعال‌کردن اتوماسیون Welcome Email",
      body: "در گوشهٔ بالا-راست سربرگ کارت یک جعبهٔ حاشیه‌دار با برچسب «Enabled» / «Disabled»، یک راهنما («Auto-saves» یا «Saving…») و یک سوییچ قرار دارد. روی سوییچ کلیک کنید تا روشن شود. برچسب به emerald «Enabled» تغییر می‌کند و یک toast با توضیح «Welcome emails will be sent on successful OTP verification.» آن را تأیید می‌کند. PUT بلافاصله انجام می‌شود — هیچ دکمهٔ Save وجود ندارد.",
    },
    {
      title: "انتخاب قالب Welcome",
      body: "زیر سربرگ، Select با برچسب «Welcome template» را پیدا کنید. کلیک روی آن یک dropdown باز می‌کند که اولین آیتم آن «— No template —» است، سپس یک جداکننده، و سپس هر قالب تراکنشی که دارید — هرکدام با نام (ضخیم) و اسلاگ (مونو) نشان داده می‌شود. یکی را انتخاب کنید. Select جمع می‌شود، یک spinner «Saving…» کوتاه ظاهر می‌شود، سپس ردیف به‌روز می‌شود و «Using template {name} (v{version}).» را با آیکن FileText نشان می‌دهد.",
    },
    {
      title: "بررسی سازگاری قالب",
      body: "شبکهٔ دوستونی زیر Select در سمت چپ «Built-in variables» (همیشه {{email}} و {{name}} در نشان‌های emerald) و در سمت راست «Template required variables» را نشان می‌دهد. کارت سمت راست هر متغیری که قالب انتخاب‌شده ارجاع می‌دهد را فهرست می‌کند — emerald با CheckCircle2 اگر ارائه شده باشد، rose اگر مفقود باشد. هشدار CompatibilityIndicator زیر این را منعکس می‌کند: emerald «Compatible» اگر همهٔ متغیرها ارائه شده باشند؛ کهربایی «Incompatible» اگر هر کدام مفقود باشند.",
    },
    {
      title: "تأیید وضعیت Active",
      body: "هنگامی که فعال + دارای قالب + سازگار باشد، نوار وضعیت زیر سربرگ کارت یک نشان emerald «Active» با CheckCircle2 نشان می‌دهد. در سمت راست نشان، «Updated {relativeTime}» (مثلاً «Updated 2 minutes ago») با آیکن Clock قرار دارد. اتوماسیون اکنون فعال است — در تأیید موفق بعدی OTP، Nixify قالب انتخاب‌شده را با {{email}} و {{name}} رندر کرده و آن را می‌فرستد.",
    },
  ],
  whyWhen: [
    {
      title: "چه زمانی اتوماسیون Welcome Email شلیک می‌کند",
      body: "نوع اتوماسیون «otp-verified-welcome» است. لحظه‌ای که یک مخاطب OTP خود را از طریق POST /api/auth/verify-email تأیید می‌کند فعال می‌شود — Nixify سپس قالب welcome انتخاب‌شده را با متغیرهای組み込み {{email}} (آدرس تأییدشده) و {{name}} (نام مخاطب، در صورت وجود) رندر کرده و ایمیل را می‌فرستد. هیچ cron یا trigger دستی وجود ندارد — کاملاً event-driven است.",
    },
    {
      title: "چرا فقط یک کارت",
      body: "صفحهٔ Automations در Nixify امروز یک اتوماسیون واحد را نمایش می‌دهد: ایمیل welcome تأیید-OTP. این رایج‌ترین نقطهٔ تماس onboarding است — کاربر تازه اثبات کرد که صندوق ایمیلش را در اختیار دارد، بنابراین بهترین لحظه برای سلام‌کردن به اوست. کارت عمداً مینیمال است: یک سوییچ (روشن/خاموش) + یک Select (کدام قالب) تمام چیزی است که برای پیکربندی آن نیاز دارید. انواع اتوماسیون آینده از همین شکل پیروی خواهند کرد.",
    },
    {
      title: "چرا برای شلیک به قالب نیاز است",
      body: "اتوماسیون می‌تواند بدون قالب Enabled باشد — اما شلیک نمی‌کند. نوار وضعیت «Enabled — no template» (کهربایی) را نشان می‌دهد و CompatibilityIndicator «No template selected» (مات) را نمایش می‌دهد. به‌طور مشابه، اگر قالبی انتخاب کنید که به متغیرهایی خارج از {{email}} و {{name}} (مانند {{order_id}}) ارجاع می‌دهد، وضعیت «Enabled — incompatible» را نشان می‌دهد و هشدار اخطار می‌دهد که اتوماسیون «fail at send-time and retry» خواهد کرد. همیشه قالبی انتخاب کنید که فقط از متغیرهای組みبری استفاده کند.",
    },
  ],
  mistakes: [
    {
      title: "فرض وجود دکمهٔ Save",
      body: "دکمه‌ای وجود ندارد. صفحهٔ Automations هر تغییری را auto-save می‌کند: سوییچ‌زدن، انتخاب قالب — هر کدام بلافاصله یک PUT شلیک می‌کنند. راهنمای زیر سوییچ بین «Auto-saves» (بیکار) و «Saving…» (PUT در حال انجام) چرخش می‌کند. اگر در میانهٔ ذخیره از صفحه خارج شوید، به‌روزرسانی خوش‌بینانه در خطا بازمی‌گردد و یک toast خطا را نمایش می‌دهد.",
    },
    {
      title: "انتخاب قالبی که متغیرهایی ندارد که شما دارید",
      body: "اتوماسیون فقط می‌تواند {{email}} و {{name}} را تزریق کند. اگر قالبی انتخاب کنید که بدنهٔ آن به {{order_id}} یا {{reset_link}} ارجاع می‌دهد، بک‌اند آن را ناسازگار علامت می‌زند. نشان وضعیت به کهربایی «Enabled — incompatible» تبدیل می‌شود و هشدار CompatibilityIndicator متغیرهای مفقود را به‌صورت نشان‌های کهربایی فهرست می‌کند. اتوماسیون شلیک نخواهد کرد — و اگر دوباره آن را فعال کنید، تأیید OTP بعدی در زمان ارسال با شکست مواجه و retry می‌شود.",
    },
    {
      title: "گذاشتن اتوماسیون در حالت Enabled بدون قالب",
      body: "روشن‌کردن سوییچ بدون انتخاب قالب مجاز است (مسدود نمی‌شوید)، اما صفحه را در حالت کهربایی «Enabled — no template» قرار می‌دهد. هیچ ایمیل welcome در تأیید OTP ارسال نخواهد شد. همیشه سوییچ را با انتخاب قالب جفت کنید — هر دو باید تنظیم شوند تا وضعیت emerald «Active» به‌دست آید.",
    },
    {
      title: "انتظار شلیک فوری اتوماسیون هنگام ذخیره",
      body: "روشن‌کردن سوییچ همین حالا یک ایمیل welcome نمی‌فرستد. این قاعده را مسلح می‌کند: دفعهٔ بعدی که یک مخاطب OTP خود را تأیید کند، ایمیل welcome شلیک خواهد شد. برای آزمایش end-to-end، یک مخاطب جدید ثبت‌نام کنید، OTP درخواست کنید و آن را تأیید کنید — سپس صفحهٔ Sent Emails را بررسی کنید تا تأیید کنید ایمیل welcome تحویل داده شده است.",
    },
    {
      title: "فراموش‌کردن اینکه فهرست قالب‌ها از /api/dashboard/templates می‌آید",
      body: "Select با GET /api/dashboard/templates?pageSize=100 پر می‌شود. اگر قالب جدیدی در صفحهٔ Templates ایجاد کرده‌اید و اینجا ظاهر نمی‌شود، صفحهٔ Automations را تازه‌سازی کنید (فهرست یک‌بار هنگام mount دریافت می‌شود). اگر fetch کاملاً ناموفق باشد، dropdown یک راهنمای مات «No transactional templates found.» و یک لینک emerald «Create one →» به /dashboard/templates نشان می‌دهد.",
    },
  ],
  proTips: [
    {
      title: "قالب welcome را فقط حول {{email}} و {{name}} طراحی کنید",
      body: "اتوماسیون فقط {{email}} و {{name}} را تزریق می‌کند — هیچ متغیر دیگری نه. قالب welcome خود را طوری طراحی کنید که فقط از این دو توکن استفاده کند. اگر می‌خواهید با نام کوچک سلام کنید، از {{name}} استفاده کنید و اجازه دهید وقتی مخاطب نامی در پرونده ندارد، به {{email}} برگردد. بدنهٔ welcome را کوتاه، هم‌سان برند و بدون جای‌نگهدارهای شرطی نگه دارید.",
    },
    {
      title: "از CompatibilityIndicator به‌عنوان بررسی پیش‌ازپرواز استفاده کنید",
      body: "پیش از اینکه از صفحه خارج شوید، به هشدار زیر شبکهٔ متغیرها نگاهی بیندازید. emerald «Compatible» = آماده‌اید. کهربایی «Incompatible» = قالب به متغیری ارجاع می‌دهد که اتوماسیون نمی‌تواند ارائه دهد — قالب را اصلاح کنید یا قالب دیگری انتخاب کنید. مات «No template selected» = یکی انتخاب کنید. نشان در نوار وضعیت هشدار را منعکس می‌کند تا بتوانید وضعیت را در یک نگاه ببینید.",
    },
    {
      title: "شیرهٔ رفت‌وبرگشت را با یک تأیید OTP واقعی آزمایش کنید",
      body: "پس از تنظیم enabled + template + compatibility، یک مخاطب جدید ثبت‌نام کنید (یک ایمیل ناشناس خوب است)، OTP درخواست کنید، آن را در /verify-email پیست کنید و ارسال کنید. سپس به Sent Emails بروید — ایمیل welcome باید با وضعیت تحویل آنجا ظاهر شود. این آزمایش end-to-end تنها راه تأیید صحت سیم‌کشی اتوماسیون است.",
    },
  ],
  troubleshooting: [
    {
      title: "Dropdown نشان می‌دهد «No transactional templates found.»",
      body: "GET /api/dashboard/templates?pageSize=100 یک فهرست خالی (یا 403) بازگرداند. یا هنوز هیچ قالبی نساخته‌اید، یا پلن شما شامل استحقاق MESSAGING_EMAILS نیست. راهنمای زیر Select می‌خواند «You don't have any transactional templates yet.» با یک لینک emerald «Create one →» — روی آن کلیک کنید تا /dashboard/templates باز شود و یکی بسازید.",
    },
    {
      title: "نشان وضعیت می‌خواند «Enabled — incompatible template»",
      body: "قالب انتخاب‌شده به متغیری ارجاع می‌دهد که اتوماسیون نمی‌تواند ارائه دهد. هشدار کهربایی CompatibilityIndicator متغیرهای مفقود را به‌صورت نشان‌های کهربایی فهرست می‌کند. برای رفع: یا قالب را ویرایش کنید (در /dashboard/templates) تا متغیر مفقود را حذف کنید یا برای آن پیش‌فرض بگذارید، یا قالب دیگری انتخاب کنید که فقط از {{email}} و {{name}} استفاده کند. تا زمان رفع، اتوماسیون شلیک نخواهد کرد — و اگر دوباره فعال شود، در زمان ارسال با شکست مواجه و retry می‌شود.",
    },
    {
      title: "Toast می‌گوید «Failed to update automation.»",
      body: "PUT به /api/dashboard/automations/otp-verified-welcome ناموفق بود. شایع‌ترین علل: 401 (نشست منقضی شده — دوباره وارد شوید، صفحه به‌طور خودکار router.push(\"/auth\") می‌کند)، 403 (پلن شما دیگر شامل بستهٔ ویژگی Automations نیست — صفحه به نمای «Not available» با دکمهٔ «View Plans» سوییچ می‌کند)، یا 500 (خطای سرور — لحظه‌ای دیگر امتحان کنید). رابط خوش‌بینانه در خطا بازمی‌گردد تا صفحه در آخرین وضعیت شناخته‌شدهٔ خوب بماند.",
    },
    {
      title: "صفحه به‌جای کارت «Not available» نشان می‌دهد",
      body: "GET بازگرداند 403 — حساب شما استحقاق Automations را ندارد. صفحه یک آیکن Zap مرکزی در یک دایرهٔ مات، عنوان «Automations are not available on your current account»، توضیح «OTP-verified welcome automation is part of the Automations feature pack.» و یک دکمهٔ «View Plans» که به /pricing لینک می‌شود را رندر می‌کند. به پلنی ارتقا دهید که شامل بستهٔ ویژگی باشد و تازه‌سازی کنید.",
    },
    {
      title: "ایمیل welcome پس از تأیید OTP نرسید",
      body: "سه چیز را به ترتیب بررسی کنید: (1) نوار وضعیت emerald «Active» نشان می‌دهد (نه کهربایی «Enabled — no template» یا مات «Paused»)؛ (2) ایمیل مخاطب در صفحهٔ Sent Emails شما با وضعیت delivered است؛ (3) مخاطب در فهرست Suppressions نیست (مخاطب سرکوب‌شده ایمیل‌های تراکنشی دریافت نخواهد کرد). اگر هر سه درست هستند، رکورد مخاطب را بررسی کنید — اگر تأیید OTP آنها به‌صورت failed/expired برگشت، اتوماسیون شلیک نکرده است.",
    },
  ],
  checklist: [
    { label: "باز کردن صفحهٔ Automations (Dashboard → Automations)" },
    { label: "سوییچ را به «Enabled» بزنید (auto-saves می‌شود)" },
    { label: "یک قالب Welcome از dropdown انتخاب کنید" },
    { label: "تأیید اینکه CompatibilityIndicator می‌خواند emerald «Compatible»" },
    { label: "بررسی اینکه نوار وضعیت emerald «Active» نشان می‌دهد" },
    { label: "آزمایش end-to-end: ثبت‌نام یک مخاطب جدید، تأیید OTP، بررسی Sent Emails" },
  ],
  whatNext:
    "هنگامی که اتوماسیون Welcome Email مسلح شد، گام بعدی طراحی خود قالب welcome است — به /dashboard/templates بروید و یا یک قالب موجود را ویرایش کنید یا یک قالب تراکنشی جدید بسازید که فقط از {{email}} و {{name}} استفاده کند. از آنجا، Branding (تم ایمیلی که اتوماسیون با آن رندر خواهد شد) و Sent Emails (که هر ایمیل welcome که Nixify از طرف شما شلیک می‌کند با وضعیت تحویل ثبت می‌شود) را کاوش کنید.",
  related: [
    {
      label: "باز کردن Automations در داشبورد",
      href: "/dashboard/automations",
    },
    {
      label: "مرور قالب‌های تراکنشی",
      href: "/dashboard/templates",
    },
    {
      label: "مشاهدهٔ ایمیل‌های ارسال‌شده (لاگ تحویل)",
      href: "/dashboard/emails",
    },
  ],

  /* ─── Stage copy (simulated Automations page, Persian) ────────────────── */
  stage: {
    dir: "rtl",
    locale: "fa",

    header: {
      title: "اتوماسیون‌ها",
      backToDashboard: "بازگشت به داشبورد",
      subtitle: "جریان‌های کاری ایمیل خودکار را که با رویدادهای کاربر فعال می‌شوند، پیکربندی کنید.",
    },

    card: {
      title: "OTP Verified → Welcome Email",
      description:
        "هنگامی که یک OTP با موفقیت تأیید می‌شود، به‌طور خودکار یک ایمیل welcome به آدرس تأییدشده با استفاده از قالب انتخاب‌شده ارسال کنید.",
      type: "otp-verified-welcome",
    },

    toggle: {
      enabled: "Enabled",
      disabled: "Disabled",
      saving: "Saving…",
      autoSaves: "Auto-saves",
    },

    statusStrip: {
      active: "Active",
      enabledNoTemplate: "Enabled — no template",
      enabledIncompatible: "Enabled — incompatible template",
      paused: "Paused",
      updated: "Updated",
      updatedAtRelative: "۲ دقیقه پیش",
    },

    templateSelector: {
      label: "قالب Welcome",
      selectPlaceholder: "یک قالب تراکنشی انتخاب کنید…",
      noTemplateItem: "— No template —",
      noTemplatesHint: "هنوز هیچ قالب تراکنشی ندارید.",
      createOneLink: "ایجاد یکی →",
      usingTemplate: (name, version) => `استفاده از قالب ${name} (v${version}).`,
      saving: "Saving…",
    },

    variables: {
      builtInTitle: "متغیرهای組みبی",
      builtInDesc:
        "این متغیرهایی هستند که Nixify هنگام شلیک اتوماسیون به‌طور خودکار تزریق می‌کند.",
      templateRequiredTitle: "متغیرهای موردنیاز قالب",
      templateRequiredDesc: "متغیرهایی که قالب انتخاب‌شده به آن ارجاع می‌دهد.",
      templateNoVariables: "این قالب هیچ متغیری اعلام نمی‌کند.",
      selectTemplatePrompt: "برای دیدن متغیرهای موردنیازش یک قالب انتخاب کنید.",
      providedLabel: "ارائه‌شده",
      missingLabel: "مفقود",
    },

    compatibility: {
      noTemplateTitle: "هیچ قالبی انتخاب نشده",
      noTemplateDesc:
        "یک قالب تراکنشی از بالا انتخاب کنید. اتوماسیون تا زمانی که یکی انتخاب نشود و با متغیرهای組みبی سازگار باشد، شلیک نخواهد کرد.",
      compatibleTitle: "سازگار",
      compatibleDesc:
        "قالب انتخاب‌شده فقط از متغیرهایی استفاده می‌کند که Nixify می‌تواند ارائه دهد.",
      incompatibleTitle:
        "ناسازگار — قالب به متغیرهایی نیاز دارد که اتوماسیون نمی‌تواند ارائه دهد",
      incompatibleDesc:
        "اتوماسیون فقط می‌تواند email و name را تزریق کند. قالب را ویرایش کنید تا این متغیرهای مفقود را حذف کنید یا برای آنها پیش‌فرض بگذارید:",
      failAtSendTime: "در زمان ارسال با شکست مواجه و retry می‌شود",
      notFireWhenEnabled: "هنگام فعال‌بودن شلیک نمی‌شود",
    },

    helpFooter: {
      prompt: "قالبی نیاز دارید که فقط از {{email}} و {{name}} استفاده کند؟",
      browseLink: "مرور قالب‌ها →",
    },

    templates: [
      {
        id: 1,
        name: "Welcome — Onboarding",
        slug: "welcome-onboarding",
        currentVersion: 3,
        requiredVariables: ["email", "name"],
        compatible: true,
      },
      {
        id: 2,
        name: "Quick Start Guide",
        slug: "quick-start-guide",
        currentVersion: 2,
        requiredVariables: ["email", "name"],
        compatible: true,
      },
      {
        id: 3,
        name: "Welcome + Order Summary",
        slug: "welcome-order-summary",
        currentVersion: 1,
        requiredVariables: ["email", "name", "order_id"],
        compatible: false,
      },
    ],

    builtInVariables: ["email", "name"],
  },

  /* ─── Creative-section copy (Persian) ───────────────────────────────────── */
  creative: {
    triggerActionFlow: {
      heading: "Trigger → Action",
      subheading:
        "اتوماسیون Welcome Email یک trigger واحد است که به یک action واحد سیم‌کشی شده است. هیچ rule builder وجود ندارد — trigger ثابت است (OTP تأییدشده) و action ثابت است (ارسال ایمیل welcome). شما فقط کنترل می‌کنید که روشن است یا خاموش و کدام قالب را می‌فرستد.",
      trigger: {
        badge: "Trigger",
        title: "OTP تأیید شد",
        body: "یک مخاطب یک OTP معتبر را از طریق POST /api/auth/verify-email ارسال می‌کند. تأیید موفق است — Nixify ایمیل مخاطب را به‌عنوان تأییدشده ثبت کرده و رویداد otp.verified را منتشر می‌کند.",
        event: "otp.verified",
      },
      arrowLabel: "شلیک می‌کند",
      action: {
        badge: "Action",
        title: "ارسال ایمیل welcome",
        body: "Nixify تنظیم اتوماسیون otp-verified-welcome را جست‌وجو می‌کند. اگر enabled + has-template + compatible باشد، قالب انتخاب‌شده را با {{email}} و {{name}} رندر کرده و ایمیل welcome را از طریق provider فعال ارسال می‌کند.",
        action: "send.welcome_email",
      },
      caption:
        "Trigger و action توسط Nixify ثابت شده‌اند — تنها پیکربندی شما روشن/خاموش + کدام قالب است.",
      endpointHint: "PUT /api/dashboard/automations/otp-verified-welcome",
    },

    executionStory: {
      heading: "چه اتفاقی می‌افتد هنگام شلیک؟",
      subheading:
        "راهنمای گام‌به‌گام لحظه‌ای که یک مخاطب OTP خود را تأیید می‌کند. همه‌چیز زیر در میلی‌ثانیه‌ها در سمت سرور اتفاق می‌افتد — کاربر فقط ایمیل welcome را در صندوق خود می‌بیند.",
      steps: [
        {
          badge: "۰۱",
          title: "مخاطب OTP را ارسال می‌کند",
          body: "کاربر کد ۶ رقمی را در /verify-email تایپ و ارسال می‌کند. frontend با ایمیل + کد به POST /api/auth/verify-email می‌فرستد.",
          token: "POST /api/auth/verify-email",
        },
        {
          badge: "۰۲",
          title: "OTP تأیید می‌شود",
          body: "بک‌اند کد ارسالی را hash می‌کند، آن را با hash ذخیره‌شده مقایسه می‌کند، انقضا را بررسی می‌کند و ایمیل مخاطب را تأییدشده علامت می‌زند. ردیف مخاطب با source = otp_verified به‌روزرسانی می‌شود.",
          token: "otp.verified",
        },
        {
          badge: "۰۳",
          title: "تنظیم اتوماسیون خوانده می‌شود",
          body: "Nixify تنظیم اتوماسیون otp-verified-welcome را واکشی می‌کند. اگر enabled === false باشد، خط لوله اینجا متوقف می‌شود — هیچ ایمیل welcome. اگر enabled === true باشد، ادامه می‌دهد.",
          token: "GET /api/dashboard/automations/otp-verified-welcome",
        },
        {
          badge: "۰۴",
          title: "سازگاری قالب بررسی می‌شود",
          body: "اگر هیچ قالبی انتخاب نشده باشد (template_id === null) یا قالب انتخاب‌شده ناسازگار باشد (compatible === false)، خط لوله متوقف می‌شود. در غیر این صورت، بدنهٔ قالب + current_version بارگذاری می‌شود.",
          token: "compatible === true",
        },
        {
          badge: "۰۵",
          title: "متغیرها تزریق می‌شوند",
          body: "جای‌نگهدارهای {{email}} و {{name}} در قالب با ایمیل و نام مخاطب تأییدشده (یا رشتهٔ خالی اگر name برابر null باشد) جایگزین می‌شوند. نتیجه HTML آمادهٔ ارسال است.",
          token: "{{email}}, {{name}}",
        },
        {
          badge: "۰۶",
          title: "ایمیل ارسال می‌شود",
          body: "Nixify ایمیل را با تم فعال (از Branding) رندر کرده و پیام را به provider فعال (SMTP، Postmark، و غیره) تحویل می‌دهد. یک ردیف sent_emails برای پیگیری نوشته می‌شود.",
          token: "POST /api/dashboard/sent-emails",
        },
        {
          badge: "۰۷",
          title: "کاربر welcome را دریافت می‌کند",
          body: "ایمیل welcome در صندوق مخاطب فرود می‌آید. صفحهٔ Sent Emails در داشبورد ردیف جدید را با وضعیت تحویل (sent، delivered، bounced، و غیره) نشان می‌دهد.",
          token: "delivered",
        },
      ],
      footnote:
        "گام‌های ۰۱–۰۲ عمل کاربر هستند. گام‌های ۰۳–۰۶ پاسخ Nixify هستند — در میلی‌ثانیه‌ها در سمت سرور اتفاق می‌افتند، بدون هیچ بازخورد رابط کاربری به مخاطب به‌جز خود ایمیل welcome.",
    },

    eventJourney: {
      heading: "سفر نمونهٔ رویداد اتوماسیون",
      subheading:
        "یک رویداد واقعی ایمیل welcome را از ارسال مخاطب تا صندوق تحویل‌شده دنبال کنید. هر گام با سیستمی که مالک آن است و اثر جانبی (در صورت وجود) که تولید می‌کند حاشیه‌نویسی شده است.",
      legendTitle: "راهنما",
      legendItems: [
        { label: "گام رابط کاربری — آنچه مخاطب می‌بیند", tone: "ui" },
        { label: "گذار وضعیت — Nixify یک رکورد را تغییر می‌دهد", tone: "state" },
        { label: "اثر پایین‌دستی — از داشبورد خارج می‌شود", tone: "downstream" },
      ],
      steps: [
        {
          badge: "۰۱",
          title: "سارا با sara@example.com ثبت‌نام می‌کند",
          body: "سارا ایمیلش را در /signup وارد و ارسال می‌کند. Nixify یک ردیف مخاطب (source = dashboard) ایجاد کرده و یک OTP به صندوقش می‌فرستد.",
          tone: "ui",
          token: "POST /api/auth/signup",
        },
        {
          badge: "۰۲",
          title: "سارا کد ۶ رقمی را پیست می‌کند",
          body: "سارا OTP را از صندوقش می‌خواند، در /verify-email تایپ و ارسال می‌کند. frontend کد را به endpoint تأیید POST می‌کند.",
          tone: "ui",
          token: "POST /api/auth/verify-email",
        },
        {
          badge: "۰۳",
          title: "ردیف مخاطب تأییدشده علامت‌زده می‌شود",
          body: "hash OTP تطابق دارد و کد منقضی نشده است. Nixify پرچم email_verified مخاطب را به true تغییر می‌دهد و source = otp_verified را تنظیم می‌کند.",
          tone: "state",
          token: "email_verified = true",
        },
        {
          badge: "۰۴",
          title: "تنظیم اتوماسیون بارگذاری می‌شود",
          body: "سرور تنظیم اتوماسیون otp-verified-welcome را برای حساب سارا می‌خواند. enabled === true، template_id = 1 (Welcome — Onboarding, v3)، compatible === true.",
          tone: "state",
          token: "enabled && compatible",
        },
        {
          badge: "۰۵",
          title: "قالب welcome رندر می‌شود",
          body: "قالب v3 بارگذاری می‌شود، {{email}} با sara@example.com جایگزین می‌شود، {{name}} با «Sara» جایگزین می‌شود. نتیجه در تم فعال Branding پیچیده می‌شود.",
          tone: "state",
          token: "render(template, vars)",
        },
        {
          badge: "۰۶",
          title: "ایمیل welcome ارسال می‌شود",
          body: "HTML رندرشده به provider فعال تحویل داده می‌شود. یک ردیف sent_emails با status = sent و contact_id سارا نوشته می‌شود.",
          tone: "downstream",
          token: "provider.dispatch()",
        },
        {
          badge: "۰۷",
          title: "صندوق سارا welcome را دریافت می‌کند",
          body: "چند ثانیه بعد، ایمیل welcome به صندوق سارا می‌رسد. صفحهٔ Sent Emails در داشبورد به‌روزرسانی می‌شود تا وضعیت delivered را پس از تأیید provider نشان دهد.",
          tone: "downstream",
          token: "delivered",
        },
      ],
    },

    safeDesignChecklist: {
      heading: "چک‌لیست طراحی ایمن",
      subheading:
        "پیش از خروج از صفحهٔ Automations این فهرست را مرور کنید. یک اتوماسیون welcome بدپیکربندی‌شده کرش نمی‌کند — فقط بی‌صدا در ارسال شکست می‌خورد، که بدتر است.",
      items: [
        {
          label: "سوییچ Enabled است و emerald می‌خواند",
          hint: "اگر سوییچ خاموش باشد، نوار وضعیت مات «Paused» نشان می‌دهد — هیچ ایمیل welcome شلیک نخواهد شد. آن را روشن کنید.",
        },
        {
          label: "یک قالب Welcome انتخاب شده است",
          hint: "اگر هیچ قالبی انتخاب نشده باشد، وضعیت کهربایی «Enabled — no template» نشان می‌دهد. یکی از Select انتخاب کنید.",
        },
        {
          label: "قالب انتخاب‌شده فقط از {{email}} و {{name}} استفاده می‌کند",
          hint: "متغیرهای組みبی دقیقاً email و name هستند. هر {{var}} دیگر در بدنهٔ قالب آن را ناسازگار می‌کند و اتوماسیون شلیک نخواهد کرد.",
        },
        {
          label: "CompatibilityIndicator می‌خواند emerald «Compatible»",
          hint: "این هشدار محاسبهٔ سازگاری بک‌اند را منعکس می‌کند. اگر کهربایی است، قالب را پیش از خروج اصلاح کنید.",
        },
        {
          label: "نوار وضعیت emerald «Active» نشان می‌دهد",
          hint: "Active = enabled + has-template + compatible. هر چیز دیگر یعنی اتوماسیون در تأیید OTP بعدی شلیک نخواهد کرد.",
        },
        {
          label: "مهر زمانی به‌روزرسانی اخیر است",
          hint: "خط «Updated {relativeTime}» در سمت راست نوار وضعیت تأیید می‌کند که آخرین ذخیرهٔ شما فرود آمده است. اگر «just now» نشان می‌دهد، آماده‌اید.",
        },
        {
          label: "آزمایش end-to-end: ثبت‌نام یک مخاطب جدید و تأیید OTP آنها",
          hint: "با یک ایمیل ناشناس ثبت‌نام کنید، OTP درخواست کنید، آن را تأیید کنید. سپس Sent Emails را بررسی کنید — ایمیل welcome باید با وضعیت delivered آنجا باشد.",
        },
      ],
      warningTitle: "یک اتوماسیون فعال‌اما-خراب بدتر از یک اتوماسیون غیرفعال است",
      warningBody:
        "اگر سوییچ را روشن کنید و آن را با یک قالب ناسازگار یا مفقود رها کنید، هر تأیید موفق OTP سعی می‌کند اتوماسیون را شلیک کند و بی‌صدا شکست می‌خورد. کاربران ایمیل welcome خود را دریافت نخواهند کرد و شما نمی‌دانید — تا زمانی که شکایت کنند. همیشه پیکربندی (قالب + سازگاری) را پیش از خروج کامل کنید.",
    },
  },
};
