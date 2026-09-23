/**
 * UX-B: Branding guide — Persian content dictionary.
 *
 * همان استاندارد محتوای انگلیسی، با ترجمهٔ روان و وفادار.
 * توکن‌های فنی (کدهای رنگ hex، نام ویژگی‌های CSS، تگ‌های HTML،
 * شناسهٔ قالب‌ها، نام فونت‌ها، کلمات technical) به‌صورت رشتهٔ خام
 * ذخیره می‌شوند و در زمان رندر توسط <Ltr> به‌صورت چپ‌به‌راست نمایش
 * داده می‌شوند.
 *
 * دقت محتوایی (بازرسی شده در برابر منبع):
 *   - صفحهٔ Branding (که در سربرگ «Email Themes» نامیده می‌شود) شامل:
 *       کارت ۱: Template Gallery (ردیف افقی اسکرول‌شدنی قالب‌ها با
 *               نشان Pro/Free و دسته‌بندی و قفل «🔒 Upgrade to edit»
 *               برای قالب‌های Pro روی FREE plan).
 *       شبکهٔ دوستونی:
 *         چپ  = کارت Editor با نوار ابزار چسبان (عنوان Editor، زیرعنوان
 *               ویرایش، نشان پلن) و TabsList هفت‌زبانه (Branding، Header،
 *               OTP، BG، Footer، Typography، Components).
 *         راست = کارت Live Preview چسبان با انتخاب‌گرهای Mode/Language/
 *                Inbox client و دکمهٔ Test. iframeHTML واقعی رندر می‌کند.
 *   - زیر شبکه: نوار Save/Activate (ورودی Template Name، انتخاب Purpose،
 *     دکمه‌های Save Theme / Activate / Delete).
 *   - زیر آن: کارت Dynamic Theme Rules (ویژگی PRO+)، کارت Multi-Language
 *     Support، کارت Live Inbox Preview، کارت Saved Themes.
 *
 *   - در پلن FREE: فقط فیلد Template Name در ادیتور قابل ویرایش است؛
 *     Title/Subtitle در زبانهٔ Header و فیلدهای متنی زبانهٔ Footer
 *     قابل ویرایش‌اند؛ همه‌چیز دیگر (رنگ‌ها، فونت‌ها، کامپوننت‌ها،
 *     brand kit، قواعد فعال‌سازی) نیاز به PRO یا MAX دارد.
 *
 * این دیکشنری همچنین شامل:
 *   - stage: رشته‌های انسانی صفحهٔ شبیه‌سازی‌شدهٔ BrandingStage به فارسی.
 *   - creative: محتوای چهار بخش خلاقانه (قبل/بعد، کالبد، چه چیزی در
 *     ایمیل واقعی تغییر می‌کند، چک‌لیست یکپارچگی).
 */

import type { BrandingGuideContent } from "./branding-types";

export const brandingFa: BrandingGuideContent = {
  slug: "branding",
  category: "customization",
  dashboardRoute: "/dashboard/branding",
  title: "ظاهر و برند",
  description:
    "ظاهر ایمیل‌های خود را طراحی کنید — رنگ‌ها، سربرگ، پاورقی، تایپوگرافی و پیش‌نمایش زنده OTP.",
  routeKey: "branding",
  backHref: "/dashboard/branding",
  stepCount: 6,
  durationMin: 5,
  chapters: [
    {
      id: "intro",
      title: "ظاهر و برند",
      steps: [
        {
          id: "brandingOverview",
          caption:
            "صفحهٔ Branding (که در داشبورد «Email Themes» نامیده می‌شود) محل طراحی ظاهر ایمیل‌های شماست. در بالا یک Template Gallery، در پایین آن یک شبکهٔ دوستونی شامل ادیتور و پیش‌نمایش زنده، و در انتهای ادیتور یک نوار Save/Activate قرار دارد.",
          duration: 7000,
          scene: "brandingOverview",
        },
        {
          id: "gallery",
          caption:
            "از یک قالب شروع کنید. Template Gallery یک ردیف افقی اسکرول‌شدنی از قالب‌های حرفه‌ای است؛ هر کارت با نشان Pro یا Free و دسته‌بندی مشخص می‌شود. در پلن FREE این گالری فقط قابل مرور است — کلیک روی قالب Pro پیام «🔒 Upgrade to edit» را نشان می‌دهد.",
          duration: 7000,
          scene: "gallery",
        },
        {
          id: "colorsTab",
          caption:
            "زبانهٔ Branding هویت بصری شما را نگه می‌دارد: App Name، Logo URL، انتخاب‌گرهای رنگ Primary/Secondary/Accent، Website، Support Email و Default Font. برای استفادهٔ مجدد از این مقادیر در هر تم، «Save as Brand Kit» را بزنید و برای اعمال یک Brand Kit ذخیره‌شده روی تم فعلی از «Load Brand Kit» استفاده کنید.",
          duration: 7500,
          scene: "colorsTab",
        },
        {
          id: "headerFooterTabs",
          caption:
            "زبانهٔ Header عنوان، زیرعنوان، موقعیت لوگو، تراز و رنگ پس‌زمینهٔ سربرگ ایمیل را ویرایش می‌کند. زبانهٔ Footer نام شرکت، کپی‌رایت، ایمیل پشتیبانی، وب‌سایت و شبکه‌های اجتماعی را ویرایش می‌کند. در پلن FREE فقط فیلدهای متنی قابل ویرایش هستند — رنگ‌ها و چیدمان نیاز به PRO+ دارند.",
          duration: 7500,
          scene: "headerFooterTabs",
        },
        {
          id: "livePreview",
          caption:
            "کارت Live Preview در سمت راست HTML واقعی را از پیش‌نمایش API رندر می‌کند. حالت (Light/Dark/Auto)، زبان (انگلیسی، فارسی، عربی، ترکی، آلمانی) و کلاینت صندوق (Gmail Desktop 600px، Gmail Mobile 375px، Outlook، Apple Mail، Yahoo) را تغییر دهید تا ایمیل را در هر کدام ببینید. «Test» یک ایمیل پیش‌نمایش واقعی می‌فرستد.",
          duration: 8000,
          scene: "livePreview",
        },
        {
          id: "savedThemes",
          caption:
            "نام تم را تعیین کنید و یک Purpose (all/signup/login/reset/verification/2fa) انتخاب کنید، سپس «Save Theme» آن را در حساب شما ذخیره می‌کند. «Activate» (PRO+) یک تم ذخیره‌شده را به‌عنوان تم فعال برای آن Purpose تنظیم می‌کند. کارت Dynamic Theme Rules هر Purpose را به تم فعالش نگاشت می‌کند و جدول Saved Themes همهٔ تم‌های متعلق به شما را فهرست می‌کند.",
          duration: 8000,
          scene: "savedThemes",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "باز کردن ویرایشگر Email Themes",
      body: "از داشبورد به Branding بروید. عنوان صفحه «Email Themes» است. در بالا دکمهٔ بازگشت، دکمهٔ Refresh و سوییچ تم قرار دارد. اولین کارت Template Gallery است. زیر آن یک شبکهٔ دوستونی است: کارت Editor در سمت چپ و کارت Live Preview در سمت راست.",
    },
    {
      title: "انتخاب قالب از گالری",
      body: "Template Gallery یک ردیف افقی اسکرول‌شدنی از قالب‌هاست. هر کارت یک MiniPreview، نام قالب، نشان Pro یا Free و دسته‌بندی قالب را نشان می‌دهد. در پلن FREE گالری فقط قابل مرور است — کلیک روی قالب Pro پیام «🔒 Upgrade to edit» را نشان می‌دهد. در PRO یا MAX کلیک روی هر قالب config آن را در ادیتور بارگذاری می‌کند.",
    },
    {
      title: "ویرایش با ادیتور هفت‌زبانه",
      body: "کارت Editor یک نوار ابزار چسبان دارد که «Editor»، زیرعنوان ویرایش (ویرایش #N یا «New theme from template») و نشان پلن را نشان می‌دهد. زیر نوار ابزار یک TabsList هفت‌زبانه است: Branding، Header، OTP، BG، Footer، Typography، Components. هر زبانه بخشی از ThemeConfig را ویرایش می‌کند. در پلن FREE یک بنر کهربایی توضیح می‌دهد که فقط Template Name قابل ویرایش است؛ متن‌های Header و Footer در FREE قابل ویرایش می‌مانند.",
    },
    {
      title: "سفارشی‌سازی رنگ‌ها و Brand Kit",
      body: "در زبانهٔ Branding مقادیر App Name، Logo URL، انتخاب‌گرهای رنگ Primary/Secondary/Accent، Website، Support Email و Default Font را تنظیم کنید. برای ذخیرهٔ این مقادیر از «Save as Brand Kit» و برای اعمال آن روی تم فعلی از «Load Brand Kit» استفاده کنید. در پلن FREE این فیلدها قفل هستند — فقط Template Name در نوار ذخیره قابل ویرایش است.",
    },
    {
      title: "استفاده از پیش‌نمایش زنده برای اعتبارسنجی",
      body: "کارت Live Preview HTML واقعی را از پیش‌نمایش API رندر می‌کند. حالت (Light/Dark/Auto)، زبان (انگلیسی، فارسی، عربی، ترکی، آلمانی) و کلاینت صندوق (Gmail Desktop 600px، Gmail Mobile 375px، Outlook، Apple Mail، Yahoo) را تغییر دهید. برای ارسال یک ایمیل پیش‌نمایش واقعی به صندوق مدیریت خود روی «Test» کلیک کنید. پیش‌نمایش با ویرایش شما به‌روز می‌شود.",
    },
    {
      title: "ذخیره، فعال‌سازی و استفادهٔ مجدد از تم‌ها",
      body: "در پایین ادیتور، Template Name (همیشه قابل ویرایش) و Purpose (all/signup/login/reset/verification/2fa) را تنظیم کنید و سپس «Save Theme» را بزنید. برای فعال‌کردن یک تم ذخیره‌شده برای یک Purpose، «Activate» را بزنید (فقط PRO+). کارت Dynamic Theme Rules هر Purpose را به تم فعالش نگاشت می‌کند و جدول Saved Themes همهٔ تم‌های ذخیره‌شدهٔ متعلق به شما را فهرست می‌کند.",
    },
  ],
  whyWhen: [
    {
      title: "چه زمانی از Branding استفاده کنید",
      body: "هر زمان که می‌خواهید ایمیل‌های OTP، تراکنشی یا انبوهی که Nixify از طرف شما می‌فرستد با هویت محصول شما هم‌خوان باشند — رنگ‌ها، سربرگ، پاورقی، تایپوگرافی و سبک کارت OTP — از Branding استفاده کنید. Branding چیزی است که یک ایمیل از «Nixify» را شبیه ایمیلی از «برند شما» می‌کند.",
    },
    {
      title: "قالب در برابر تم ذخیره‌شده",
      body: "Template یک نقطهٔ شروع حرفه‌ای است که Nixify ارائه می‌دهد — Pro یا Free و دسته‌بندی‌شده. Saved Theme چیزی است که وقتی یک قالب را بارگذاری، سفارشی (یا دست‌نخورده) می‌کنید، نامی به آن می‌دهید و «Save Theme» را می‌زنید، ساخته می‌شود. جدول Saved Themes کتابخانهٔ شخصی شماست؛ قالب‌ها هرگز تغییر نمی‌کنند.",
    },
    {
      title: "Purpose و تم فعال",
      body: "هر تم ذخیره‌شده یک Purpose دارد — all، signup، login، reset، verification یا 2fa. کارت Dynamic Theme Rules هر Purpose را به تم فعال فعلی‌اش نگاشت می‌کند. وقتی Nixify یک OTP برای signup می‌فرستد، تم فعال برای purpose «signup» را پیدا کرده و با config آن تم رندر می‌کند. «all» purpose پیش‌فرضی است که وقتی هیچ purpose خاصی تطابق ندارد، استفاده می‌شود.",
    },
  ],
  mistakes: [
    {
      title: "انتظار ویرایش‌بودن گالری در FREE",
      body: "در پلن FREE، Template Gallery فقط قابل مرور است. کلیک روی قالب Pro پیام «🔒 Upgrade to edit» را نشان می‌دهد. حتی قالب‌های Free هم فقط در PRO یا MAX در ادیتور بارگذاری می‌شوند. در FREE تنها فیلد قابل ویرایش Template Name در نوار ذخیره است، به‌علاوهٔ Title/Subtitle در زبانهٔ Header و فیلدهای متنی زبانهٔ Footer.",
    },
    {
      title: "فراموش‌کردن Save قبل از Activate",
      body: "Activate روی یک تم ذخیره‌شده عمل می‌کند — به theme ID نیاز دارد. اگر قالبی را بارگذاری و سفارشی کرده‌اید اما هنوز «Save Theme» را نزده‌اید، Activate غیرفعال است یا toast «Save the theme first» را نشان می‌دهد. همیشه اول Save کنید، سپس Activate.",
    },
    {
      title: "ویرایش تم فعال Purpose اشتباه",
      body: "فعال‌کردن یک تم آن را برای Purpose آن فعال می‌کند. اگر تمی با Purpose «login» را فعال کنید، فقط OTPهای login از آن استفاده می‌کنند — signup، reset و verification از تم فعال خودشان استفاده خواهند کرد. اگر یک تم برای همه می‌خواهید، Purpose = all را تنظیم و آن را فعال کنید.",
    },
    {
      title: "اشتباه‌گرفتن Brand Kit با تم ذخیره‌شده",
      body: "Brand Kit یک رکورد واحد است که App Name، Logo URL، رنگ‌ها، Website، Support Email و Default Font شما را نگه می‌دارد. این یک Saved Theme نیست — یک نقطهٔ شروع قابل استفادهٔ مجدد است. «Load Brand Kit» مقادیر brand kit شما را در زبانهٔ Branding تم فعلی اعمال می‌کند؛ برای ذخیرهٔ نتیجه همچنان باید «Save Theme» را بزنید.",
    },
    {
      title: "فرض بر اینکه پیش‌نمایش همان ایمیل نهایی است",
      body: "Live Preview HTML واقعی را از طریق پیش‌نمایش API رندر می‌کند، اما ایمیل تحویل‌شده ممکن است بسته به کلاینت صندوق کمی متفاوت باشد (Gmail برخی CSSها را حذف می‌کند، Outlook quirks خاص خود را دارد). قبل از فعال‌سازی، از انتخاب‌گر Inbox client برای اعتبارسنجی در برابر هر کلاینت اصلی استفاده کنید و با «Test» یک پیش‌نمایش واقعی به صندوق مدیریت خود بفرستید.",
    },
  ],
  proTips: [
    {
      title: "از قالب شروع کنید، سپس Save as Brand Kit",
      body: "قالب‌ها یک نقطهٔ شروع معقول به شما می‌دهند. پس از بارگذاری، زبانهٔ Branding را با مقادیر واقعی App Name، Logo URL، رنگ‌ها، وب‌سایت و ایمیل پشتیبانی پر کنید، سپس «Save as Brand Kit» را بزنید. تم‌های آینده می‌توانند با «Load Brand Kit» این مقادیر را در یک کلیک اعمال کنند — نیازی به وارد کردن مجدد هر بار نیست.",
    },
    {
      title: "از انتخاب‌گر Inbox client برای گرفتن quirks جیمیل/اوت‌لوک استفاده کنید",
      body: "قبل از فعال‌سازی، پیش‌نمایش را بین Gmail Desktop (600px)، Gmail Mobile (375px)، Outlook، Apple Mail و Yahoo تغییر دهید. هر کلاینت CSS را متفاوت رندر می‌کند — چیزی که در Apple Mail عالی است ممکن است در Outlook بشکند. عنوان پهنای زیر iframe نشان می‌دهد کدام کلاینت را پیش‌نمایش می‌کنید.",
    },
    {
      title: "زبان فارسی/عربی تنظیم کنید و RTL را بررسی کنید",
      body: "Nixify از انگلیسی، فارسی، عربی، ترکی و آلمانی پشتیبانی می‌کند. فارسی و عربی RTL هستند — پیش‌نمایش یک برچسب «RTL» در عنوان نشان می‌دهد. همیشه تم خود را در این زبان‌ها پیش‌نمایش کنید تا مطمئن شوید سربرگ، پاورقی و کارت OTP در RTL درست رندر می‌شوند.",
    },
  ],
  troubleshooting: [
    {
      title: "پیش‌نمایش «Simplified» با بنر کهربایی نشان می‌دهد",
      body: "Live Preview وقتی پیش‌نمایش API یک fallback برگردانده است، برچسب کهربایی «Simplified» را نشان می‌دهد. علل: پلن شما شامل پیش‌نمایش نیست (403 entitlement)، نشست شما منقضی شده (401)، یا رندرر سرور خطا داده (500). برای 401 دوباره وارد شوید. برای 403، پیش‌نمایش به یک نسخهٔ ساده‌شدهٔ client-rendered برمی‌گردد — برای حذف محدودیت، پلن خود را ارتقا دهید. این پنل هرگز خالی نیست.",
    },
    {
      title: "دکمهٔ «Activate» غیرفعال است",
      body: "Activate روی یک تم ذخیره‌شده عمل می‌کند — به theme ID نیاز دارد. اگر قالبی را بارگذاری و سفارشی کرده‌اید اما ذخیره نکرده‌اید، Activate غیرفعال است و toast می‌گوید «Save the theme first». تم را ذخیره کنید، سپس Activate را بزنید. Activate همچنین به پلن‌های PRO+ محدود است — در FREE دکمه غیرفعال است.",
    },
    {
      title: "تم ذخیره‌شده برای ایمیل‌های من استفاده نمی‌شود",
      body: "هر ایمیل از تم فعال برای Purpose خود استفاده می‌کند. اگر ایمیل‌هایتان همچنان مانند پیش‌فرض هستند، کارت Dynamic Theme Rules را بررسی کنید — ردیف مطابق با Purpose (مثلاً signup) را پیدا کنید و مطمئن شوید تم ذخیره‌شده‌تان به‌عنوان Active Theme انتخاب شده و Status آن «active» (سبز زمردی) است، نه «draft» یا «none».",
    },
    {
      title: "toast «Brand kit save failed»",
      body: "ذخیرهٔ Brand Kit نیاز به PRO+ دارد و به /api/admin/brand-kit می‌نویسد. اگر «Brand kit save failed» را دیدید، شایع‌ترین علل عبارت‌اند از: روی FREE هستید (دکمه محدود است)، نشست شما منقضی شده (دوباره وارد شوید)، یا یکی از فیلدهای الزامی (App Name، رنگ‌ها) خالی است. تمام فیلدهای زبانهٔ Branding را پر کنید و دوباره امتحان کنید.",
    },
    {
      title: "امکان ویرایش تمی که در جدول می‌بینم نیست",
      body: "هر تم ذخیره‌شده یک پرچم canModify دارد که backend بر اساس مالکیت محاسبه می‌کند. تم‌های سیستم (userId = null) و تم‌های متعلق به کاربر دیگر یک نشان قفل «read-only» نشان می‌دهند. شما فقط می‌توانید تم‌های متعلق به خودتان را ویرایش کنید. اگر «read-only» می‌بینید یا دکمهٔ Edit غیرفعال است، به همین دلیل است — در عوض config آن را در یک تم جدید کپی کنید.",
    },
  ],
  checklist: [
    { label: "باز کردن ویرایشگر Email Themes (داشبورد → Branding)" },
    { label: "مرور Template Gallery و بارگذاری یک قالب" },
    { label: "خواندن ساختار ادیتور هفت‌زبانه (Branding، Header، OTP، BG، Footer، Typography، Components)" },
    { label: "پر کردن زبانهٔ Branding (App Name، رنگ‌ها، فونت) و Save as Brand Kit" },
    { label: "ویرایش زبانه‌های Header و Footer (فیلدهای متنی در FREE قابل ویرایش)" },
    { label: "استفاده از Live Preview با انتخاب‌گرهای Mode / Language / Inbox client" },
    { label: "ذخیرهٔ تم با نام و purpose، سپس Activate (PRO+)" },
    { label: "بررسی تم فعال در Dynamic Theme Rules" },
  ],
  whatNext:
    "وقتی تمی را ذخیره و فعال کردید، گام بعدی ارسال یک OTP واقعی از طریق Playground یا اپلیکیشن خودتان است تا تم فعال را در یک ایمیل تحویل‌شده ببینید. از آنجا، Templates (بدنه‌های ایمیل تراکنشی قابل استفادهٔ مجدد با متغیرها و نسخه‌بندی) و Broadcasts (ارسال انبوه که از تم فعال شما استفاده می‌کند) را کاوش کنید — هر دو با Branding ترکیب می‌شوند تا یک ایمیل کاملاً هم‌برند تحویل دهند.",
  related: [
    {
      label: "باز کردن Branding در داشبورد",
      href: "/dashboard/branding",
    },
    {
      label: "مرور قالب‌ها",
      href: "/dashboard/templates",
    },
    {
      label: "ارسال یک broadcast (از تم فعال استفاده می‌کند)",
      href: "/dashboard/broadcasts",
    },
  ],

  /* ─── Stage copy (simulated Email Themes editor, Persian) ──────────────── */
  stage: {
    dir: "rtl",
    locale: "fa",

    header: {
      title: "Email Themes",
      backToDashboard: "→ داشبورد",
      refresh: "تازه‌سازی",
    },

    gallery: {
      title: "Template Gallery",
      description: (n) =>
        `${n} قالب حرفه‌ای طراحی‌شده — روی هر کدام کلیک کنید تا در ادیتور بارگذاری شود.`,
      proBadge: "Pro",
      freeBadge: "Free",
      upgradeToEdit: "🔒 ارتقا برای ویرایش",
      clickHint: "برای بارگذاری در ادیتور کلیک کنید",
    },

    editor: {
      title: "Editor",
      editingName: (name) => `در حال ویرایش «${name}»`,
      newFromTemplate: "تم جدید از قالب",
      templatePrefix: "قالب:",
      planBadgeFree: "FREE",
      planBadgePro: "PRO",
      planBadgeMax: "MAX",
      freeBannerTitle: "🔒 پلن FREE — فقط Template Name قابل ویرایش است.",
      freeBannerSubtitle:
        "برای باز کردن کامل ادیتور (رنگ‌ها، فونت‌ها، کامپوننت‌ها، brand kit، قواعد فعال‌سازی) به PRO یا MAX ارتقا دهید.",
      tabs: {
        branding: "Branding",
        header: "Header",
        otp: "OTP",
        bg: "BG",
        footer: "Footer",
        typography: "Typography",
        components: "Components",
      },
      freeTabNotices: {
        branding:
          "🔒 برای سفارشی‌سازی برند بصری (رنگ‌ها، لوگو، نام شرکت) به PRO ارتقا دهید. می‌توانید متن زبانه‌های Header و Footer را ویرایش کنید.",
        header:
          "محتوا در پلن FREE قابل ویرایش است. عنوان و زیرعنوان زیر قابل ویرایش هستند. چیدمان و رنگ نیاز به PRO دارند.",
        footer:
          "متن در پلن FREE قابل ویرایش است. نام شرکت، کپی‌رایت و جزئیات تماس زیر قابل ویرایش هستند. استایل (رنگ‌ها) نیاز به PRO دارد.",
      },
    },

    brandingTab: {
      appName: "App Name",
      logoUrl: "Logo URL",
      primaryColor: "Primary Color",
      secondaryColor: "Secondary Color",
      accentColor: "Accent Color",
      website: "Website",
      supportEmail: "Support Email",
      defaultFont: "Default Font",
      saveAsBrandKit: "Save as Brand Kit",
      loadBrandKit: "Load Brand Kit",
      fontOptions: [
        { value: "Inter", label: "Inter" },
        { value: "Arial", label: "Arial" },
        { value: "Georgia", label: "Georgia" },
        { value: "Roboto", label: "Roboto" },
        { value: "ui-monospace, monospace", label: "Mono" },
        { value: "-apple-system", label: "-apple-system" },
      ],
    },

    headerTab: {
      title: "Title",
      subtitle: "Subtitle",
      logoPosition: "Logo Position",
      alignment: "Alignment",
      backgroundColor: "Background Color",
      textColor: "Text Color",
      positionLeft: "left",
      positionCenter: "center",
      positionRight: "right",
      contentEditableNote:
        "محتوا در پلن FREE قابل ویرایش است. عنوان و زیرعنوان زیر قابل ویرایش هستند. چیدمان و رنگ نیاز به PRO دارند.",
    },

    footerTab: {
      companyName: "Company Name",
      copyright: "Copyright",
      supportEmail: "Support Email",
      website: "Website",
      twitter: "Twitter",
      github: "GitHub",
      linkedin: "LinkedIn",
      textColor: "Text Color",
      contentEditableNote:
        "متن در پلن FREE قابل ویرایش است. نام شرکت، کپی‌رایت و جزئیات تماس زیر قابل ویرایش هستند. استایل (رنگ‌ها) نیاز به PRO دارد.",
    },

    preview: {
      title: "Live Preview",
      description: "HTML واقعی را از پیش‌نمایش API رندر می‌کند · با ویرایش به‌روز می‌شود",
      liveIndicator: "پیش‌نمایش زنده",
      simplified: "ساده‌شده",
      testButton: "Test",
      modeLabel: "Mode",
      languageLabel: "Language",
      inboxClientLabel: "Inbox client",
      modeOptions: [
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "auto", label: "Auto" },
      ],
      languageOptions: [
        { value: "en", label: "English" },
        { value: "fa", label: "Persian" },
        { value: "ar", label: "Arabic" },
        { value: "tr", label: "Turkish" },
        { value: "de", label: "German" },
      ],
      inboxClientOptions: [
        { value: "gmail-desktop", label: "Gmail Desktop", width: 600 },
        { value: "gmail-mobile", label: "Gmail Mobile", width: 375 },
        { value: "outlook", label: "Outlook", width: 600 },
        { value: "apple-mail", label: "Apple Mail", width: 375 },
        { value: "yahoo", label: "Yahoo Mail", width: 600 },
      ],
      widthCaption: (client, width) => `${client} · ${width}px پهنا`,
      rtlCaption: "RTL",
      loadingPreview: "در حال بارگذاری پیش‌نمایش…",
      previewCode: "482915",
      previewAppName: "Nixify",
    },

    saveBar: {
      templateName: "Template Name",
      purpose: "Purpose",
      saveTheme: "Save Theme",
      saving: "در حال ذخیره…",
      activate: "Activate",
      delete: "Delete",
      purposeOptions: [
        { value: "all", label: "all" },
        { value: "signup", label: "signup" },
        { value: "login", label: "login" },
        { value: "reset", label: "reset" },
        { value: "verification", label: "verification" },
        { value: "2fa", label: "2fa" },
      ],
    },

    rules: {
      title: "Dynamic Theme Rules",
      proPlusBadge: "PRO+",
      upgradeNotice: "قواعد پویای تم یک ویژگی PRO+ است.",
      purposeHeader: "Purpose",
      activeThemeHeader: "Active Theme",
      statusHeader: "Status",
      statusActive: "active",
      statusDraft: "draft",
      statusNone: "none",
      saveRules: "Save Rules",
    },

    multiLanguage: {
      title: "Multi-Language Support",
      rtlTag: "RTL",
      description:
        "تم‌ها در پنج زبان رندر می‌شوند. فارسی و عربی RTL هستند — برای تأیید چیدمان، پیش‌نمایش بگیرید.",
    },

    inboxPreview: {
      title: "Live Inbox Preview",
      description:
        "پیش‌نمایش در برابر کلاینت‌های اصلی صندوق — هر کدام CSS را متفاوت رندر می‌کند.",
    },

    savedThemes: {
      title: "Saved Themes",
      description: (n) =>
        `${n} تم ذخیره‌شده — یکی را در ادیتور بارگذاری کنید تا تغییر دهید. فقط تم‌های متعلق به خودتان قابل ویرایش هستند.`,
      emptyTitle: "هنوز تم ذخیره‌شده‌ای وجود ندارد.",
      emptyDescription: "یک تم بالا ذخیره کنید تا قواعد فعال شود.",
      nameHeader: "Name",
      templateHeader: "Template",
      purposeHeader: "Purpose",
      statusHeader: "Status",
      actionsHeader: "Actions",
      systemBadge: "system",
      readOnlyBadge: "read-only",
      proBadge: "Pro",
      activeBadge: "active",
      inactiveBadge: "inactive",
      edit: "Edit",
      activate: "Activate",
      delete: "Delete",
    },

    templates: [
      { id: "default-emerald", name: "Default Emerald", category: "OTP", isPro: false },
      { id: "minimal-mono", name: "Minimal Mono", category: "OTP", isPro: true },
      { id: "rounded-slate", name: "Rounded Slate", category: "Verification", isPro: true },
      { id: "compact-amber", name: "Compact Amber", category: "2FA", isPro: false },
      { id: "warm-sand", name: "Warm Sand", category: "Login", isPro: true },
    ],

    savedThemesList: [
      {
        id: 1,
        name: "Default Emerald",
        templateId: "default-emerald",
        purpose: "all",
        isActive: true,
        isPro: false,
        isSystem: true,
      },
      {
        id: 2,
        name: "Signup Pro",
        templateId: "rounded-slate",
        purpose: "signup",
        isActive: true,
        isPro: true,
        isSystem: false,
      },
      {
        id: 3,
        name: "Reset Minimal",
        templateId: "minimal-mono",
        purpose: "reset",
        isActive: false,
        isPro: true,
        isSystem: false,
      },
    ],
  },

  /* ─── Creative-section copy (Persian) ─────────────────────────────────── */
  creative: {
    beforeAfter: {
      heading: "قبل و بعد از Branding",
      subheading:
        "تم پیش‌فرض در سمت چپ. یک تم سفارشی‌شده PRO+ در سمت راست. هر دو HTML واقعی را از طریق پیش‌نمایش API رندر می‌کنند — فقط فیلدهای زبانهٔ Branding متفاوت هستند.",
      before: {
        badge: "قبل",
        title: "Default Emerald (سیستم)",
        body: "تم پیش‌فرض سیستم همراه Nixify می‌آید. App Name برابر «Nixify»، رنگ اصلی زمردی و کارت OTP از سبک box با شعاع و سایهٔ پیش‌فرض استفاده می‌کند.",
        points: [
          "appName: Nixify",
          "primaryColor: #059669",
          "otpCard.style: box",
          "footer.copyright: © 2026 Nixify",
        ],
      },
      after: {
        badge: "بعد",
        title: "Acme Pro — تم برند شده",
        body: "همان قالب، از طریق زبانهٔ Branding سفارشی شده و به‌عنوان یک تم جدید ذخیره شده است. App Name حالا «Acme»، رنگ اصلی ایندیگوی برند مشتری و کارت OTP از سبک pill با فاصلهٔ حروف بزرگ‌تر استفاده می‌کند.",
        points: [
          "appName: Acme",
          "primaryColor: #4f46e5",
          "otpCard.style: pill",
          "footer.copyright: © 2026 Acme Inc.",
        ],
      },
      arrowLabel: "اعمال زبانهٔ Branding",
    },

    anatomy: {
      heading: "کالبدشناسی برند",
      subheading:
        "یک تم ذخیره‌شده یک شیء مسطح ThemeConfig با پنج بخش به‌علاوهٔ سه توکن رنگ سطح‌بالاست. روی هر فیلد نگه دارید تا ببینید کجا قرار دارد و چه چیزی را کنترل می‌کند.",
      annotationsTitle: "ThemeConfig",
      selectHint: "برای جزئیات، روی یک فیلد کلیک کنید",
      sections: [
        {
          title: "رنگ‌ها",
          fields: [
            {
              field: "primaryColor",
              label: "رنگ اصلی",
              desc: "رنگ hex سطح‌بالا. برای پس‌زمینهٔ سربرگ، متن کد OTP و دکمه‌های اصلی استفاده می‌شود.",
              icon: "primary",
              value: "#059669",
            },
            {
              field: "secondaryColor",
              label: "رنگ ثانویه",
              desc: "رنگ hex سطح‌بالا. برای متن پاورقی و لهجه‌های ثانویه استفاده می‌شود.",
              icon: "secondary",
              value: "#0f172a",
            },
            {
              field: "accentColor",
              label: "رنگ تأکیدی",
              desc: "رنگ hex سطح‌بالا. برای حالت‌های hover و هایلایت‌های کوچک استفاده می‌شود.",
              icon: "accent",
              value: "#f59e0b",
            },
          ],
        },
        {
          title: "تایپوگرافی",
          fields: [
            {
              field: "typography.fontFamily",
              label: "خانواده فونت",
              desc: "رشتهٔ CSS font-family که روی کل بدنهٔ ایمیل اعمال می‌شود.",
              icon: "fontFamily",
              value: "Inter, sans-serif",
            },
            {
              field: "typography.fontWeight",
              label: "وزن فونت",
              desc: "وزن عددی CSS (300–700) که روی متن بدنه اعمال می‌شود.",
              icon: "fontWeight",
              value: "400",
            },
            {
              field: "typography.fontSize",
              label: "اندازه فونت",
              desc: "اندازه فونت بدنه به پیکسل (12–18). کارت OTP اندازهٔ فونت جداگانهٔ خود را دارد.",
              icon: "fontSize",
              value: "15",
            },
            {
              field: "typography.lineHeight",
              label: "ارتفاع خط",
              desc: "ارتفاع خط CSS بدون واحد (1.2–2.0) برای متن بدنه.",
              icon: "lineHeight",
              value: "1.6",
            },
          ],
        },
        {
          title: "سربرگ و پاورقی",
          fields: [
            {
              field: "header.title",
              label: "عنوان سربرگ",
              desc: "H1 ایمیل. در FREE قابل ویرایش. پیش‌فرض: «Verify your email».",
              icon: "header",
              value: "Verify your email",
            },
            {
              field: "header.subtitle",
              label: "زیرعنوان سربرگ",
              desc: "یک خط محو زیر عنوان. در FREE قابل ویرایش.",
              icon: "header",
              value: "Use the code below to complete verification",
            },
            {
              field: "footer.companyName",
              label: "نام شرکت پاورقی",
              desc: "در پاورقی نمایش داده می‌شود. در FREE قابل ویرایش. همچنین به‌عنوان appName پیش‌نمایش استفاده می‌شود.",
              icon: "footer",
              value: "Nixify",
            },
            {
              field: "footer.copyright",
              label: "کپی‌رایت پاورقی",
              desc: "خط کپی‌رایت در پایین. در FREE قابل ویرایش.",
              icon: "footer",
              value: "© 2026 Nixify",
            },
          ],
        },
      ],
    },

    emailChanges: {
      heading: "چه چیزی در ایمیل واقعی تغییر می‌کند؟",
      subheading:
        "هر فیلد زبانهٔ Branding به یک عنصر مشخص در ایمیل OTP رندرشده نگاشت می‌شود. پیش‌نمایش API ThemeConfig شما را در زمان واقعی اعمال می‌کند — جدول زیر اثر فیلد‌به‌فیلد را نشان می‌دهد.",
      tableHeaders: {
        field: "فیلد Branding",
        affects: "عنصر ایمیل",
        before: "قبل (پیش‌فرض)",
        after: "بعد (سفارشی)",
      },
      mappings: [
        {
          field: "primaryColor",
          affects: "پس‌زمینهٔ سربرگ + رنگ کد OTP",
          before: "#059669",
          after: "#4f46e5",
          note: "یک hex هم بنر سربرگ و هم ارقام OTP را کنترل می‌کند. یک بار تغییر دهید، هر دو به‌روز می‌شوند.",
        },
        {
          field: "footer.companyName",
          affects: "امضای پاورقی + appName پیش‌نمایش",
          before: "Nixify",
          after: "Acme",
          note: "همچنین به‌عنوان appName نشان‌داده‌شده در سربرگ پنل پیش‌نمایش زنده استفاده می‌شود.",
        },
        {
          field: "header.title",
          affects: "H1 ایمیل",
          before: "Verify your email",
          after: "Confirm your Acme account",
          note: "در پلن FREE قابل ویرایش — نیازی به ارتقا به PRO نیست.",
        },
        {
          field: "otpCard.style",
          affects: "نمایش ارقام OTP",
          before: "box",
          after: "pill",
          note: "کارت OTP را بین box / underline / pill / mono تغییر می‌دهد. فقط PRO+.",
        },
        {
          field: "otpCard.letterSpacing",
          affects: "فاصلهٔ بین ارقام OTP",
          before: "8px",
          after: "12px",
          note: "اسلایدر 0–15px. فاصلهٔ بزرگ‌تر حرفه‌ای‌تر می‌خواند اما فضای افقی بیشتری می‌گیرد.",
        },
        {
          field: "typography.fontFamily",
          affects: "فونت متن بدنه و پاورقی",
          before: "Inter, sans-serif",
          after: "Georgia, serif",
          note: "به‌صورت سراسری اعمال می‌شود. رندررهای فارسی/عربی در صورت نیاز به Vazirmatn برمی‌گردند.",
        },
        {
          field: "background.type",
          affects: "پس‌زمینهٔ بیرونی ایمیل",
          before: "solid",
          after: "gradient",
          note: "بین رنگ یکدست / طیف رنگی CSS / URL تصویر تغییر می‌دهد. یک Dark Value برای حالت تاریک دارد.",
        },
      ],
      footnote:
        "هر هفت فیلد بالا در ThemeConfig تم ذخیره‌شده باقی می‌مانند. پیش‌نمایش API همان ThemeConfig را می‌خواند — آنچه در iframe می‌بینید دقیقاً همان است که تحویل داده می‌شود.",
    },

    consistencyChecklist: {
      heading: "چک‌لیست یکپارچگی برند",
      subheading:
        "قبل از کلیک روی «Activate» این لیست را مرور کنید. تمی که در هر کدام از این موارد شکست بخورد، در حداقل یک صندوق ورودی off-brand به نظر می‌رسد.",
      items: [
        {
          label: "همان رنگ اصلی در سربرگ، OTP و دکمه",
          hint: "primaryColor هر سه را کنترل می‌کند. تطابقشان را بررسی کنید — به‌ازای‌کامپوننت override نکنید.",
        },
        {
          label: "footer.companyName با محصول شما مطابقت دارد",
          hint: "footer.companyName همچنین appName پیش‌نمایش است. کوتاه نگهش دارید — نام‌های طولانی در موبایل می‌شکنند.",
        },
        {
          label: "عنوان سربرگ ساده و مشخص است",
          hint: "پیش‌فرض «Verify your email» خوب است. برای 2FA، «Your login code» را ترجیح دهید. از کپی بازاریابی در H1 پرهیز کنید.",
        },
        {
          label: "سبک کارت OTP با لحن برند شما مطابقت دارد",
          hint: "box پیش‌فرض است. pill مدرن حس می‌کند. underline حداقلی است. mono فنی می‌خواند. یکی را انتخاب کنید و در سراسر purpose‌ها یکدست بمانید.",
        },
        {
          label: "در Light، Dark و حداقل یک زبان RTL پیش‌نمایش گرفته شده",
          hint: "از انتخاب‌گر Mode استفاده کنید و فارسی یا عربی را انتخاب کنید. تراز سربرگ و wrap پاورقی در RTL متفاوت است.",
        },
        {
          label: "در Gmail Mobile (375px) و Outlook پیش‌نمایش گرفته شده",
          hint: "Gmail Mobile برخی CSSها را حذف می‌کند. Outlook border-radius را نادیده می‌گیرد. اگر آنجا شکسته است، ساده‌سازی کنید.",
        },
        {
          label: "Purpose تنظیم شده و Dynamic Rule فعال است",
          hint: "بعد از Save، یک Purpose تنظیم کنید و کارت Dynamic Theme Rules را بررسی کنید. Status باید زمردی «active» باشد، نه «draft».",
        },
      ],
      warningTitle: "تم‌های فعال را در سراسر purpose‌ها مخلوط نکنید",
      warningBody:
        "اگر signup از تم ایندیگو استفاده کند و login از زمردی پیش‌فرض، کاربران شما در دو ایمیل دو برند متفاوت خواهند دید. اگر یک برند یکدست می‌خواهید، Purpose = all را روی یک تم تنها تنظیم و آن را فعال کنید.",
    },
  },
};
