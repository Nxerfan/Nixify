/**
 * UX-B: Templates guide — Persian content dictionary.
 *
 * همان استاندارد محتوای انگلیسی، با ترجمهٔ روان و وفادار.
 * توکن‌های فنی (نوع اسلاگ، نام متغیرها مثل email/name، شمارهٔ نسخه‌های
 * v1/v2/v3، زمان‌های ISO، نام متدهای HTTP، جای‌نگهدارهای {{var}}،
 * توضیحات پاک‌سازی HTML، نشانی‌های ایمیل) به‌صورت رشتهٔ خام ذخیره می‌شوند و
 * در زمان رندر توسط <Ltr> به‌صورت چپ‌به‌راست نمایش داده می‌شوند.
 *
 * دقت محتوایی (بازرسی شده در برابر منبع):
 *   - صفحهٔ فهرست Templates سربرگی با دکمهٔ ghost «Back to Dashboard»،
 *     کاشی emerald آیکن FileText، عنوان h1 «Templates» و زیرعنوان
 *     «Reusable transactional email templates. Versioned, sanitized,
 *     preview-only.» دارد. دکمهٔ emerald «Create Template» با آیکن Plus
 *     در بالا-راست قرار دارد.
 *   - یک Input جست‌وجوی max-w-sm با آیکن Search در سمت چپ و شمارندهٔ
 *     «{n} templates» (مفرد/جمع) در سمت راست.
 *   - جدول شش ستون دارد: Name (کاشی emerald FileText + نام + توضیحات
 *     line-clamped)، Slug (مخفی md+ به‌صورت <code> مونو)، Version
 *     (Badge طرح‌دار emerald «v{n}»)، Variables (مخفی lg+ — در حال حاضر
 *     همیشه «—» با آیکن Variable)، Updated (مخفی md+، زمان نسبی)، Actions
 *     (راست‌چین DropdownMenu با Pencil «Edit» + rose Trash2 «Delete»).
 *   - کلیک روی ردیف به /dashboard/templates/{id} می‌رود.
 *   - حالت خالی: Card نقطه‌چین با دایرهٔ FileText + «No templates yet» +
 *     توضیحات + دکمهٔ emerald «Create Template».
 *   - دیالوگ ساخت (max-w-2xl، قابل‌اسکرول): نام + اسلاگ (خود-مشتق‌شده،
 *     مونو، قابل‌بازنویسی) + توضیحات (اختیاری) + subject (با کمک
 *     {{variable}}) + بدنهٔ HTML (مونو، ۸ ردیف، placeholder با
 *     {{first_name}}/{{code}}) + متن ساده (اختیاری، مونو). Cancel +
 *     submit emerald «Create». پس از موفقیت: toast + هدایت به
 *     /dashboard/templates/{id}.
 *   - سربرگ صفحهٔ ویرایشگر: دکمهٔ ghost «← Templates» + آیکن emerald
 *     FileText + نام قالب (truncate) + Badge طرح‌دار emerald «v{n}». سمت
 *     راست: دکمهٔ emerald «Save» (آیکن Save) + دکمهٔ طرح‌دار rose «Delete»
 *     (آیکن Trash2).
 *   - بدنهٔ ویرایشگر grid 2-ستونه (lg:grid-cols-2):
 *       ستون چپ — Tabs («Editor» و «Versions ({count})»). تب Editor یک Card
 *               با عنوان «Content» با Name، Slug (غیرقابل‌تغییر — Badge
 *               کهربایی «immutable» با آیکن Lock، disabled)، Description،
 *               Subject (با کمک {{variable}})، بدنهٔ HTML (مونو، ۱۰ ردیف،
 *               یادداشت پاک‌سازی)، متن ساده. وضعیت dirty با راهنمای
 *               «Unsaved changes» و دکمه‌های Revert + Save.
 *               تب Versions: Card «Version history» با هر نسخه به‌عنوان
 *               ردیف قابل‌کلیک: Badge v{n} + subject + «{relativeTime} ·
 *               {n} vars» (آیکن‌های Clock + Variable) + Badge «current» +
 *               Eye/EyeOff. ردیف انتخاب‌شده با Badge کهربایی «read-only
 *               historical version» و آیکن Lock باز می‌شود و subject و
 *               iframe پیش‌نمایش نسخهٔ تاریخی را نشان می‌دهد.
 *       ستون راست — Card «Live preview» با آیکن emerald Eye. پنل Required
 *               variables (شمارنده + Input به ازای هر {{var}})، دکمهٔ
 *               emerald «Preview» (رایگان)، دکمهٔ طرح‌دار emerald «Send
 *               test email» (ارسال واقعی). عنوان: «Preview is free.
 *               Sending delivers a real email.». هشدار کهربایی متغیرهای
 *               مفقود (با Badgeهای {{var}})، خروجی پیش‌نمایش (جعبهٔ subject
 *               + iframe sandbox=«allow-same-origin» srcDoc=html h-[420px]).
 *               Card فراداده: Template ID، Current version، Created، Updated.
 *   - دیالوگ ارسال تست (max-w-md): آیکن emerald Send + عنوان «Send test
 *     email» + توضیحات. Alert کهربایی هشدار «⚠️ This sends a REAL email and
 *     consumes your messaging quota. Preview is free — use it first.».
 *     Input ایمیل گیرنده. فهرست متغیرها (مشترک با پیش‌نمایش، مفقودهای
 *     هایلایت rose). Cancel + دکمهٔ مخرب «Send test email» (Loader2 چرخان
 *     هنگام ارسال). در 201: toast با message_id. در 400/402/403/404/409/502:
 *     toast مشخص به ازای هر کد.
 *
 *   - جای‌گذاری متغیر: {{var}} در subject + html + text در سمت سرور با
 *     مقادیری که فراخواننده ارائه می‌دهد جایگزین می‌شوند. متغیرهای مفقود
 *     400 با code = «missing_template_variables» + آرایهٔ `missing`
 *     برمی‌گردانند.
 *
 *   - نقاط انتهایی واقعی API (در stage فراخوانی نمی‌شوند — فقط برای آموزش):
 *       GET    /api/dashboard/templates?page=1&pageSize=20&search=...
 *       POST   /api/dashboard/templates              (ساخت)
 *       GET    /api/dashboard/templates/{id}        (جزئیات با current + versions)
 *       PATCH  /api/dashboard/templates/{id}        (فقط فیلدهای dirty؛ نسخه را در صورت تغییر محتوا افزایش می‌دهد)
 *       DELETE /api/dashboard/templates/{id}        (دائمی)
 *       POST   /api/dashboard/templates/preview     (پیش‌نمایش رایگان)
 *       POST   /api/dashboard/templates/{id}/test-send  (ارسال واقعی)
 *       GET    /api/dashboard/templates/{id}/versions/{n}  (جزئیات نسخهٔ تاریخی)
 *
 *   - احراز هویت / استحقاق:
 *       401 → router.push("/auth")
 *       403 (فهرست) → نمایش entitled=false («Not available» + دکمه «View Plans»)
 *       403 (ویرایشگر) → toast + router.push("/dashboard/templates")
 *
 * این دیکشنری همچنین شامل:
 *   - stage: رشته‌های انسانی صفحهٔ شبیه‌سازی‌شدهٔ TemplatesStage به فارسی.
 *   - creative: محتوای چهار بخش خلاقانه (کالبدشناسی قالب، زمین بازی
 *     جای‌گذاری متغیر، تاریخچهٔ نسخه، مدل ذهنی امن ارسال تست).
 */

import type { TemplatesGuideContent } from "./templates-types";

export const templatesFa: TemplatesGuideContent = {
  slug: "templates",
  category: "messaging",
  dashboardRoute: "/dashboard/templates",
  title: "قالب‌ها",
  description:
    "قالب‌های ایمیل تراکنشی قابل‌استفاده‌مجدد با HTML، متغیرها، نسخه‌بندی و پیش‌نمایش زندهٔ رایگان بسازید. ایمیل‌های تست واقعی را با سهمیهٔ پیام‌رسانی خود ارسال کنید.",
  routeKey: "templates",
  backHref: "/dashboard/templates",
  stepCount: 6,
  durationMin: 5,
  chapters: [
    {
      id: "intro",
      title: "قالب‌ها",
      steps: [
        {
          id: "templatesList",
          caption:
            "صفحهٔ فهرست Templates مرکز هر ایمیل تراکنشی قابل‌استفاده‌مجددی است که ارسال می‌کنید. سربرگ آیکن FileText، عنوان h1 «Templates» و زیرعنوانی دارد که یادآور می‌شود این‌ها نسخه‌بندی‌شده، پاک‌سازی‌شده و فقط پیش‌نمایش هستند. دکمهٔ emerald «Create Template» در بالا-راست دیالوگ ساخت را باز می‌کند. جدول زیر هر قالب را با نام، اسلاگ، نسخه و زمان آخرین به‌روزرسانی فهرست می‌کند.",
          duration: 7500,
          scene: "templatesList",
        },
        {
          id: "createTemplate",
          caption:
            "برای باز کردن دیالوگ ساخت (max-w-2xl، قابل‌اسکرول) روی «Create Template» کلیک کنید. نام را وارد کنید — اسلاگ خودبه‌خود از آن مشتق می‌شود (حروف کوچک، خط‌فاصله‌دار؛ با تایپ در فیلد اسلاگ بازنویسی کنید). یک subject (با جای‌نگهدارهای {{variable}})، بدنهٔ HTML (مونو، ۸ ردیف) و یک fallback متن سادهٔ اختیاری اضافه کنید. پس از ارسال، بک‌اند قالب را می‌سازد و شما به /dashboard/templates/{id} هدایت می‌شوید.",
          duration: 7500,
          scene: "createTemplate",
        },
        {
          id: "editorView",
          caption:
            "صفحهٔ ویرایشگر یک grid 2-ستونه است. ستون چپ Tabs ( «Editor» و «Versions ({count})») دارد. تب Editor یک Card با عنوان «Content» با Name، Slug (غیرقابل‌تغییر — Badge کهربایی «immutable»، disabled)، Description، Subject (با کمک {{variable}})، بدنهٔ HTML (مونو، ۱۰ ردیف، یادداشت پاک‌سازی) و متن ساده است. آزادانه ویرایش کنید؛ راهنمای وضعیت dirty «Unsaved changes» می‌خواند و دکمه‌های Revert + Save روشن می‌شوند.",
          duration: 7500,
          scene: "editorView",
        },
        {
          id: "variables",
          caption:
            "ستون راست Card «Live preview» است. پنل Required variables هر {{var}} که نسخهٔ کنونی ارجاع می‌دهد را فهرست می‌کند — هر کدام را پر کنید (یا خالی بگذارید تا بک‌اند بگوید کدام مفقود است). زیر آن دکمهٔ emerald «Preview» (رایگان) و دکمهٔ طرح‌دار emerald «Send test email» (ارسال واقعی) قرار دارد. عنوان می‌خواند «Preview is free. Sending delivers a real email.» — مرز بین این دو عمدی است.",
          duration: 7500,
          scene: "variables",
        },
        {
          id: "preview",
          caption:
            "برای رندر کردن قالب با مقادیری که وارد کرده‌اید روی «Preview» کلیک کنید. خروجی زیر ظاهر می‌شود: یک جعبهٔ کوچک subject و یک iframe سندباکس‌شده (sandbox=«allow-same-origin»، srcDoc=html، h-[420px]) که ایمیل رندرشده را نشان می‌دهد. اگر هر متغیر الزامی خالی باشد، بک‌اند 400 با code = «missing_template_variables» برمی‌گرداند و پنل یک هشدار کهربایی با Badgeهای {{var}} مفقود نشان می‌دهد.",
          duration: 7500,
          scene: "preview",
        },
        {
          id: "testSend",
          caption:
            "برای باز کردن دیالوگ روی «Send test email» کلیک کنید. هشدار کهربایی غیرقابل‌نادیده است: «⚠️ This sends a REAL email and consumes your messaging quota. Preview is free — use it first.». گیرنده را وارد کنید، متغیرها را تأیید کنید و روی دکمهٔ مخرب کلیک کنید. بک‌اند از طریق ارائه‌دهندهٔ فعال تحویل می‌دهد و 201 با message_id برمی‌گرداند — یا یک کد خطای مشخص را نشان می‌دهد (402 quota_exhausted، 502 delivery_failed، 400 missing_template_variables، 403 feature_not_available).",
          duration: 7500,
          scene: "testSend",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "فهرست Templates را باز کنید",
      body: "از نوار کناری داشبورد روی Templates کلیک کنید. سربرگ صفحه آیکن FileText، عنوان h1 «Templates» و زیرعنوان «Reusable transactional email templates. Versioned, sanitized, preview-only.» را نشان می‌دهد. دکمهٔ emerald «Create Template» در بالا-راست قرار دارد. زیر سربرگ یک Input جست‌وجو (max-w-sm) با شمارندهٔ «{n} templates» در سمت راست، سپس جدول: Name، Slug، Version، Variables، Updated، Actions قرار دارد.",
    },
    {
      title: "قالب جدید بسازید",
      body: "برای باز کردن دیالوگ ساخت روی «Create Template» کلیک کنید. نامی وارد کنید (مثلاً «Welcome email»)؛ اسلاگ خودبه‌خود از آن مشتق می‌شود (مثلاً «welcome-email») — با تایپ در فیلد اسلاگ بازنویسی کنید. یک subject مثل «Welcome to {{app_name}}, {{first_name}}!» اضافه کنید. بدنهٔ HTML خود را (مونو، ۸ ردیف) بچسبانید. اختیاری یک fallback متن ساده اضافه کنید. روی «Create» کلیک کنید — بک‌اند شناسهٔ قالب جدید را برمی‌گرداند و شما به /dashboard/templates/{id} هدایت می‌شوید.",
    },
    {
      title: "قالب را ویرایش کنید (تب Editor)",
      body: "در ویرایشگر، تب Editor یک Card با عنوان «Content» است. Name، Description، Subject، بدنهٔ HTML و متن ساده را آزادانه ویرایش کنید. فیلد Slug غیرقابل‌تغییر است — یک Badge کهربایی «immutable» با آیکن Lock دارد و disabled است (اسلاگ شناسهٔ API شماست؛ تغییر نام آن فراخوان‌های بالادست را بی‌صدا می‌شکند). راهنمای وضعیت dirty «Unsaved changes» می‌خواند؛ دکمهٔ Revert (RotateCcw) آخرین حالت ذخیره‌شده را بازیابی می‌کند و دکمهٔ emerald Save ویرایش‌های شما را ذخیره می‌کند.",
    },
    {
      title: "تاریخچهٔ نسخه را بررسی کنید (تب Versions)",
      body: "روی تب «Versions ({count})» کلیک کنید تا هر نسخهٔ ذخیره‌شده را ببینید. هر ردیف یک Badge v{n}، subject، «{relativeTime} · {n} vars» با آیکن‌های Clock + Variable و یک Badge «current» روی نسخهٔ زنده نشان می‌دهد. روی یک ردیف کلیک کنید تا یک پنل فقط‌خواندنی با Badge کهربایی «read-only historical version» (آیکن Lock)، جعبهٔ subject و یک iframe پیش‌نمایش از HTML آن نسخه باز شود. نسخه‌های تاریخی قابل ویرایش نیستند — فقط نسخهٔ کنونی.",
    },
    {
      title: "با متغیرها پیش‌نمایش کنید",
      body: "به تب Editor برگردید. Card «Live preview» در ستون راست هر متغیر الزامی که نسخهٔ کنونی ارجاع می‌دهد را فهرست می‌کند — هر Input را پر کنید. روی دکمهٔ emerald «Preview» (آیکن Eye) کلیک کنید. بک‌اند با متغیرهای شما به /api/dashboard/templates/preview می‌زند؛ پاسخ به‌صورت یک جعبهٔ subject + iframe سندباکس‌شده زیر دکمه رندر می‌شود. این فراخوانی رایگان است — هیچ سهمیه‌ای مصرف نمی‌کند و هیچ ایمیلی ارسال نمی‌کند.",
    },
    {
      title: "ایمیل تست واقعی ارسال کنید",
      body: "وقتی پیش‌نمایش درست به‌نظر می‌رسد، روی دکمهٔ طرح‌دار emerald «Send test email» (آیکن Send) کلیک کنید. دیالوگ با یک هشدار کهربایی باز می‌شود: «⚠️ This sends a REAL email and consumes your messaging quota. Preview is free — use it first.». آدرس گیرنده را وارد کنید، تأیید کنید متغیرها پر شده‌اند (مفقودهای هایلایت rose می‌شوند) و روی دکمهٔ مخرب «Send test email» کلیک کنید. در 201، یک toast شناسهٔ message_id را نشان می‌دهد. صندوق گیرنده (و Sent Emails) را بررسی کنید — یک پیام واقعی تحویل داده شده است.",
    },
  ],
  whyWhen: [
    {
      title: "کی قالب بسازیم",
      body: "هر بار که قرار است همان بدنهٔ ایمیل را بیش از یک بار ارسال کنید — ایمیل خوش‌آمد، ایمیل کد OTP، ایمیل بازنشانی رمز عبور، رسید — آن را قالب کنید. قالب‌ها نسخه‌بندی‌شده‌اند (هر ویرایش محتوا نسخه را افزایش می‌دهد و نسخهٔ قبلی فقط‌خواندنی حفظ می‌شود)، پاک‌سازی‌شده (HTML از طریق یک پاک‌کننده که تگ‌ها/ویژگی‌های خطرناک را حذف می‌کند عبور می‌کند) و به‌طور پیش‌فرض فقط پیش‌نمایش (هیچ سهمیه‌ای تا زمانی که صریح ارسال نکنید مصرف نمی‌شود). یک‌بار ساختن آن‌ها یعنی داشبورد، اتوماسیون‌ها و API همگی به همان منبع حقیقت ارجاع می‌دهند.",
    },
    {
      title: "چرا اسلاگ غیرقابل‌تغییر است",
      body: "اسلاگ شناسهٔ API شماست — کد شما (یا پیکربندی اتوماسیون) با اسلاگ به قالب‌ها ارجاع می‌دهد، نه با ID. تغییر نام اسلاگ در حین کار، هر فراخوان بالادست را بی‌صدا می‌شکند. بنابراین وقتی قالبی ساخته شد، اسلاگ قفل می‌شود: فیلد Slug disabled است، یک Badge کهربایی «immutable» با آیکن Lock دارد و PATCH آن را تغییر نمی‌دهد. اگر به اسلاگ متفاوتی نیاز دارید، قالب را حذف و دوباره بسازید (یا اسلاگ اصلی را بپذیرید).",
    },
    {
      title: "چرا پیش‌نمایش رایگان اما ارسال تست سهمیه مصرف می‌کند",
      body: "پیش‌نمایش با متغیرهای شما به /api/dashboard/templates/preview می‌زند؛ بک‌اند قالب را به HTML+text رندر می‌کند و برمی‌گرداند — اما هرگز به ارائه‌دهنده نمی‌سپارد. هیچ پیامی ارسال نمی‌شود، هیچ سهمیه‌ای مصرف نمی‌شود، هیچ ردیف sent_emails نوشته نمی‌شود. ارسال تست با آدرس گیرنده به /api/dashboard/templates/{id}/test-send می‌زند؛ بک‌اند یکسان رندر می‌کند، سپس از طریق ارائه‌دهندهٔ فعال (SMTP/Postmark/…) ارسال می‌کند. یک ایمیل واقعی در صندوق گیرنده فرود می‌آید، یک ردیف sent_emails نوشته می‌شود و یک واحد از سهمیهٔ MESSAGING_EMAILS شما مصرف می‌شود. به همین دلیل هشدار کهربایی دیالوگ می‌خواند «⚠️ This sends a REAL email and consumes your messaging quota. Preview is free — use it first.».",
    },
  ],
  mistakes: [
    {
      title: "ویرایش قالب و فراموش‌کردن Save",
      body: "تب Editor به‌صورت خودکار ذخیره نمی‌کند (برخلاف صفحهٔ Automations). هر ویرایش محلی است تا زمانی که روی دکمهٔ emerald «Save» کلیک کنید. راهنمای وضعیت dirty در پایین Card بین «All changes saved.» و «Unsaved changes» تغییر می‌کند — به این خط توجه کنید. اگر با تغییرات ذخیره‌نشده از صفحه بروید، از دست می‌روند (صفحه هشدار نمی‌دهد). روی «Revert» (RotateCcw) کلیک کنید تا دور بریزید و آخرین حالت ذخیره‌شده را بارگذاری کنید.",
    },
    {
      title: "کلیک روی Send test email قبل از Preview",
      body: "دیالوگ صریح هشدار می‌دهد «Preview is free — use it first.». اگر پیش‌نمایش را رها کنید و با متغیرهای مفقود روی Send test email کلیک کنید، بک‌اند 400 با code = «missing_template_variables» برمی‌گرداند — ارسال تست شما رد می‌شود، هیچ ایمیلی ارسال نمی‌شود، اما یک رفت‌وبرگشت را هدر داده‌اید. بدتر: اگر متغیرها همگی پر شده باشند اما رندر خراب باشد (تایپو HTML، نام {{var}} اشتباه)، یک ایمیل خراب را به یک صندوق واقعی تحویل می‌دهید و سهمیه مصرف می‌کنید. همیشه اول Preview.",
    },
    {
      title: "انتظار ستون Variables تعداد نشان دهد",
      body: "ستون «Variables» در صفحهٔ فهرست در حال حاضر همیشه «—» با آیکن Variable نشان می‌دهد — یک placeholder است. فهرست واقعی متغیرها (نام‌های {{var}} که نسخهٔ کنونی ارجاع می‌دهد) فقط در Card «Live preview» ویرایشگر تحت «Required variables» نمایش داده می‌شود. اگر نیاز دارید بدانید کدام قالب‌ها از {{email}} یا {{code}} استفاده می‌کنند، ویرایشگر هر قالب را باز کنید — هیچ فیلتر متغیر در سطح فهرست امروز وجود ندارد.",
    },
    {
      title: "تلاش برای ویرایش نسخهٔ تاریخی",
      body: "برای باز کردن پنل فقط‌خواندنی روی یک ردیف در تب Versions کلیک کنید. پنل یک Badge کهربایی «read-only historical version» با آیکن Lock و یادداشت «Historical versions cannot be edited.» دارد. نمی‌توانید یک نسخهٔ قبلی را بازگردانید یا تغییر دهید — فقط نسخهٔ کنونی قابل ویرایش است. اگر به یک subject قدیمی نیاز دارید، آن را از پنل فقط‌خواندنی کپی کنید و در تب Editor بچسبانید، سپس Save کنید (که یک نسخهٔ جدید می‌سازد که محتوای قدیمی را بازتاب می‌دهد).",
    },
    {
      title: "هاردکد کردن مقادیر گیرنده در HTML",
      body: "قالب‌ها قابل‌استفاده‌مجدد هستند — نام یا ایمیل گیرنده را در بدنهٔ HTML هاردکد نکنید. از جای‌نگهدارهای {{var}} ({{first_name}}، {{email}}، {{code}} و غیره) استفاده کنید و بگذارید فراخواننده به ازای هر ارسال مقادیر ارائه دهد. مقادیر هاردکدشده یعنی قالب فقط برای یک گیرنده کار می‌کند، که هدف را بی‌اثر می‌کند. جای‌گذاری متغیر در بک‌اند یک جای‌گذاری رشتهٔ ساده است — هیچ منطق شرطی، هیچ حلقه، هیچ partialی وجود ندارد. ساده نگه‌اش دارید.",
    },
  ],
  proTips: [
    {
      title: "اسلاگ را خودکار مشتق کنید، سپس دست‌نخورده بگذارید",
      body: "یک نام دوستانه ( «Welcome email») تایپ کنید و بگذارید فیلد اسلاگ خودکار مشتق شود ( «welcome-email»). تابع مشتق، حروف را کوچک، trim، غیر-[a-z0-9]+ را با خط‌فاصله جایگزین و خط‌فاصله‌های ابتدا/انتها را حذف می‌کند. وقتی قالب را ساختید، با اسلاگ به‌عنوان غیرقابل‌تغییر رفتار کنید — کلاینت‌های API و پیکربندی اتوماسیون شما با آن رشته ارجاع می‌دهند. اگر مجبور به تغییر اسلاگ هستید، حذف و دوباره‌سازی کنید (و هر فراخوان را به‌روز کنید).",
    },
    {
      title: "از تب Versions به‌عنوان تاریخچهٔ undo خود استفاده کنید",
      body: "هر Save که subject/html/text را تغییر می‌دهد، current_version را افزایش می‌دهد و یک ردیف غیرقابل‌تغییر جدید در تب Versions می‌نویسد. اگر آخرین ویرایش رندر را خراب می‌کند، تب Versions را باز کنید، روی نسخهٔ قبلی کلیک کنید و subject + iframe preview آن را بخوانید — نمی‌توانید آن را بازگردانید، اما می‌توانید HTML را در تب Editor کپی کنید و Save کنید تا حالت قبلی به‌عنوان یک نسخهٔ جدید بازسازی شود. این تب تور ایمنی شماست.",
    },
    {
      title: "سطح متغیر را کوچک و قابل‌پیش‌بینی نگه دارید",
      body: "هرچه جای‌نگهدارهای {{var}} در یک قالب کمتر باشد، جاهای کمتری که فراخواننده می‌تواند یکی را فراموش کند وجود دارد. قالب‌ها را حول ۲ تا ۴ متغیر نهایتی طراحی کنید — معمولاً {{email}}، {{name}} (یا {{first_name}}) و یک مقدار دامنه ({{code}}، {{reset_link}}، {{order_id}}). اگر خودتان را در حال اضافه‌کردن متغیر ششم یافتید، قالب را split کنید یا محتوای پویا را در HTML بدنه ببرید و نتیجهٔ کمی کمتر شخصی‌سازی‌شده را بپذیرید.",
    },
    {
      title: "پیش‌نمایش را به‌عنوان محیط staging در نظر بگیرید",
      body: "قبل از هر Send test email، Preview را با مقادیر واقعی (یک ایمیل واقعی‌نما، یک نام موجه، یک OTP واقعی) اجرا کنید. iframe دقیقاً همان چیزی را نشان می‌دهد که گیرنده خواهد دید — چیدمان‌های خراب، تگ‌های بدون استایل، جای‌نگهدارهای escapeشده (یک {{first_name}} تحت‌اللفظی در خروجی یعنی نام متغیر را اشتباه نوشته‌اید). Preview رایگان و نامحدود است — دلیلی برای رها کردنش وجود ندارد.",
    },
  ],
  troubleshooting: [
    {
      title: "صفحهٔ فهرست نشان می‌دهد «Templates are not available on your current account»",
      body: "GET با 403 برگشت — طرح شما شامل استحقاق MESSAGING_EMAILS نیست. صفحهٔ فهرست یک آیکن FileText در دایره‌ای مات در مرکز، عنوان «Templates are not available on your current account»، توضیحی که می‌گوید پیام‌رسانی تراکنشی بخشی از یک feature pack است، و یک دکمهٔ «View Plans» که به /pricing لینک می‌کند رندر می‌کند. طرح را ارتقا دهید و refresh کنید — قالب‌های موجود شما حفظ می‌شوند.",
    },
    {
      title: "دیالوگ ساخت می‌گوید «Failed to create template»",
      body: "POST با non-2xx برگشت. شایع‌ترین علل: 400 (validation_failed — name/slug/subject/html خالی یا نامعتبر؛ اسلاگ کاراکترهای بد دارد؛ subject > 200 کاراکتر)، 409 (قالبی با آن اسلاگ از قبل وجود دارد — اسلاگ را تغییر دهید)، 403 (بدون استحقاق). toast پیام خطا از بدنهٔ پاسخ را نشان می‌دهد؛ دیالوگ باز می‌ماند تا بتوانید اصلاح و دوباره امتحان کنید.",
    },
    {
      title: "پیش‌نمایش هشدار کهربایی «Missing variables» نشان می‌دهد",
      body: "شما با یک یا چند متغیر الزامی خالی روی Preview کلیک کردید. بک‌اند 400 با code = «missing_template_variables» و آرایهٔ `missing` برمی‌گرداند. پنل یک هشدار کهربایی با آیکن AlertCircle، عنوان «Missing variables»، توضیح «Fill in values for the following before previewing:» و Badgeهای {{var}} کهربایی به ازای هر متغیر مفقود رندر می‌کند. آن‌ها را پر کنید و دوباره روی Preview کلیک کنید — هیچ سهمیه‌ای مصرف نشده است.",
    },
    {
      title: "Send test email برمی‌گرداند «Quota exceeded»",
      body: "POST با 402 و code = «quota_exhausted» (یا «rate_limited») برگشت. سهمیهٔ MESSAGING_EMAILS شما تمام شده (یا به محدودیت نرخ هر دقیقه رسیده‌اید). toast پیام را نشان می‌دهد. سهمیهٔ طرح خود را در /pricing یا ویجت سهمیهٔ داشبورد بررسی کنید؛ برای پنجرهٔ بازنشانی بعدی صبر کنید یا ارتقا دهید. دیالوگ باز می‌ماند؛ هیچ ایمیلی ارسال نشده است.",
    },
    {
      title: "Send test email برمی‌گرداند «delivery_failed» (502)",
      body: "ارائه‌دهنده ایمیل را رد کرد. پاسخ 502 code = «delivery_failed» و احتمالاً error_code = «configuration_error» (مشکل پیکربندی SMTP) دارد. تنظیمات Branding/DNS (SPF/DKIM/DMARC) را بررسی کنید، آدرس گیرنده را تأیید کنید و سلامت ارائه‌دهندهٔ فعال را تأیید کنید. توضیح toast زمانی که بک‌اند خطای پیکربندی را علامت‌گذاری کند «(SMTP config issue)» را اضافه می‌کند. دیالوگ باز می‌ماند؛ هیچ ایمیلی تحویل داده نشده اما سهمیه ممکن است مصرف شده باشد (بستگی به رفتار ارائه‌دهنده دارد).",
    },
    {
      title: "iframe پیش‌نمایش ویرایشگر خالی است",
      body: "iframe از sandbox=«allow-same-origin» (بدون allow-scripts) استفاده می‌کند — HTML را رندر می‌کند اما JS اجرا نمی‌کند. اگر HTML قالب شما برای رندر محتوا به JavaScript تکیه می‌کند (مثلاً یک <script> که OTP را تزریق می‌کند)، در پیش‌نمایش و در صندوق گیرنده خالی خواهد بود (اکثر ارائه‌دهندگان <script> را به هر حال حذف می‌کنند). قالب خود را HTML خودکفا با فقط جای‌نگهدارهای {{var}} بسازید — بدون JS، بدون منابع خارجی، بدون iframe درون iframe.",
    },
  ],
  checklist: [
    { label: "فهرست Templates را باز کنید (Dashboard → Templates)" },
    { label: "روی «Create Template» کلیک کنید، name + subject + HTML body را پر کنید" },
    { label: "اسلاگ خود-مشتق‌شده را تأیید کنید (یا بازنویسی) و Create بزنید" },
    { label: "در ویرایشگر، Required variables را در پنل Live preview پر کنید" },
    { label: "روی emerald «Preview» کلیک کنید و خروجی رندرشده را بررسی کنید (رایگان)" },
    { label: "فقط آن‌گاه روی «Send test email» کلیک کنید و toast 201 را تأیید کنید" },
  ],
  whatNext:
    "وقتی قالب شما در Preview درست رندر می‌شود و یک ایمیل تست واقعی تحویل داده‌اید، آن را به تولید وصل کنید: با اسلاگ از کلاینت API خود به آن ارجاع دهید (POST /api/v1/messages/send با template_slug + variables)، یا آن را به اتوماسیون Welcome Email در /dashboard/automations متصل کنید. هر ارسال در /dashboard/emails با وضعیت تحویل ثبت خواهد شد — اگر صندوق گیرنده bounce کند یا شکایت کند، مخاطب به‌طور خودکار suppress می‌شود و آن را در /dashboard/suppressions خواهید دید.",
  related: [
    {
      label: "Templates را در داشبورد باز کنید",
      href: "/dashboard/templates",
    },
    {
      label: "اتوماسیون Welcome Email را وصل کنید",
      href: "/dashboard/automations",
    },
    {
      label: "ایمیل‌های ارسال‌شده را ببینید (لاگ تحویل)",
      href: "/dashboard/emails",
    },
  ],

  /* ─── Stage copy (simulated Templates page, Persian) ──────────────────── */
  stage: {
    dir: "rtl",
    locale: "fa",

    listHeader: {
      title: "قالب‌ها",
      backToDashboard: "بازگشت به داشبورد",
      subtitle:
        "قالب‌های ایمیل تراکنشی قابل‌استفاده‌مجدد. نسخه‌بندی‌شده، پاک‌سازی‌شده، فقط پیش‌نمایش.",
      create: "ساخت قالب",
    },

    search: {
      placeholder: "جست‌وجوی قالب‌ها…",
      count: (n) => `${n} قالب`,
    },

    table: {
      name: "نام",
      slug: "اسلاگ",
      version: "نسخه",
      variables: "متغیرها",
      updated: "به‌روز شده",
      actions: "اقدام‌ها",
      actionsEdit: "ویرایش",
      actionsDelete: "حذف",
      empty: "هنوز قالبی وجود ندارد",
      emptyDescription:
        "یک قالب ایمیل تراکنشی قابل‌استفاده‌مجدد با محتوای HTML نسخه‌بندی‌شده و پاک‌سازی‌شده بسازید.",
      emptyCreate: "ساخت قالب",
      notAvailable: "قالب‌ها در حساب فعلی شما در دسترس نیستند",
      notAvailableDescription:
        "پیام‌رسانی تراکنشی بخشی از feature pack پیام‌رسانی است.",
      notAvailableCta: "مشاهده طرح‌ها",
      pageOf: (page, total) => `صفحهٔ ${page} از ${total}`,
      prev: "قبلی",
      next: "بعدی",
    },

    createDialog: {
      title: "ساخت قالب",
      description:
        "قالب‌ها نسخه‌بندی‌شده‌اند. هر ویرایش محتوا یک نسخهٔ غیرقابل‌تغییر جدید می‌سازد.",
      nameLabel: "نام",
      slugLabel: "اسلاگ",
      slugHelp:
        "حروف کوچک، خط‌فاصله‌دار. به‌عنوان شناسهٔ API استفاده می‌شود — پس از ساخت، اسلاگ غیرقابل‌تغییر است.",
      descriptionOptional: "توضیحات (اختیاری)",
      subjectLabel: "موضوع",
      subjectHelp: "از جای‌نگهدارهای {{variable}} استفاده کنید — در زمان ارسال جای‌گذاری می‌شوند.",
      htmlLabel: "بدنهٔ HTML",
      textLabel: "متن ساده (اختیاری)",
      cancel: "لغو",
      submit: "ساخت",
      creating: "در حال ساخت…",
    },

    editorHeader: {
      backToTemplates: "قالب‌ها",
      save: "ذخیره",
      saving: "در حال ذخیره…",
      delete: "حذف",
    },

    editorTabs: {
      editor: "ویرایشگر",
      versions: (count) => `نسخه‌ها (${count})`,
    },

    editorForm: {
      contentTitle: "محتوا",
      nameLabel: "نام",
      slugLabel: "اسلاگ",
      immutableBadge: "غیرقابل‌تغییر",
      slugFixed: "اسلاگ شناسهٔ API شماست و پس از ساخت قابل تغییر نیست.",
      descriptionLabel: "توضیحات",
      subjectLabel: "موضوع",
      subjectHelp: "جای‌نگهدارهای {{variable}} در زمان ارسال جای‌گذاری می‌شوند.",
      htmlLabel: "بدنهٔ HTML",
      htmlHelp:
        "HTML هنگام ذخیره پاک‌سازی می‌شود. اسکریپت‌ها، رویدادها و تگ‌های خطرناک حذف می‌شوند.",
      textLabel: "متن ساده (اختیاری)",
      textPlaceholder: "fallback متن ساده برای کلاینت‌هایی که HTML رندر نمی‌کنند.",
      unsavedChanges: "تغییرات ذخیره‌نشده",
      allChangesSaved: "همهٔ تغییرات ذخیره شد.",
      revert: "بازگشت",
      save: "ذخیره",
      saving: "در حال ذخیره…",
    },

    versions: {
      historyTitle: "تاریخچهٔ نسخه",
      noVersions: "هنوز نسخه‌ای ثبت نشده است.",
      noSubject: "(بدون موضوع)",
      varsSuffix: (n) => `${n} متغیر`,
      current: "کنونی",
      readOnlyBadge: "نسخهٔ تاریخی فقط‌خواندنی",
      historicalCantEdit: "نسخه‌های تاریخی قابل ویرایش نیستند.",
      loadFailed: "بارگذاری نسخه ناموفق بود.",
    },

    preview: {
      title: "پیش‌نمایش زنده",
      requiredVars: "متغیرهای الزامی",
      requiredVarsCount: (n) => `${n} متغیر`,
      noVars: "این قالب متغیری ندارد. برای رندر روی Preview کلیک کنید.",
      placeholderValue: (name) => `مقدار برای ${name}`,
      previewButton: "پیش‌نمایش",
      rendering: "در حال رندر…",
      testSendButton: "ارسال ایمیل تست",
      caption: "پیش‌نمایش رایگان است. ارسال، یک ایمیل واقعی تحویل می‌دهد.",
      renderedSubject: "موضوع رندرشده",
      renderedHtml: "HTML رندرشده",
      fillInPrompt:
        "متغیرها را پر کنید و روی Preview کلیک کنید تا ایمیل رندر شود.",
      missingVarsTitle: "متغیرهای مفقود",
      missingVarsDesc: "برای موارد زیر قبل از پیش‌نمایش مقدار وارد کنید:",
      requiredHint: "— الزامی",
    },

    testSend: {
      title: "ارسال ایمیل تست",
      description:
        "این قالب را با نسخهٔ کنونی و متغیرهای پیش‌نمایشی که وارد کرده‌اید به یک صندوق واقعی تحویل دهید.",
      warning:
        "⚠️ این یک ایمیل واقعی می‌فرستد و سهمیهٔ پیام‌رسانی شما را مصرف می‌کند. پیش‌نمایش رایگان است — اول از آن استفاده کنید.",
      recipientLabel: "ایمیل گیرنده",
      recipientPlaceholder: "me@example.com",
      recipientHelp: "ایمیل به این نشانی تحویل داده خواهد شد.",
      varsLabel: (n) => `متغیرها (${n})`,
      missingSuffix: (n) => `${n} مفقود`,
      noVars: "این قالب متغیری ندارد.",
      cancel: "لغو",
      submit: "ارسال ایمیل تست",
      sending: "در حال ارسال…",
    },

    metadata: {
      templateId: "شناسهٔ قالب",
      currentVersion: "نسخهٔ کنونی",
      created: "ایجاد شده",
      updated: "به‌روز شده",
    },

    templates: [
      {
        id: 1,
        name: "ایمیل خوش‌آمد",
        slug: "welcome-email",
        description: "هنگامی که یک مخاطب OTP خود را تأیید کند ارسال می‌شود.",
        currentVersion: 3,
        variables: ["email", "name"],
        subject: "به Nixify خوش آمدید، {{name}}!",
        html:
          "<div style=\"font-family:system-ui\"><h1>خوش آمدید، {{name}}!</h1><p>ایمیل شما <strong>{{email}}</strong> تأیید شد.</p><p>— تیم Nixify</p></div>",
        text: "خوش آمدید، {{name}}! ایمیل شما {{email}} تأیید شد. — تیم Nixify",
        updatedAtRelative: "۲ ساعت پیش",
      },
      {
        id: 2,
        name: "تأیید OTP",
        slug: "otp-verification",
        description: "قالب تحویل رمز یک‌بارمصرف.",
        currentVersion: 5,
        variables: ["email", "code"],
        subject: "کد تأیید Nixify شما {{code}} است",
        html:
          "<div style=\"font-family:system-ui;text-align:center\"><h2>کد شما</h2><p style=\"font-size:32px;letter-spacing:6px;font-weight:bold\">{{code}}</p><p>طی ۱۰ دقیقه منقضی می‌شود. آن را به اشتراک نگذارید.</p></div>",
        text: "کد تأیید Nixify شما {{code}} است. طی ۱۰ دقیقه منقضی می‌شود.",
        updatedAtRelative: "دیروز",
      },
      {
        id: 3,
        name: "بازنشانی رمز عبور",
        slug: "password-reset",
        description: "تحویل لینک بازنشانی رمز عبور.",
        currentVersion: 2,
        variables: ["email", "reset_link"],
        subject: "رمز عبور Nixify خود را بازنشانی کنید",
        html:
          "<div style=\"font-family:system-ui\"><p>یک درخواست بازنشانی رمز عبور برای <strong>{{email}}</strong> دریافت کردیم.</p><p><a href=\"{{reset_link}}\">رمز عبور خود را بازنشانی کنید</a></p><p>لینک طی ۱ ساعت منقضی می‌شود.</p></div>",
        text: "رمز عبور خود را بازنشانی کنید: {{reset_link}} — طی ۱ ساعت منقضی می‌شود.",
        updatedAtRelative: "۳ روز پیش",
      },
    ],

    versionHistory: [
      {
        version: 3,
        subject: "به Nixify خوش آمدید، {{name}}!",
        variables: ["email", "name"],
        createdAtRelative: "۲ ساعت پیش",
        isCurrent: true,
      },
      {
        version: 2,
        subject: "به Nixify خوش آمدید!",
        variables: ["email"],
        createdAtRelative: "۵ روز پیش",
        isCurrent: false,
      },
      {
        version: 1,
        subject: "خوش آمدید",
        variables: ["email"],
        createdAtRelative: "۲ هفته پیش",
        isCurrent: false,
      },
    ],
  },

  /* ─── Creative-section copy (Persian) ─────────────────────────────────── */
  creative: {
    anatomy: {
      heading: "کالبدشناسی قالب",
      subheading:
        "هر قالب Nixify چهار بخش است: یک اسلاگ (شناسهٔ غیرقابل‌تغییر)، یک خط موضوع، یک بدنهٔ HTML و یک fallback متن ساده. متغیرها از هر سه عبور می‌کنند. دانستن اینکه هر بخش چه می‌کند، شایع‌ترین اشتباهات قالب را پیشگیری می‌کند.",
      annotationsTitle: "کالبدشناسی قالب ایمیل خوش‌آمد",
      annotations: [
        {
          field: "اسلاگ",
          label: "welcome-email",
          desc:
            "حروف کوچک، خط‌فاصله‌دار، پس از ساخت غیرقابل‌تغییر. به‌عنوان شناسهٔ API استفاده می‌شود — کد شما با اسلاگ به قالب‌ها ارجاع می‌دهد، نه با ID.",
          icon: "slug",
          value: "welcome-email",
        },
        {
          field: "موضوع",
          label: "Welcome to Nixify, {{name}}!",
          desc:
            "یک خط در پیش‌نمایش صندوق گیرنده نشان داده می‌شود. جای‌نگهدارهای {{variable}} در زمان ارسال جای‌گذاری می‌شوند. کوتاه و شخصی نگه‌اش دارید.",
          icon: "subject",
          value: "Welcome to Nixify, {{name}}!",
        },
        {
          field: "بدنهٔ HTML",
          label: "<h1>Welcome, {{name}}!</h1>…",
          desc:
            "HTML کامل در کلاینت ایمیل گیرنده رندر می‌شود. هنگام ذخیره پاک‌سازی می‌شود (اسکریپت‌ها، رویدادها و تگ‌های خطرناک حذف می‌شوند). از استایل‌های inline استفاده کنید — اکثر کلاینت‌ها بلوک‌های <style> را نادیده می‌گیرند.",
          icon: "html",
          value: "<h1>Welcome, {{name}}!</h1><p>Your email <strong>{{email}}</strong> is verified.</p>",
        },
        {
          field: "متن ساده",
          label: "Welcome, {{name}}! …",
          desc:
            "fallback اختیاری برای کلاینت‌هایی که HTML رندر نمی‌کنند (امروزه نادر، اما برخی فیلترهای spam ایمیل‌های فقط-HTML را جریمه می‌کنند). همان متغیرها، همان جای‌گذاری.",
          icon: "text",
          value: "Welcome, {{name}}! Your email {{email}} is verified.",
        },
        {
          field: "متغیرها",
          label: "{{email}}, {{name}}",
          desc:
            "در پنل Required variables ویرایشگر نمایش داده می‌شوند. فراخواننده به ازای هر ارسال مقادیر را ارائه می‌دهد؛ موارد مفقود 400 با code = missing_template_variables برمی‌گردانند.",
          icon: "variables",
          value: "{{email}}, {{name}}",
        },
        {
          field: "نسخه",
          label: "v3 (کنونی)",
          desc:
            "هر بار که subject/html/text تغییر می‌کند افزایش می‌یابد. نسخه‌های قبلی فقط‌خواندنی هستند — نمی‌توانید آن‌ها را بازگردانید، فقط می‌توانید از آن‌ها در یک نسخهٔ جدید کپی کنید.",
          icon: "version",
          value: "v3",
        },
      ],
    },

    variableSubstitution: {
      heading: "زمین بازی جای‌گذاری متغیر",
      subheading:
        "متغیرها یک جای‌گذاری رشتهٔ ساده‌اند — بدون شرطی، بدون حلقه، بدون escape. بک‌اند subject/html/text قالب را می‌گیرد، هر جای‌نگهدار {{var}} را پیدا می‌کند و با مقداری که فراخواننده ارائه داده جایگزین می‌کند. این قالب خوش‌آمد قبل و بعد از جای‌گذاری است.",
      beforeTitle: "قالب (خام)",
      afterTitle: "رندرشده (با مقادیر)",
      beforeLabel: "subject + html",
      afterLabel: "subject + html",
      variablesTitle: "مقادیر استفاده‌شده",
      variables: [
        { variable: "email", value: "sara@example.com", source: "builtin" },
        { variable: "name", value: "Sara", source: "per-send" },
      ],
      rawSubject: "Welcome to Nixify, {{name}}!",
      rawHtml:
        "<h1>Welcome, {{name}}!</h1><p>Your email <strong>{{email}}</strong> is verified.</p>",
      renderedSubject: "Welcome to Nixify, Sara!",
      renderedHtml:
        "<h1>Welcome, Sara!</h1><p>Your email <strong>sara@example.com</strong> is verified.</p>",
      caption:
        "توجه: توکن‌های تحت‌اللفظی {{name}} و {{email}} در خروجی رندرشده رفته‌اند — با مقادیر جایگزین شده‌اند. اگر فراخواننده name را خالی گذاشته بود، بک‌اند 400 با code = missing_template_variables برمی‌گرداند.",
    },

    versionHistory: {
      heading: "تاریخچهٔ نسخه، توضیح داده‌شده",
      subheading:
        "هر Save که subject، html یا text را تغییر می‌دهد، یک نسخهٔ غیرقابل‌تغییر جدید می‌سازد. تب Versions مسیر ممیزی شماست — هر نسخهٔ گذشته را می‌توانید بخوانید اما هرگز نمی‌توانید یکی را بازگردانید یا ویرایش کنید.",
      legendTitle: "راهنما",
      legendItems: [
        { label: "گام رابط کاربری — آنچه در ویرایشگر انجام می‌دهید", tone: "ui" },
        { label: "انتقال وضعیت — یک ردیف نسخه ساخته می‌شود", tone: "state" },
        { label: "اثر پایین‌دست — فراخوان‌ها نسخهٔ جدید را می‌بینند", tone: "downstream" },
      ],
      steps: [
        {
          badge: "۰۱",
          title: "خط موضوع را ویرایش کنید",
          body:
            "در تب Editor، subject را از «Welcome to Nixify!» به «Welcome to Nixify, {{name}}!» تغییر دهید. راهنمای وضعیت dirty «Unsaved changes» می‌خواند — Save فعال است، Revert فعال است.",
          tone: "ui",
        },
        {
          badge: "۰۲",
          title: "روی Save کلیک کنید",
          body:
            "PATCH /api/dashboard/templates/{id} فقط با فیلدهای تغییریافته ({ subject }) ارسال می‌شود. بک‌اند تغییر محتوا را تشخیص می‌دهد و یک ردیف نسخهٔ غیرقابل‌تغییر جدید می‌نویسد.",
          tone: "state",
          token: "PATCH /api/dashboard/templates/{id}",
        },
        {
          badge: "۰۳",
          title: "نسخه افزایش می‌یابد",
          body:
            "current_version از ۲ به ۳ می‌رود. پاسخ شامل version_created: true و شیء current جدید است. toast می‌خواند «New version saved.» با توضیح «Content changed — a new immutable version was saved.».",
          tone: "state",
          token: "version_created = true",
        },
        {
          badge: "۰۴",
          title: "نسخهٔ قدیمی حفظ می‌شود",
          body:
            "v2 (subject «Welcome to Nixify!») در تب Versions باقی می‌ماند، حالا به‌عنوان فقط‌خواندنی علامت‌گذاری شده. کلیک روی آن یک Badge کهربایی «read-only historical version» با آیکن Lock و iframe رندرشده را نشان می‌دهد.",
          tone: "state",
          token: "v2 (read-only)",
        },
        {
          badge: "۰۵",
          title: "فراخوان‌ها فوراً v3 را می‌بینند",
          body:
            "هر فراخوان API، شلیک اتوماسیون و Send test email که به قالب ارجاع می‌دهد حالا از v3 استفاده می‌کند. هیچ مرحلهٔ «انتشار» وجود ندارد — ذخیره‌کردن همان انتشار است. اتوماسیون‌های در حال اجرای شما نسخهٔ جدید را در شلیک بعدی برمی‌دارند.",
          tone: "downstream",
          token: "v3 (current)",
        },
        {
          badge: "۰۶",
          title: "بازگردانی-از-طریق-کپی (دستی)",
          body:
            "اگر v3 اشتباه است، v2 را در تب Versions باز کنید، subject + HTML آن را به تب Editor کپی کنید و Save بزنید. این v4 را می‌سازد — یک نسخهٔ جدید که محتوای v2 را بازتاب می‌دهد. نمی‌توانید v2 را درجا بازگردانید؛ فقط می‌توانید آن را بازسازی کنید.",
          tone: "ui",
          token: "v4 (recreated)",
        },
      ],
      footnote:
        "تغییرات فقط-فراداده (name، description) نسخه را افزایش نمی‌دهند. فقط تغییرات محتوا (subject، html، text) version_created را فعال می‌کنند. به همین دلیل ویرایش توضیحات یک toast ساده «Saved.» نشان می‌دهد، نه toast «New version saved.».",
    },

    safeTestSend: {
      heading: "مدل ذهنی امن ارسال تست",
      subheading:
        "Preview و Send test email خواهرند — شکل ورودی یکسان، خط لولهٔ رندر یکسان — اما در آخرین قدم از هم جدا می‌شوند. Preview قبل از ارائه‌دهنده متوقف می‌شود؛ Send test email پیام رندرشده را به ارائه‌دهنده می‌سپارد و یک ردیف sent_emails می‌نویسد. دانستن اینکه کجا از هم جدا می‌شوند، تفاوت بین یک حلقهٔ تکرار رایگان و یک قبض سهمیهٔ غافلگیرانه است.",
      previewCard: {
        badge: "رایگان",
        title: "پیش‌نمایش",
        body:
          "POST /api/dashboard/templates/preview با متغیرهای شما. بک‌اند قالب را به HTML+text رندر می‌کند و برمی‌گرداند — اما هرگز به ارائه‌دهنده نمی‌سپارد. هیچ پیامی ارسال نمی‌شود، هیچ سهمیه‌ای مصرف نمی‌شود، هیچ ردیف sent_emails نوشته نمی‌شود. نامحدود از آن استفاده کنید.",
        icon: "preview",
      },
      testSendCard: {
        badge: "ارسال واقعی",
        title: "ارسال ایمیل تست",
        body:
          "POST /api/dashboard/templates/{id}/test-send با گیرنده + متغیرها. بک‌اند یکسان رندر می‌کند، سپس از طریق ارائه‌دهندهٔ فعال (SMTP/Postmark/…) ارسال می‌کند. یک ایمیل واقعی در صندوق گیرنده فرود می‌آید، یک ردیف sent_emails نوشته می‌شود و یک واحد از سهمیهٔ MESSAGING_EMAILS شما مصرف می‌شود.",
        icon: "send",
      },
      comparison: [
        {
          dimension: "هزینهٔ سهمیه",
          previewValue: "۰ ایمیل (نامحدود)",
          testSendValue: "۱ ایمیل (MESSAGING_EMAILS)",
        },
        {
          dimension: "ارسال به ارائه‌دهنده",
          previewValue: "خیر — فقط رندر",
          testSendValue: "بله — SMTP/Postmark/…",
        },
        {
          dimension: "ردیف sent-emails",
          previewValue: "نوشته نمی‌شود",
          testSendValue: "نوشته می‌شود (با وضعیت تحویل)",
        },
        {
          dimension: "صندوق گیرنده",
          previewValue: "خالی",
          testSendValue: "پیام را دریافت می‌کند",
        },
        {
          dimension: "حالت شکست",
          previewValue: "400 missing_template_variables",
          testSendValue: "400 / 402 / 403 / 404 / 409 / 502",
        },
      ],
      warningTitle: "همیشه اول Preview. همیشه.",
      warningBody:
        "دیالوگ با هشدار کهربایی به دلیلی باز می‌شود — Send test email یک تحویل واقعی است. اگر Preview را رها کنید، ریسک ارسال یک ایمیل خراب (تایپو HTML، {{var}} escapeشده، چیدمان بدون استایل) به یک صندوق واقعی و مصرف سهمیه روی تلاش ناموفق را دارید. Preview رایگان، نامحدود و دقیقاً آنچه گیرنده خواهد دید را نشان می‌دهد. دلیلی برای رها کردنش وجود ندارد.",
    },
  },
};
