/**
 * UX-B: Webhooks guide — Persian (فارسی) content dictionary.
 *
 * این دیکشنری برابر فارسیِ دقیقِ webhooks-en.ts است. همان شکل، همان تعداد
 * فیلدها، همان توکن‌های فنی (URLها مثل https://api.acme.com/***، کدهای رویداد
 * مثل otp.sent / otp.verified / nixify.webhook.test، اسرار امضا مثل
 * mg_whsec_…، امضاهای HMAC مثل t=1700000000,v1=4a2d…، شناسه‌های تحویل
 * (UUID)، شناسه‌های عددی نقطهٔ پایانی، مهرهای زمانی ISO، زمان‌های نسبی،
 * کدهای وضعیت HTTP مثل 200 / 429 / 500، کدهای کلاس خطا مثل network_error /
 * http_4xx / ssrf_blocked / max_attempts_exceeded، مسیرهای فایل مثل
 * src/lib/dx/webhooks.ts، نام‌های هدر مثل Nixify-Signature / Nixify-Event /
 * Nixify-Delivery-Id) به‌صورت LTR باقی می‌مانند.
 *
 * قرارداد بومی‌سازی (REGRESSION-PROTECTED):
 *   - stage.dir = "rtl" و stage.locale = "fa" — مرحله نهاده به‌صورت دائمی
 *     dir="ltr" نیست.
 *   - برچسب‌های انسانی (عنوان، زیرعنوان، برچسب‌های جدول، متن بنرها، متن
 *     راهنما، متن دیالوگ‌ها) به فارسی روان ترجمه می‌شوند.
 *   - اعداد فارسی (۰۱–۰۷) فقط در جاهایی به کار رفته‌اند که در نسخهٔ انگلیسی
 *     هم اعداد لاتین در متن طبیعی به کار رفته‌اند (مثل نشان‌های مرحله در
 *     cycle یا زمان‌های نسبی مثل «۳ دقیقه پیش»). اعداد فنی (مثل شناسهٔ عددی
 *     نقطهٔ پایانی، ISO timestampها، کدهای وضعیت، UUIDها) همگی LTR باقی
 *     می‌مانند.
 *   - توکن‌های فنی در زمان رندر با <Ltr> پیچیده می‌شوند تا در صفحهٔ RTL
 *     به‌درستی نمایش داده شوند.
 *
 * Audit-grade factual accuracy (re-verified this pass):
 *   هر ادعایی در این فایل بر اساس:
 *     - src/app/dashboard/webhooks/page.tsx                       (~1038-line real UI)
 *     - src/app/api/dashboard/webhooks/route.ts                    (list / create / maskUrl)
 *     - src/lib/dx/webhooks.ts                                     (signing + verification + queue)
 *     - src/i18n/fa.ts                                             (dashboard.webhooks.* labels)
 *   بازبینی شده است. متنِ فارسی، معادل دقیقِ متنِ انگلیسی است.
 */

import type { WebhooksGuideContent } from "./webhooks-types";

export const webhooksFa: WebhooksGuideContent = {
  slug: "webhooks",
  routeKey: "webhooks",
  backHref: "/dashboard/webhooks",
  stepCount: 6,
  durationMin: 5,
  category: "developer",
  dashboardRoute: "/dashboard/webhooks",
  title: "اتصال رویدادها (Webhook)",
  description:
    "نقاط انتهایی وب‌هوک امضاشده را ثبت کنید، تحویل‌ها را بررسی کنید و رویدادها را replay کنید. هر تحویل با HMAC-SHA256 و یک راز اختصاصی برای هر نقطهٔ پایانی امضا می‌شود که فقط یک‌بار هنگام ایجاد نمایش داده می‌شود — Nixify هرگز راز را دوباره برنمی‌گرداند. مدل dispatch فقط-durable، قرارداد امضا + تأیید، و چرخهٔ retry + replay را بیاموزید.",
  chapters: [
    {
      id: "intro",
      title: "اتصال رویدادها (Webhook)",
      steps: [
        {
          id: "webhooksOverview",
          caption:
            "این صفحهٔ واقعی «وب‌هوک‌ها» است. هدر شامل آیکن سبز Webhook، عنوان «Webhooks» و زیرعنوان «ثبت نقاط انتهایی وب‌هوک امضاشده، بررسی تحویل‌ها و replay رویدادها» است. در زیر آن: دکمهٔ Refresh و دکمهٔ سبز «New Endpoint». کارت Endpoints هر نقطهٔ پایانی را فهرست می‌کند — URL ماسک‌شده، رویدادهای مشترک، وضعیت فعال/غیرفعال، مهرهای زمانی ایجاد + آخرین استفاده و منوی عملیات هر ردیف (Edit / Send test / Rotate secret / Deactivate). کارت Delivery history در زیر آن هر تحویل را فهرست می‌کند — رویداد، نقطهٔ پایانی، وضعیت، تلاش‌ها، کد پاسخ، کلاس خطا و دکمهٔ Replay.",
          duration: 8000,
          scene: "webhooksOverview",
        },
        {
          id: "createEndpoint",
          caption:
            "برای باز کردن دیالوگ ایجاد، «New Endpoint» را بزنید. URL کامل https را که Nixify به آن POST می‌کند تایپ کنید. اشتراک‌های رویداد را از ۸ chip سریع (otp.sent، otp.verified، otp.failed، otp.expired، nixify.event.received، nixify.webhook.test، contact.created، contact.updated) انتخاب کنید، یا یک نوع رویداد سفارشی اضافه کنید. دکمهٔ تأیید تا زمانی که URL خالی باشد یا هیچ رویدادی انتخاب نشده باشد غیرفعال است. اعتبارسنجی SSRF هنگام ایجاد اجرا می‌شود — محدوده‌های private / loopback / datacenter رد می‌شوند.",
          duration: 8500,
          scene: "createEndpoint",
        },
        {
          id: "secretReveal",
          caption:
            "هنگام تأیید، دیالوگ ایجاد بسته می‌شود و یک دیالوگ secret با راز امضا باز می‌شود — دقیقاً یک‌بار. آن را همین حالا کپی کنید. راز کلید تأیید HMAC است: Nixify از آن برای امضای هر تحویل استفاده می‌کند (HMAC-SHA256 روی `${timestamp}.${payload}`) و گیرنده از آن برای تأیید هدر Nixify-Signature استفاده می‌کند. Nixify راز را به‌صورت plaintext روی ردیف WebhookEndpoint ذخیره می‌کند اما هرگز پس از این دیالوگ آن را از طریق API برنمی‌گرداند. اگر آن را گم کنید باید آن را rotate کنید (POST /:id/rotate-secret) — راز قدیمی بلافاصله کار نمی‌کند.",
          duration: 8500,
          scene: "secretReveal",
        },
        {
          id: "testDelivery",
          caption:
            "منوی عملیات یک ردیف را باز کنید و «Send test» را بزنید. Nixify یک تحویل nixify.webhook.test زمان‌بندی می‌کند — از تطابق اشتراک عبور می‌کند تا حتی اگر هنوز هیچ رویداد تولیدی مشترک نباشید، بتوانید تأیید کنید نقطهٔ پایانی شما قابل دسترسی است. تحویل وارد صف durable می‌شود (هرگز تلاش اول inline نیست)، پردازشگر به‌صورت atomic آن را claim می‌کند، یک تلاش POST با هدرهای Nixify-Signature + Nixify-Event انجام می‌دهد و ردیف جدید در جدول تحویل‌ها با وضعیت، کد پاسخ و تعداد تلاش‌ها ظاهر می‌شود.",
          duration: 9000,
          scene: "testDelivery",
        },
        {
          id: "retryAndFailure",
          caption:
            "هنگامی‌که یک تحویل ناموفق است (پاسخ غیر-2xx، خطای شبکه، timeout یا مسدود شدن SSRF روی یک URL مجدداً resolve‌شده)، پردازشگر صف خطا را به‌طور امن طبقه‌بندی می‌کند (network_error / timeout / http_4xx / http_5xx / ssrf_blocked / endpoint_missing / configuration_error) و یک retry با backoff نمایی زمان‌بندی می‌کند: 10s → 30s → 90s. پس از maxRetries (پیش‌فرض ۳، مبتنی بر entitlement)، تحویل با lastError = max_attempts_exceeded ناموفق علامت‌گذاری می‌شود. جدول تحویل‌ها تعداد تلاش‌ها + کد lastError را نشان می‌دهد تا بتوانید بدون نشت پیام‌های استثنای خام عیب‌یابی کنید.",
          duration: 9500,
          scene: "retryAndFailure",
        },
        {
          id: "replayAndAudit",
          caption:
            "دکمهٔ Replay را روی هر ردیف تحویل بزنید. Nixify یک تحویل NEW با امضای تازه (راز فعلی + مهر زمانی تازه) زمان‌بندی می‌کند — تحویل اصلی تغییر نمی‌کند و مسیر ممیزی خود را حفظ می‌کند. به همین دلیل replay از POST /deliveries/:deliveryId/replay استفاده می‌کند، نه ارسال مجدد اصلی: اصلی، شواهد تغییرناپذیر است. از replay وقتی استفاده کنید که نقطهٔ پایانی در زمان تحویل اصلی پایین بود، وقتی باگ هندلر را اصلاح کرده‌اید، یا وقتی می‌خواهید تأیید کنید تأییدکننده‌تان هنوز کار می‌کند.",
          duration: 8500,
          scene: "replayAndAudit",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "خواندن فهرست نقاط پایانی + فهرست تحویل‌ها",
      body: "صفحهٔ وب‌هوک‌ها با یک هدر باز می‌شود (آیکن سبز Webhook + «Webhooks» + زیرعنوان «ثبت نقاط انتهایی وب‌هوک امضاشده، بررسی تحویل‌ها و replay رویدادها»)؛ دکمهٔ Refresh و دکمهٔ سبز «New Endpoint». کارت Endpoints هر نقطهٔ پایانی را با ستون‌ها فهرست می‌کند: URL (mono، ماسک‌شده — origin + /***، پیچیده‌شده در <Ltr>)، Events (CSV → badgeها، حداکثر ۳ نمایش داده می‌شود + badge «+N»، «—» وقتی هیچ‌کدام نباشد)، Status (Switch + badge فعال=emerald / غیرفعال=muted؛ Switch وقتی نقطهٔ پایانی از‌قبل غیرفعال باشد غیرفعال است و هنگام خاموش شدن یک نقطهٔ فعال، دیالوگ deactivate را باز می‌کند)، Created (نسبی)، Last Used (نسبی یا «never») و یک Dropdown عملیات هر ردیف (Edit / Send test / Rotate secret / Deactivate). کارت Delivery history در زیر آن هر تحویل را با ستون‌ها فهرست می‌کند: Event (badge mono)، Endpoint (mono truncate)، Status (delivered=emerald / failed=rose / pending=amber)، Tries (عدد mono)، Code (responseCode یا «—»)، Error (lastError یا «—»)، Created (نسبی) و دکمهٔ Replay.",
    },
    {
      title: "باز کردن دیالوگ Create و انتخاب URL + رویدادها",
      body: "«New Endpoint» را بزنید. دیالوگ شامل یک ورودی URL (placeholder یعنی https://example.com/hooks/nixify، mono، maxLength 2048) و یک ویرایشگر اشتراک رویداد با ۸ chip سریع (otp.sent، otp.verified، otp.failed، otp.expired، nixify.event.received، nixify.webhook.test، contact.created، contact.updated) است. رویدادهای انتخاب‌شده به‌عنوان chipهای قابل حذف در زیر نشان داده می‌شوند؛ همچنین می‌توانید یک نوع رویداد سفارشی (maxLength 100) از طریق ورودی free-text + دکمهٔ Plus اضافه کنید. دکمهٔ تأیید تا زمانی که URL خالی باشد یا هیچ رویدادی انتخاب نشده باشد غیرفعال است. اعتبارسنجی SSRF هنگام ایجاد اجرا می‌شود — محدوده‌های private / loopback / datacenter با کد خطای SSRF رد می‌شوند.",
    },
    {
      title: "کپی راز امضا از دیالوگ Secret (یک‌بار نمایش)",
      body: "هنگام تأیید، دیالوگ ایجاد بسته می‌شود و دیالوگ secret با راز امضا باز می‌شود — دقیقاً یک‌بار. همین حالا کپی کنید. راز، کلید تأیید HMAC است: Nixify از آن برای امضای هر تحویل استفاده می‌کند (HMAC-SHA256 روی `${timestamp}.${payload}`، به‌صورت `t=<timestamp>,v1=<hex>` در هدر Nixify-Signature برگردانده می‌شود) و گیرنده از آن برای تأیید امضا روی POSTهای ورودی استفاده می‌کند. Nixify هرگز راز را دوباره برنمی‌گرداند — اگر آن را گم کنید باید آن را از طریق POST /:id/rotate-secret تغییر دهید، که ستون را بازنویسی می‌کند و یک راز تازه را یک‌بار برمی‌گرداند (امضاهای قدیمی بلافاصله تأیید نمی‌شوند). «Saved» را بزنید تا دیالوگ بسته شود؛ ردیف نقطهٔ پایانی جدید در جدول ظاهر می‌شود.",
    },
    {
      title: "ارسال یک تحویل تست برای تأیید دسترسی‌پذیری",
      body: "منوی عملیات یک ردیف را باز کنید و «Send test» را بزنید. Nixify تابع scheduleTestDelivery را فراخوانی می‌کند که یک تحویل با نوع رویداد nixify.webhook.test ایجاد می‌کند (از تطابق اشتراک عبور می‌کند تا حتی بدون اشتراک رویداد تولیدی بتوانید دسترسی نقطهٔ پایانی را تأیید کنید). تحویل وارد صف durable می‌شود — هرگز تلاش اول inline از مسیر درخواست برنامه‌ای نیست. پردازشگر صف به‌صورت atomic آن را claim می‌کند (updateMany WHERE status='pending' AND nextRetryAt <= NOW())، یک تلاش POST با هدرهای Nixify-Signature + Nixify-Event انجام می‌دهد و ردیف جدید در جدول تحویل‌ها با وضعیت، کد پاسخ و تعداد تلاش‌ها ظاهر می‌شود. اگر نقطهٔ پایانی شما 2xx برگرداند، تحویل delivered علامت‌گذاری می‌شود؛ در غیر این‌صورت با backoff retry می‌شود.",
    },
    {
      title: "بررسی یک تحویل ناموفق + کلاس خطا",
      body: "هنگامی‌که یک تحویل ناموفق است (پاسخ غیر-2xx، خطای شبکه، timeout یا مسدود شدن SSRF روی یک URL مجدداً resolve‌شده)، پردازشگر صف خطا را به‌طور امن از طریق classifyFetchError طبقه‌بندی می‌کند — هرگز پیام‌های استثنای خام را ذخیره نمی‌کند. طبقه‌بندی‌های محدودشده عبارت‌اند از: network_error، timeout، http_4xx، http_5xx، ssrf_blocked، endpoint_missing، configuration_error و max_attempts_exceeded (ترمینال). جدول تحویل‌ها تعداد تلاش‌ها و کد lastError را نشان می‌دهد تا بتوانید عیب‌یابی کنید. الگوهای رایج: http_4xx یعنی نقطهٔ پایانی شما 4xx برگردانده (اغلب تأییدکننده امضا را رد کرده — بررسی کنید راز درست و پنجرهٔ تلورانس درست را استفاده می‌کنید)؛ http_5xx یعنی نقطهٔ پایانی شما crash کرده؛ timeout یعنی هندلر شما بیش از 10s طول کشیده؛ ssrf_blocked یعنی URL هنگام تحویل به محدودهٔ private / loopback / datacenter مجدداً resolve شده (یک IP متفاوت از زمان ایجاد).",
    },
    {
      title: "Replay یک تحویل وقتی نقطهٔ پایانی شما آماده است",
      body: "دکمهٔ Replay را روی هر ردیف تحویل بزنید. Nixify تابع scheduleReplayDelivery را فراخوانی می‌کند که یک تحویل NEW قابل ممیزی با امضای تازه (راز فعلی + مهر زمانی تازه) ایجاد می‌کند — تحویل اصلی تغییر نمی‌کند و مسیر ممیزی خود را حفظ می‌کند. به همین دلیل replay از POST /deliveries/:deliveryId/replay استفاده می‌کند، نه ارسال مجدد اصلی: اصلی، شواهد تغییرناپذیرِ آنچه تلاش شده و چه زمانی است. از replay وقتی استفاده کنید که نقطهٔ پایانی در زمان تحویل اصلی پایین بود، وقتی باگ هندلر را اصلاح کرده‌اید، یا وقتی می‌خواهید تأیید کنید تأییدکننده‌تان هنوز کار می‌کند. تحویل جدید به‌عنوان یک ردیف تازه در جدول تحویل‌ها با deliveryId، attempts و status مخصوص خودش ظاهر می‌شود.",
    },
  ],
  whyWhen: [
    {
      title: "چه زمانی یک نقطهٔ پایانی وب‌هوک ثبت کنیم",
      body: "هر زمان بخواهید Nixify اعلان‌های رویداد بلادرنگ را به سرور شما push کند — به‌جای polling از API — یک نقطهٔ پایانی وب‌هوک ثبت کنید. موارد استفادهٔ رایج: همگام‌سازی ایجاد/به‌روزرسانی مخاطبین در CRM شما، فعال‌سازی اعلان Slack هنگام تأیید یک OTP، ممیزی جهش‌های شکست OTP، راه‌اندازی یک گردش‌کار داخلی هنگام تکمیل یک broadcast. اشتراک‌های رویداد را از ۸ chip سریع انتخاب کنید یا نوع رویداد سفارشی خود را اضافه کنید. URL نقطهٔ پایانی باید https و SSRF-safe باشد — Nixify محدوده‌های private / loopback / datacenter را هنگام ایجاد و قبل از هر تحویل رد می‌کند.",
    },
    {
      title: "چرا راز فقط یک‌بار نمایش داده می‌شود",
      body: "ذخیرهٔ راز به‌صورت plaintext به این معنا بود که یک نقض پایگاه‌داده می‌تواند کلید امضای هر نقطهٔ پایانی را نشت دهد. Nixify راز را به‌صورت plaintext روی ردیف WebhookEndpoint ذخیره می‌کند (برای امضای هر تحویل به آن نیاز دارد) اما هرگز پس از پاسخ create یا rotate-secret آن را از طریق API برنمی‌گرداند. اگر آن را گم کنید باید آن را rotate کنید — POST /:id/rotate-secret ستون را بازنویسی می‌کند و راز جدید را یک‌بار برمی‌گرداند. امضاهای قدیمی بلافاصله تأیید نمی‌شوند (تأییدکننده گیرنده آن‌ها را رد می‌کند چون HMAC محاسبه‌شده دیگر با v1 در هدر مطابقت ندارد). در صورت شک به نفوذ، بلافاصله rotate کنید.",
    },
    {
      title: "چرا همهٔ تحویل‌ها قبل از تحویل شبکه وارد صف می‌شوند",
      body: "یک تلاش اول inline از مسیر درخواست برنامه‌ای (مثلاً از /api/v1/otp/send) پاسخ OTP را به تأخیر گیرنده گره می‌زد — یک نقطهٔ پایانی کند، تحویل OTP را کند می‌کرد. بدتر، یک crash بین زمان‌بندی و تحویل، رویداد را بی‌صدا از دست می‌داد. به‌جای آن، همهٔ تحویل‌ها قبل از هر فراخوانی شبکه وارد صف durable (ردیف‌های WebhookDelivery + WebhookQueue) می‌شوند. درخواست برنامه‌ای بلافاصله برمی‌گردد؛ پردازشگر صف کارها را به‌صورت atomic claim می‌کند (updateMany WHERE status='pending' AND nextRetryAt <= NOW()) و out-of-band تحویل می‌دهد. این چیزی است که سیستم وب‌هوک را قابل‌اعتماد می‌کند: یک نقطهٔ پایانی کند یا پایین هرگز تحویل OTP را مسدود نمی‌کند، و یک crash پردازشگر میان batch توسط worker بعدی بازیابی می‌شود (بازیابی stale-lock از طریق timeout 5 دقیقه).",
    },
    {
      title: "چه زمانی از replay استفاده کنیم و چه زمانی از send test",
      body: "هنگامی‌که می‌خواهید تأیید کنید نقطهٔ پایانی شما قابل دسترسی و تأییدکننده‌تان کار می‌کند، send test (POST /:id/test) بزنید — یک رویداد synthetic nixify.webhook.test با یک payload synthetic ارسال می‌کند و از تطابق اشتراک عبور می‌کند. وقتی می‌خواهید یک رویداد واقعی را که نقطهٔ پایانی شما از دست داده دوباره تحویل دهید (پایین بود، هندلر باگ داشت، یک اصلاح مستقر کردید) از replay (POST /deliveries/:deliveryId/replay) استفاده کنید. Replay یک تحویل جدید با امضای تازه اما همان payload ایجاد می‌کند — تحویل اصلی شواهد تغییرناپذیرِ آنچه تلاش شده و چه زمانی است. از replay به‌عنوان راهی برای اسپم کردن نقطهٔ پایانی استفاده نکنید؛ هر replay یک تحویل کامل جدید است که به حجم تحویل شما حساب می‌شود.",
    },
  ],
  mistakes: [
    {
      title: "بستن دیالوگ secret بدون کپی",
      body: "دیالوگ secret تنها زمانی است که راز امضا از طریق API (پس از create یا rotate-secret) نشان داده می‌شود. بستن آن بدون کپی راز به این معناست که هیچ راهی برای تأیید امضاهای ورودی ندارید — تأییدکننده شما هر تحویل را رد می‌کند چون نمی‌تواند HMAC را دوباره محاسبه کند. باید راز را rotate کنید (POST /:id/rotate-secret) تا یکی جدید بگیرید و راز قدیمی بلافاصله کار نمی‌کند. همیشه قبل از زدن «Saved»، راز را در یک مدیریتگر اسرار کپی کنید.",
    },
    {
      title: "تأیید امضا بدون مهر زمانی",
      body: "هدر Nixify-Signature به‌صورت `t=<timestamp>,v1=<hex>` است. HMAC روی `${timestamp}.${payload}` محاسبه می‌شود، نه روی payload تنها. اگر تأییدکننده شما بخش `t=` را نادیده بگیرد و HMAC را فقط روی payload محاسبه کند، مقایسه هر بار ناموفق خواهد بود. هدر را به یک map تجزیه کنید، `t` و `v1` را استخراج کنید، HMAC را روی `${t}.${rawRequestBody}` دوباره محاسبه کنید، سپس constant-time با `v1` مقایسه کنید. پنجرهٔ تلورانس 5 دقیقه‌ای (|Date.now() - t| <= 5min) نیز اجباری است — بدون آن، یک امضای ضبط‌شده می‌تواند نامحدود replay شود.",
    },
    {
      title: "اعتماد به payload بدون تأیید",
      body: "اگر هندلر شما بدنهٔ JSON را بدون تأیید Nixify-Signature بخواند، هر کسی که بتواند به URL نقطهٔ پایانی شما POST کند می‌تواند یک وب‌هوک جعلی بسازد. امضا تنها سند درستی است که درخواست از Nixify آمده است. همیشه قبل از اعتماد به payload تأیید کنید: هدر را تجزیه کنید، HMAC را با راز ذخیره‌شده دوباره محاسبه کنید، constant-time مقایسه کنید و در صورت عدم تطابق با 401 رد کنید. از بدنهٔ خام درخواست (نه یک شیء JSON سریالی‌شده مجدد) برای ورودی HMAC استفاده کنید — سریالی‌سازی مجدد می‌تواند فضای سفید / ترتیب کلیدها را تغییر دهد و امضا را بشکند.",
    },
    {
      title: "انتظار تحویل inline از مسیر درخواست برنامه‌ای",
      body: "مسیر درخواست برنامه‌ای (مثلاً POST /api/v1/otp/send) وب‌هوک را inline تحویل نمی‌دهد. یک تحویل زمان‌بندی می‌کند (ردیف‌های WebhookDelivery + WebhookQueue را در یک تراکنش ایجاد می‌کند) و بلافاصله برمی‌گردد. POST واقعی به نقطهٔ پایانی شما out-of-band اتفاق می‌افتد، وقتی پردازشگر صف کار را claim می‌کند. اگر نقطهٔ پایانی شما کند باشد، پاسخ OTP تحت تأثیر قرار نمی‌گیرد. اگر نقطهٔ پایانی شما پایین باشد، تحویل با backoff retry می‌شود — پاسخ OTP هنوز تحت تأثیر قرار نمی‌گیرد. تست‌های ادغام ننویسید که ادعا کنند وب‌هوک پس از بازگشت ارسال OTP به‌صورت همگام رسیده است.",
    },
    {
      title: "در نظر گرفتن replay به‌عنوان ارسال مجدد اصلی",
      body: "Replay یک تحویل NEW قابل ممیزی با امضای تازه (راز فعلی + مهر زمانی تازه) و یک deliveryId جدید ایجاد می‌کند. تحویل اصلی تغییر نمی‌کند — وضعیت، تلاش‌ها، responseCode و lastError اصلی خود را به‌عنوان شواهد تغییرناپذیرِ آنچه تلاش شده و چه زمانی حفظ می‌کند. به همین دلیل replay از POST /deliveries/:deliveryId/replay استفاده می‌کند، نه ارسال مجدد اصلی. اگر لاگ ممیزی شما یک نگاشت 1:1 بین رویدادهای OTP و تحویل‌ها ادعا کند، replayها به‌عنوان ردیف‌های اضافی ظاهر می‌شوند — این بر اساس طراحی است. Payload تحویل replay‌شده با اصلی یکسان است اما امضا تازه است.",
    },
  ],
  proTips: [
    {
      title: "در طول ادغام در رویداد تست مشترک شوید",
      body: "وقتی در حال ادغام هستید، نقطهٔ پایانی خود را در دیالوگ ایجاد به nixify.webhook.test مشترک کنید (یکی از ۸ chip سریع است). سپس از عملیات «Send test» هر ردیف برای شلیک یک تحویل تست synthetic در هر زمان استفاده کنید. رویداد تست از تطابق اشتراک عبور می‌کند، پس حتی اگر فهرست اشتراک شما در غیر این‌صورت خالی باشد می‌رسد — اما مشترک شدن به این معناست که هندلر شما می‌تواند آن را به‌طور سازگار مسیریابی کند. وقتی مطمئن شدید، می‌توانید اشتراک تست را حذف کنید و برای بررسی‌های نقطه‌ای روی Send test هر ردیف تکیه کنید.",
    },
    {
      title: "Idempotency را روی گیرنده پیاده‌سازی کنید",
      body: "تحویل‌های وب‌هوک at-least-once هستند، نه exactly-once. پردازشگر صف هنگام شکست retry می‌کند، و یک بازیابی stale-lock می‌تواند کاری را که در واقع mid-flight بود دوباره claim کند — بنابراین گیرنده شما ممکن است همان تحویل را دو بار ببیند (نادر، اما ممکن است). از هدر Nixify-Delivery-Id (یا فیلد deliveryId در payload) به‌عنوان کلید idempotency خود استفاده کنید: آن را در یک ستون unique-constraint روی سمت خود ذخیره کنید و اگر قبلاً دیده‌اید از پردازش عبور کنید. بدون idempotency، یک تحویل retry‌شده می‌تواند عوارض جانبی دوتایی ایجاد کند (مثلاً دو اعلان Slack برای یک OTP).",
    },
    {
      title: "راز را بر اساس تقویم rotate کنید",
      body: "حتی بدون هیچ نفوذ شناخته‌شده‌ای، rotate کردن راز امضا هر ۹۰ روز یک عادت سالم است. POST /:id/rotate-secret ستون را بازنویسی می‌کند و راز جدید را یک‌بار برمی‌گرداند؛ راز قدیمی بلافاصله تحویل‌ها را امضا نمی‌کند. قبل از چرخش، تأییدکننده خود را به استفاده از راز جدید به‌روز کنید (یا بلافاصله پس از آن — تحویل‌های قدیمی تا به‌روزرسانی تأییدکننده تأیید نمی‌شوند که همین هدف rotate است). اگر نقاط انتهایی متعدد دارید، آن‌ها را بر اساس یک تقویم متناوب rotate کنید تا هرگز همهٔ تأییدکننده‌هایتان را همزمان به‌روز نکنید.",
    },
    {
      title: "از جدول تحویل‌ها برای کارآگاهی استفاده کنید",
      body: "کارت Delivery history مسیر کارآگاهی شماست. بر اساس نقطهٔ پایانی + وضعیت فیلتر کنید تا تحویل‌های ناموفق را پیدا کنید؛ تعداد تلاش‌ها و کد lastError به شما می‌گویند چه چیزی اشتباه پیش رفت. http_4xx + tries=1 اغلب یعنی تأییدکننده شما امضا را رد کرده (راز + پنجرهٔ تلورانس را بررسی کنید). http_4xx + retries یعنی نقطهٔ پایانی شما در هر تلاش 4xx برگردانده. http_5xx یعنی نقطهٔ پایانی شما crash کرده. timeout یعنی هندلر شما بیش از 10s طول کشیده. ssrf_blocked یعنی URL هنگام تحویل به محدودهٔ private / loopback / datacenter مجدداً resolve شده — کسی DNS را روی شما تغییر داده. هر تحویل را پس از اصلاح علت ریشه‌ای replay کنید.",
    },
  ],
  troubleshooting: [
    {
      title: "ایجاد 400 برمی‌گرداند (validation_failed / کد SSRF)",
      body: "POST /api/dashboard/webhooks URL را با zod اعتبارسنجی می‌کند (min 1، max 2048) و SSRF validation را از طریق validateWebhookDestination اجرا می‌کند. محدوده‌های IP private / loopback / datacenter با کد خطای SSRF رد می‌شوند (مثلاً ssrf_blocked_private، ssrf_blocked_loopback، ssrf_blocked_datacenter). از یک URL عمومی به نقطهٔ پایانی واقعی خود استفاده کنید. آرایهٔ events نیز با zod اعتبارسنجی می‌شود: 1-50 رشتهٔ غیرخالی، هر کدام حداکثر 100 کاراکتر. اگر به بیش از ۵۰ اشتراک نیاز دارید، در نظر بگیرید انواع رویدادها را تجمیع کنید یا از یک اشتراک wildcard استفاده کنید (endpointMatchesAlert بک‌اند «*» را می‌پذیرد — داشبورد آن را نشان نمی‌دهد اما می‌توانید مستقیماً از طریق API آن را تنظیم کنید).",
    },
    {
      title: "ایجاد 402 برمی‌گرداند (quota_exhausted)",
      body: "هر طرح یک سهمیهٔ نقطهٔ پایانی فعال دارد (3 PRO، 25 MAX). بررسی ظرفیت فقط نقاط انتهایی ACTIVE را می‌شمارد — نقاط انتهایی غیرفعال‌شده (isActive=false) جای اسلات را اشغال نمی‌کنند. یک نقطهٔ پایانی استفاده‌نشده را غیرفعال کنید تا یک اسلات آزاد شود، یا ارتقا دهید. کد پاسخ 402 با code = quota_exhausted است؛ متمایز از 403 feature_not_available (در پایین).",
    },
    {
      title: "ایجاد 403 برمی‌گرداند (feature_not_available)",
      body: "وب‌هوک یک ویژگی PRO+ است. بررسی canAccess(userId, FEATURE_KEYS.WEBHOOK_ENDPOINTS) روی FREE مقدار false برمی‌گرداند؛ داشبورد این را به‌عنوان صفحهٔ not-available نشان می‌دهد («Webhooks are not available on your current plan»). برای ثبت نقاط انتهایی به PRO یا بالاتر ارتقا دهید. نقاط انتهانی موجود روی یک حساب降گرید‌شده حفظ می‌شوند اما تحویل دریافت نمی‌کنند (پردازشگر صف از نقاط انتهانی که isActive=false است عبور می‌کند).",
    },
    {
      title: "تحویل‌ها در pending گیر کرده‌اند",
      body: "یک تحویل که برای بیش از چند ثانیه در pending گیر کرده معمولاً یعنی پردازشگر صف در حال اجرا نیست (یک worker out-of-band است، نه بخشی از مسیر درخواست برنامه‌ای). بررسی کنید processWebhookQueue فراخوانی می‌شود — معمولاً توسط یک cron، یک فرآیند worker جداگانه یا یک edge function. بازیابی stale-lock 5 دقیقه‌ای به این معناست که کارهای claim‌شده یک worker crash‌شده در نهایت توسط worker بعدی دوباره claim می‌شوند، اما اگر هیچ worker در حال اجرا نباشد، تحویل‌ها به‌طور نامحدود pending می‌مانند. جدول تحویل‌ها برای این ردیف‌های گیرکرده tries=0 و lastError=null نشان می‌دهد.",
    },
    {
      title: "وضعیت تحویل failed با lastError = max_attempts_exceeded",
      body: "تحویل retryهای خود را مصرف کرده. maxRetries مبتنی بر entitlement است (پیش‌فرض 3)؛ پردازشگر صف با backoff نمایی retry کرد (10s → 30s → 90s) و هر تلاش ناموفق بود. ستون lastError کلاس خطای آخرین تلاش را نشان می‌دهد (network_error / http_4xx / http_5xx / timeout / ssrf_blocked / endpoint_missing / configuration_error) و وضعیت نهایی با lastError = max_attempts_exceeded علامت‌گذاری می‌شود. تعداد تلاش‌ها + کد lastError را برای عیب‌یابی بررسی کنید، نقطهٔ پایانی خود را اصلاح کنید، سپس Replay را بزنید تا یک تحویل تازه با امضای تازه زمان‌بندی شود.",
    },
    {
      title: "تأییدکننده هر تحویل را رد می‌کند",
      body: "گیرنده شما HMAC-SHA256(secret, `${t}.${rawPayload}`) را محاسبه می‌کند و constant-time با v1 در هدر Nixify-Signature مقایسه می‌کند. حالت‌های شکست رایج: (1) راز اشتباه — بررسی کنید راز را از دیالوگ create/rotate-secret کپی کرده‌اید، نه پیشوند ماسک‌شده از نمای فهرست. (2) payload سریالی‌شده مجدد — JSON.parse سپس JSON.stringify می‌تواند فضای سفید / ترتیب کلیدها را تغییر دهد؛ از بدنهٔ خام درخواست برای ورودی HMAC استفاده کنید. (3) پنجرهٔ تلورانس فراتر رفته — verifyWebhookSignature اگر |Date.now() - t| > 5min باشد رد می‌کند؛ ساعت سرور خود را بررسی کنید (همگام‌سازی NTP). (4) تجزیهٔ هدر — هدر `t=<ts>,v1=<hex>` با کاما است؛ روی «,» تقسیم کنید سپس هر کدام را روی «=» تقسیم کنید.",
    },
  ],
  checklist: [
    { label: "یک URL https ثبت کرده‌اید که اعتبارسنجی SSRF را پاس می‌کند (بدون محدودهٔ private / loopback / datacenter)" },
    { label: "در حداقل یک نوع رویداد از ۸ chip سریع مشترک شده‌اید (یا یک رویداد سفارشی)" },
    { label: "راز امضا را از دیالوگ create پیش از زدن «Saved» در یک مدیریتگر اسرار کپی کرده‌اید" },
    { label: "تأیید امضا را پیاده‌سازی کرده‌اید (تجزیهٔ t + v1، محاسبهٔ HMAC، مقایسهٔ constant-time، تلورانس 5 دقیقه)" },
    { label: "Idempotency را روی گیرنده پیاده‌سازی کرده‌اید (dedupe بر اساس Nixify-Delivery-Id یا deliveryId در payload)" },
    { label: "از بدنهٔ خام درخواست برای ورودی HMAC استفاده کرده‌اید (نه یک شیء JSON سریالی‌شده مجدد)" },
  ],
  whatNext:
    "هنگامی‌که نقطهٔ پایانی شما ثبت و تأییدکننده‌تان پیاده‌سازی شد، در رویدادهای تولیدی که به آن‌ها اهمیت می‌دهید مشترک شوید (otp.sent، otp.verified، contact.created و غیره) و کارت Delivery history را برای تحویل‌های زنده تماشا کنید. Idempotency را روی گیرنده خود پیاده‌سازی کنید (dedupe بر اساس Nixify-Delivery-Id) — تحویل‌ها at-least-once هستند، نه exactly-once. یک یادآور تقویم ۹۰ روزه برای rotate کردن راز امضا تنظیم کنید. اگر یک تحویل ناموفق شد، تعداد تلاش‌ها + کد lastError در جدول تحویل‌ها مسیر کارآگاهی شماست — عیب‌یابی کنید، اصلاح کنید و Replay را بزنید تا با امضای تازه دوباره تحویل دهید. برای کاتالوگ کامل رویدادها و الگوریتم امضا، به مستندات توسعه‌دهنده مراجعه کنید.",
  related: [
    { label: "داشبورد وب‌هوک‌ها", href: "/dashboard/webhooks" },
    { label: "راهنمای کلیدهای API", href: "/guide/api-keys" },
    { label: "راهنمای مخاطبین", href: "/guide/contacts" },
  ],

  /* ─── Stage copy ──────────────────────────────────────────────────────── */
  stage: {
    dir: "rtl",
    locale: "fa",

    header: {
      title: "وب‌هوک‌ها",
      subtitle: "ثبت نقاط انتهایی وب‌هوک امضاشده، بررسی تحویل‌ها و replay رویدادها.",
      backToDashboard: "داشبورد",
      refresh: "تازه‌سازی",
      addEndpoint: "نقطهٔ پایانی جدید",
    },

    endpointsCard: {
      title: "نقاط انتهایی",
      subtitle: (total, active) =>
        `${total} نقطهٔ پایانی · ${active} فعال`,
      empty: "هنوز هیچ نقطهٔ پایانی وب‌هوکی وجود ندارد",
      emptyDescription:
        "یک URL ثبت کنید تا هر زمان یک رویداد OTP یا مخاطب رخ می‌دهد، POST امضاشده دریافت کنید.",
      createEndpoint: "ایجاد نقطهٔ پایانی",
    },

    table: {
      url: "URL",
      events: "رویدادها",
      status: "وضعیت",
      created: "ایجاد شده",
      lastUsed: "آخرین استفاده",
      actions: "عملیات",
      actionsAria: "عملیات نقطهٔ پایانی",
      neverUsed: "هرگز",
      moreEvents: (n) => `+${n}`,
      noEvents: "—",
    },

    statusLabels: {
      active: "فعال",
      inactive: "غیرفعال",
    },

    actionsMenu: {
      editEndpoint: "ویرایش نقطهٔ پایانی",
      sendTest: "ارسال تست",
      rotateSecret: "rotate راز",
      deactivate: "غیرفعال‌سازی",
    },

    deliveriesCard: {
      title: "تاریخچهٔ تحویل",
      subtitle:
        "تحویل‌های وب‌هوک اخیر در سراسر همهٔ نقاط انتهایی شما. برای ارسال مجدد هر تحویل با امضای تازه replay کنید.",
      allEndpoints: "همهٔ نقاط انتهایی",
      all: "همه",
      empty: "هنوز هیچ تحویلی وجود ندارد. برای دیدن یکی، از منوی نقطهٔ پایانی یک تست وب‌هوک ارسال کنید.",
      refreshAria: "تازه‌سازی تحویل‌ها",
      columnEvent: "رویداد",
      columnEndpoint: "نقطهٔ پایانی",
      columnStatus: "وضعیت",
      columnTries: "تلاش‌ها",
      columnCode: "کد",
      columnError: "خطا",
      columnCreated: "ایجاد شده",
      columnReplay: "Replay",
      replayAria: "replay تحویل",
      replayTooltip: "این تحویل را با امضای تازه replay کنید",
    },

    deliveryStatus: {
      delivered: "تحویل‌شده",
      failed: "ناموفق",
      pending: "در انتظار",
    },

    pagination: {
      pageOf: (page, total) => `صفحه ${page} · مجموع ${total}`,
      prev: "قبلی",
      next: "بعدی",
    },

    createDialog: {
      titleCreate: "ایجاد نقطهٔ پایانی",
      titleEdit: "ویرایش نقطهٔ پایانی",
      descriptionCreate:
        "یک URL ثبت کنید تا هر زمان یک رویداد مشترک رخ می‌دهد POST امضاشده دریافت کنید. راز امضا پس از ایجاد نقطهٔ پایانی یک‌بار نمایش داده می‌شود — بلافاصله آن را کپی کنید.",
      descriptionEdit: "URL یا اشتراک‌های رویداد را برای این نقطهٔ پایانی به‌روز کنید. ویرایش، راز امضا را تغییر نمی‌دهد.",
      urlLabel: "URL نقطهٔ پایانی",
      urlPlaceholder: "https://example.com/hooks/nixify",
      urlHelp: "URL کامل https که Nixify به آن POST می‌کند. محدوده‌های private / loopback / datacenter رد می‌شوند.",
      eventsLabel: "اشتراک‌های رویداد",
      eventsSelected: (n) => `${n} رویداد انتخاب شد`,
      customPlaceholder: "custom.event.type",
      cancel: "انصراف",
      submitCreate: "ایجاد نقطهٔ پایانی",
      submitEdit: "ذخیرهٔ تغییرات",
    },

    secretDialog: {
      titleCreate: "راز نقطهٔ پایانی",
      titleRotate: "راز امضای جدید",
      description:
        "این راز امضا را همین حالا کپی کنید. دیگر نمایش داده نمی‌شود — Nixify از آن برای امضای هر تحویل استفاده می‌کند و گیرنده از آن برای تأیید هدر Nixify-Signature استفاده می‌کند.",
      secretLabel: "راز امضا",
      copy: "کپی",
      copied: "کپی شد",
      warningTitle: "این راز دیگر نمایش داده نمی‌شود",
      warningBody:
        "Nixify از HMAC-SHA256(secret, `${timestamp}.${payload}`) برای امضای هر تحویل استفاده می‌کند. اگر راز را گم کنید باید آن را rotate کنید — امضاهای قدیمی بلافاصله تأیید نمی‌شوند.",
      done: "ذخیره شد",
      hashCaption: "HMAC-SHA256 · Nixify-Signature: t=<ts>,v1=<hex>",
    },

    deactivateDialog: {
      title: "غیرفعال‌سازی نقطهٔ پایانی",
      message:
        "این نقطهٔ پایانی بلافاصله دریافت رویدادها را متوقف می‌کند. تحویل‌های موجود برای ممیزی حفظ می‌شوند. با ویرایش نقطهٔ پایانی می‌توانید دوباره فعالش کنید.",
      cancel: "انصراف",
      confirm: "غیرفعال‌سازی",
    },

    notAvailable: {
      title: "وب‌هوک‌ها در دسترس نیستند",
      description:
        "نقاط انتهایی وب‌هوک بخشی از قابلیت Developer Tools هستند که در طرح فعلی شما در دسترس نیست.",
      cta: "مشاهدهٔ طرح‌ها",
    },

    /* Seed endpoints. URLs are masked (origin + `/***`) just like the real
     * list view. The seed rows cover both visible statuses (active +
     * inactive) and a representative mix of event subscriptions. */
    endpoints: [
      {
        id: 1,
        url: "https://api.acme.com/***",
        events: ["otp.sent", "otp.verified", "otp.failed"],
        isActive: true,
        createdAtRelative: "2 weeks ago",
        lastUsedAtRelative: "3m ago",
      },
      {
        id: 2,
        url: "https://hooks.internal.acme.com/***",
        events: ["contact.created", "contact.updated", "nixify.event.received"],
        isActive: true,
        createdAtRelative: "5 days ago",
        lastUsedAtRelative: "12m ago",
      },
      {
        id: 3,
        url: "https://staging.acme.com/***",
        events: ["nixify.webhook.test"],
        isActive: true,
        createdAtRelative: "1 day ago",
        lastUsedAtRelative: "1h ago",
      },
      {
        id: 4,
        url: "https://legacy.acme.com/***",
        events: ["otp.sent"],
        isActive: false,
        createdAtRelative: "3 months ago",
        lastUsedAtRelative: "1mo ago",
      },
    ],

    /* Seed deliveries. Cover every visible status (delivered / failed /
     * pending) and exercise the retry, error, and code paths. */
    deliveries: [
      {
        deliveryId: "4a2d8c1e-7b3f-4e7b-9c1a-8b4f5e2d3a01",
        endpointId: 1,
        eventId: "otp.verified",
        status: "delivered",
        attempts: 1,
        responseCode: 200,
        createdAtRelative: "3m ago",
        lastError: null,
      },
      {
        deliveryId: "5b3e9d2f-8c4a-4f8c-ad2b-9c5f6e3d4b12",
        endpointId: 2,
        eventId: "contact.created",
        status: "delivered",
        attempts: 1,
        responseCode: 200,
        createdAtRelative: "12m ago",
        lastError: null,
      },
      {
        deliveryId: "6c4f1e3a-9d5b-4a9d-be3c-ad6f7e4e5c23",
        endpointId: 1,
        eventId: "otp.failed",
        status: "failed",
        attempts: 3,
        responseCode: 500,
        createdAtRelative: "1h ago",
        lastError: "max_attempts_exceeded",
      },
      {
        deliveryId: "7d5e2f4b-ae6c-4bae-cf4d-be7a8f5f6d34",
        endpointId: 3,
        eventId: "nixify.webhook.test",
        status: "pending",
        attempts: 0,
        responseCode: null,
        createdAtRelative: "just now",
        lastError: null,
      },
      {
        deliveryId: "8e6f3a5c-bf7d-4cbf-da5e-cf8b9a6a7e45",
        endpointId: 2,
        eventId: "contact.updated",
        status: "delivered",
        attempts: 1,
        responseCode: 200,
        createdAtRelative: "2h ago",
        lastError: null,
      },
      {
        deliveryId: "9f7a4b6d-c8e-4dcc-eb6f-da9cab7b8f56",
        endpointId: 1,
        eventId: "otp.sent",
        status: "failed",
        attempts: 2,
        responseCode: null,
        createdAtRelative: "3h ago",
        lastError: "timeout",
      },
    ],

    /* The signing secret revealed during the createEndpoint scene — local
     * demo data. NEVER a real secret. Looks like a real mg_whsec_ secret
     * (mg_whsec_ + ~32 url-safe chars). */
    revealedSecret: "mg_whsec_7c3b9f1e4a2d4e7b9c1a8b4f5e2d3a01",
    revealedUrl: "https://api.acme.com/hooks/nixify",
  },

  /* ─── Creative section copy ──────────────────────────────────────────── */
  creative: {
    /* 1. Event journey — event lifecycle from trigger to audit */
    eventJourney: {
      heading: "مسیر رویداد",
      subheading:
        "هر رویداد وب‌هوک از همان مسیر پیروی می‌کند: یک trigger در برنامه یک تحویل زمان‌بندی می‌کند، صف durable آن را به‌صورت atomic claim می‌کند، پردازشگر یک تلاش POST با هدرهای Nixify-Signature + Nixify-Event انجام می‌دهد، و تحویل در نقطهٔ پایانی شما فرود می‌آید (یا با backoff retry می‌شود). تحویل اصلی شواهد تغییرناپذیر است؛ replayها تحویل‌های جدیدی با امضاهای تازه ایجاد می‌کنند.",
      legendTitle: "کلید رنگ",
      legendItems: [
        { label: "سطح کاربر / API", tone: "ui" },
        { label: "تغییر وضعیت داخلی Nixify", tone: "state" },
        { label: "سمت پایین‌دست / گیرنده", tone: "downstream" },
      ],
      steps: [
        {
          badge: "01",
          title: "Trigger فعال می‌شود",
          body: "یک ارسال OTP، تأیید OTP، ایجاد مخاطب یا به‌روزرسانی مخاطب درون برنامه تکمیل می‌شود. برنامه تابع deliverWebhook(event, userId) را فراخوانی می‌کند — fire-and-forget (داخلی catch می‌کند تا پاسخ OTP هرگز مسدود نشود).",
          token: "POST /api/v1/otp/send",
          tone: "ui",
        },
        {
          badge: "02",
          title: "زمان‌بندی تحویل‌ها",
          body: "scheduleUserWebhookDeliveries نقاط انتهایی فعال را جایی که WebhookEndpoint.userId === userId است query می‌کند، بر اساس تطابق اشتراک فیلتر می‌کند (endpointMatchesEvent شامل «*» به‌عنوان wildcard است) و ردیف‌های WebhookDelivery(pending) + WebhookQueue(pending) را در یک تراکنش واحد ایجاد می‌کند. dedupeKey در DB یکتا است — P2002 یعنی یک درخواست همزمان از‌قبل این تحویل را زمان‌بندی کرده (ردکردن idempotent).",
          token: "scheduleUserWebhookDeliveries",
          tone: "state",
        },
        {
          badge: "03",
          title: "امضای payload",
          body: "برای هر نقطهٔ پایانی منطبق، راز برای محاسبهٔ امضا استفاده می‌شود: signedPayload = `${timestamp}.${payload}`; mac = HMAC-SHA256(secret, signedPayload).digest(\"hex\"); signature = `t=${timestamp},v1=${mac}`. امضا روی ردیف تحویل ذخیره می‌شود تا پردازشگر مجبور نباشد دوباره آن را محاسبه کند.",
          token: "signWebhook(secret, payload)",
          tone: "state",
        },
        {
          badge: "04",
          title: "Claim پردازشگر صف",
          body: "یک worker out-of-band تابع processWebhookQueue را فراخوانی می‌کند. ابتدا stale lockها را بازیابی می‌کند (کارهای در 'processing' با lockedAt قدیمی‌تر از 5min)، سپس یک batch محدود (MAX_BATCH_SIZE=25) را به‌صورت atomic از طریق updateMany WHERE status='pending' AND nextRetryAt <= NOW() claim می‌کند. فقط یک worker می‌تواند هر کار را ببرد.",
          token: "claimPendingJobs(25, workerId)",
          tone: "state",
        },
        {
          badge: "05",
          title: "SSRF re-validate + POST",
          body: "پیش از هر فراخوانی شبکه، validateWebhookDestination URL را مجدداً resolve می‌کند و محدوده‌های private / loopback / datacenter را رد می‌کند (کسی می‌توانست از زمان ایجاد DNS را روی شما تغییر دهد). POST با هدرهای Content-Type: application/json، Nixify-Signature و Nixify-Event ارسال می‌شود. redirect: \"error\" — بدون پیگیری redirect. timeout 10s.",
          token: "fetch(url, { method: 'POST', ...SAFE_FETCH_OPTIONS })",
          tone: "downstream",
        },
        {
          badge: "06",
          title: "طبقه‌بندی نتیجه + retry",
          body: "در 2xx، تحویل delivered علامت‌گذاری می‌شود + کار صف done علامت‌گذاری می‌شود. در صورت شکست، classifyFetchError خطا را به‌طور امن طبقه‌بندی می‌کند (network_error / timeout / http_4xx / http_5xx / ssrf_blocked) و یا یک retry با backoff نمایی (10s → 30s → 90s) زمان‌بندی می‌کند یا، اگر attempts >= maxRetries، تحویل را با lastError = max_attempts_exceeded ناموفق علامت‌گذاری می‌کند.",
          token: "classifyFetchError(err, httpStatus)",
          tone: "state",
        },
        {
          badge: "07",
          title: "ممیزی + replay",
          body: "ردیف تحویل شواهد تغییرناپذیر است: status، attempts، responseCode، lastError، deliveredAt. کارت Delivery history داشبورد این‌ها را برای کارآگاهی نشان می‌دهد. Replay (POST /deliveries/:deliveryId/replay) یک تحویل NEW با امضای تازه (راز فعلی + مهر زمانی تازه) ایجاد می‌کند — اصلی تغییر نمی‌کند.",
          token: "scheduleReplayDelivery(originalDeliveryId, userId)",
          tone: "downstream",
        },
      ],
      footnote:
        "همهٔ هفت مرحله در src/lib/dx/webhooks.ts پیاده‌سازی شده‌اند (deliverWebhook، scheduleUserWebhookDeliveries، signWebhook، processWebhookQueue، claimPendingJobs، classifyFetchError، scheduleReplayDelivery). داشبورد فقط از طریق مسیرهای src/app/api/dashboard/webhooks/ می‌خواند/می‌نویسد — هرگز مستقیماً بر جداول WebhookEndpoint / WebhookDelivery / WebhookQueue.",
      warningTitle: "Dispatch فقط-durable",
      warningBody:
        "همهٔ تحویل‌ها پیش از تحویل شبکه وارد صف می‌شوند. هیچ تلاش اول inline از مسیرهای درخواست برنامه‌ای وجود ندارد. این چیزی است که سیستم وب‌هوک را قابل‌اعتماد می‌کند: یک نقطهٔ پایانی کند یا پایین هرگز تحویل OTP را مسدود نمی‌کند، و یک crash پردازشگر میان batch توسط worker بعدی بازیابی می‌شود.",
    },

    /* 2. Endpoint anatomy — what's stored, what's masked, what's revealed */
    endpointAnatomy: {
      heading: "آناتومی نقطهٔ پایانی",
      subheading:
        "یک نقطهٔ پایانی وب‌هوک شش فیلد persisted دارد: id، url، events، secret، isActive و lastUsedAt مشتق‌شده. نمای فهرست URL را ماسک می‌کند (origin + `/***`) و هرگز راز را برنمی‌گرداند؛ نمای جزئیات URL کامل را برمی‌گرداند اما همچنان هرگز راز را برنمی‌گرداند. راز یک‌بار در پاسخ create یا rotate-secret نمایش داده می‌شود — Nixify برای امضای هر تحویل به آن به‌صورت plaintext نیاز دارد، اما هرگز پس از آن reveal یک‌باره از طریق API آن را برنمی‌گرداند.",
      fieldsTitle: "شش فیلد یک نقطهٔ پایانی",
      fields: [
        {
          key: "url",
          label: "URL",
          desc: "URL کامل https که Nixify به آن POST می‌کند. در زمان ایجاد و قبل از هر تحویل SSRF اعتبارسنجی می‌شود (در زمان تحویل مجدداً resolve می‌شود تا تغییرات DNS تشخیص داده شود). در نمای فهرست ماسک می‌شود (origin + `/***`)؛ URL کامل توسط GET /:id برگردانده می‌شود.",
          token: "https://api.acme.com/hooks/nixify",
          tone: "ui",
        },
        {
          key: "events",
          label: "رویدادها",
          desc: "اشتراک‌های رویداد با کاما پیوسته (فرمت ذخیره‌سازی). endpointMatchesEvent روی «,» تقسیم می‌کند و بررسی می‌کند آیا نوع رویداد در فهرست نتیجه است، یا آیا «*» وجود دارد (wildcard). 1-50 اشتراک، هر کدام حداکثر 100 کاراکتر.",
          token: "otp.sent,otp.verified,otp.failed",
          tone: "ui",
        },
        {
          key: "secret",
          label: "راز امضا",
          desc: "mg_whsec_ + 32 کاراکتر url-safe (randomBytes(24).toString(\"base64url\")). توسط signWebhook برای محاسبهٔ HMAC-SHA256(secret, `${timestamp}.${payload}`) استفاده می‌شود. به‌صورت plaintext روی ردیف WebhookEndpoint ذخیره می‌شود — Nixify برای امضای هر تحویل به آن نیاز دارد — اما هرگز پس از create یا rotate-secret از طریق API برگردانده نمی‌شود.",
          token: "mg_whsec_7c3b9f1e4a2d4e7b9c1a8b4f5e2d3a01",
          tone: "secret",
        },
        {
          key: "active",
          label: "پرچم فعال",
          desc: "boolean یعنی isActive. پردازشگر صف از نقاط انتهانی که isActive=false است عبور می‌کند. Deactivate (DELETE /:id) یک حذف نرم است — isActive=false را تنظیم می‌کند، ردیف + تحویل‌ها را برای ممیزی حفظ می‌کند. بررسی ظرفیت فقط نقاط انتهایی ACTIVE را می‌شمارد.",
          token: "isActive: true",
          tone: "storage",
        },
        {
          key: "dates",
          label: "ایجاد شده + آخرین استفاده",
          desc: "createdAt در زمان ایجاد تنظیم می‌شود. lastUsedAt از جدیدترین deliveredAt روی یک ردیف WebhookDelivery مشتق می‌شود (deliveredAt !== null). نمای فهرست هر دو را به‌صورت رشته‌های نسبی نشان می‌دهد؛ «never» وقتی lastUsedAt null است نشان داده می‌شود.",
          token: "createdAt · lastUsedAt",
          tone: "storage",
        },
        {
          key: "id",
          label: "شناسهٔ عددی",
          desc: "کلید اصلی عددی پایدار. در مسیرهای URL استفاده می‌شود (/api/dashboard/webhooks/:id) و به‌عنوان کلید خارجی روی WebhookDelivery.endpointId. deliveryId عمومی یک UUID جداگانه روی ردیف تحویل است.",
          token: "id: 1",
          tone: "storage",
        },
      ],
      matrixTitle: "نمای فهرست در برابر نمای جزئیات",
      matrixSubtitle:
        "نمای فهرست (GET /api/dashboard/webhooks) URL را ماسک می‌کند و هرگز راز را برنمی‌گرداند. نمای جزئیات (GET /:id) URL کامل را برمی‌گرداند اما همچنان هرگز راز را برنمی‌گرداند. راز فقط توسط POST (create) و POST /:id/rotate-secret برگردانده می‌شود — دقیقاً یک‌بار هر کدام.",
      matrixColDimension: "فیلد",
      matrixColListView: "نمای فهرست",
      matrixColDetailView: "نمای جزئیات",
      matrixRows: [
        {
          dimension: "URL",
          listView: "https://api.acme.com/***",
          detailView: "https://api.acme.com/hooks/nixify",
          tone: "ui",
        },
        {
          dimension: "رویدادها",
          listView: "otp.sent,otp.verified,otp.failed",
          detailView: "otp.sent,otp.verified,otp.failed",
          tone: "ui",
        },
        {
          dimension: "راز امضا",
          listView: "—",
          detailView: "—",
          tone: "secret",
        },
        {
          dimension: "پرچم فعال",
          listView: "isActive: true",
          detailView: "isActive: true",
          tone: "storage",
        },
        {
          dimension: "ایجاد شده / آخرین استفاده",
          listView: "2 weeks ago · 3m ago",
          detailView: "2 weeks ago · 3m ago",
          tone: "storage",
        },
        {
          dimension: "شناسهٔ عددی",
          listView: "id: 1",
          detailView: "id: 1",
          tone: "storage",
        },
      ],
      cycleTitle: "چرخهٔ create → reveal → sign → deliver → audit",
      cycleSubtitle:
        "هر نقطهٔ پایانی از همان چرخهٔ پنج‌مرحله‌ای پیروی می‌کند. راز کامل در طول عمر نقطهٔ پایانی به‌صورت plaintext روی سمت Nixify وجود دارد (برای امضای هر تحویل به آن نیاز است)، اما فقط در مرحلهٔ 1 (create) یا وقتی به‌صرت rotate می‌کنید از طریق API برگردانده می‌شود.",
      cycle: [
        {
          badge: "01",
          title: "Create",
          body: "POST /api/dashboard/webhooks با {url, events[]}. اعتبارسنجی SSRF در زمان ایجاد. بررسی ظرفیت (activeCount < plan quota). راز را یک‌بار در بدنهٔ پاسخ برمی‌گرداند.",
          token: "POST /api/dashboard/webhooks",
          tone: "ui",
        },
        {
          badge: "02",
          title: "Reveal یک‌باره",
          body: "دیالوگ secret راز mg_whsec_… را نشان می‌دهد. آن را پیش از بستن دیالوگ در یک مدیریتگر اسرار کپی کنید. Nixify آن را روی ردیف WebhookEndpoint ذخیره می‌کند؛ API هرگز دوباره آن را برنمی‌گرداند.",
          token: "mg_whsec_7c3b9f1e4a2d4e7b9c1a8b4f5e2d3a01",
          tone: "secret",
        },
        {
          badge: "03",
          title: "Sign",
          body: "هر بار یک رویداد مشترک فعال می‌شود، signWebhook(secret, payload, timestamp) تابع HMAC-SHA256(secret, `${timestamp}.${payload}`).digest(\"hex\") را محاسبه می‌کند و `t=${timestamp},v1=${hex}` را برمی‌گرداند. امضا روی ردیف تحویل ذخیره می‌شود.",
          token: "HMAC-SHA256(secret, `${t}.${payload}`)",
          tone: "storage",
        },
        {
          badge: "04",
          title: "Deliver",
          body: "پردازشگر صف کار را به‌صورت atomic claim می‌کند، SSRF را مجدداً اعتبارسنجی می‌کند و payload را با هدرهای Nixify-Signature + Nixify-Event POST می‌کند. redirect: \"error\". timeout 10s. در 2xx → delivered. در صورت شکست → classify + retry با backoff (10s → 30s → 90s).",
          token: "POST {url} · Nixify-Signature · Nixify-Event",
          tone: "deliver",
        },
        {
          badge: "05",
          title: "Audit + replay",
          body: "ردیف تحویل شواهد تغییرناپذیر است. Replay (POST /deliveries/:deliveryId/replay) یک تحویل NEW با امضای تازه ایجاد می‌کند — اصلی تغییر نمی‌کند. Rotate-secret (POST /:id/rotate-secret) ستون راز را بازنویسی می‌کند و راز جدید را یک‌بار برمی‌گرداند؛ امضاهای قدیمی بلافاصله تأیید نمی‌شوند.",
          token: "POST /:id/rotate-secret · POST /deliveries/:id/replay",
          tone: "storage",
        },
      ],
      footnote:
        "همهٔ شش فیلد روی جدول WebhookEndpoint persisted می‌شوند. قوانین ماسک‌کردن + هرگز‌برنگرداندن-راز توسط مسیرهای src/app/api/dashboard/webhooks/route.ts اعمال می‌شود (maskUrl + حذف صریح `secret` از پاسخ‌های GET). منطق امضا + تحویل در src/lib/dx/webhooks.ts است.",
      warningTitle: "راز یک‌بار نمایش داده می‌شود",
      warningBody:
        "Nixify برای امضای هر تحویل به راز به‌صورت plaintext نیاز دارد، بنابراین آن روی ردیف WebhookEndpoint ذخیره می‌شود — اما فقط در پاسخ POST (create) یا پاسخ POST /:id/rotate-secret از طریق API برگردانده می‌شود. اگر آن را گم کنید باید آن را rotate کنید — هیچ راه دیگری برای بازیابی آن وجود ندارد.",
    },

    /* 3. Signing & verification — HMAC-SHA256 signing explained */
    signingVerification: {
      heading: "امضا + تأیید",
      subheading:
        "هر تحویل وب‌هوک با HMAC-SHA256 با راز امضای نقطهٔ پایانی امضا می‌شود. هدر Nixify-Signature `t=<timestamp>,v1=<hex>` را حمل می‌کند — مهر زمانی از حملات replay جلوگیری می‌کند (پنجرهٔ تلورانس 5 دقیقه‌ای) و v1 هگز، HMAC `${timestamp}.${rawPayload}` است. گیرنده HMAC را با راز ذخیره‌شده دوباره محاسبه می‌کند و constant-time با v1 مقایسه می‌کند. هرگز بدون تأیید امضا به payload اعتماد نکنید.",
      signCard: {
        badge: "Sign",
        title: "سمت Nixify",
        body:
          "پیش از تحویل، Nixify امضا را با راز ذخیره‌شدهٔ نقطهٔ پایانی محاسبه می‌کند. payload امضاشده `${timestamp}.${rawPayload}` است — مهر زمانی گنجانده شده تا گیرنده بتواند replayها را رد کند.",
        bullets: [
          "signedPayload = `${timestamp}.${payload}`",
          "mac = HMAC-SHA256(secret, signedPayload).digest(\"hex\")",
          "signature = `t=${timestamp},v1=${mac}`",
          "روی ردیف WebhookDelivery ذخیره می‌شود؛ در هدر Nixify-Signature ارسال می‌شود",
        ],
      },
      verifyCard: {
        badge: "Verify",
        title: "سمت گیرنده",
        body:
          "هندلر شما هدر Nixify-Signature را تجزیه می‌کند، HMAC را با راز ذخیره‌شده دوباره محاسبه می‌کند و constant-time با v1 مقایسه می‌کند. در صورت شکست هر چیزی با 401 رد کنید — هرگز بدون تأیید به payload اعتماد نکنید.",
        bullets: [
          "تجزیهٔ `t=<ts>,v1=<hex>` از هدر Nixify-Signature",
          "رد اگر t یا v1 غایب باشند",
          "رد اگر |Date.now() - t| > 5 دقیقه (پنجرهٔ replay)",
          "expected = HMAC-SHA256(secret, `${t}.${rawPayload}`).digest(\"hex\")",
          "مقایسهٔ constant-time expected در برابر v1 — رد در عدم تطابق",
        ],
      },
      headersTitle: "هدرهای تحویل",
      headersSubtitle:
        "هر POST این سه هدر را حمل می‌کند. دو هدر اول (Nixify-Signature + Nixify-Event) برای تأیید و مسیریابی اجباری‌اند؛ سومی (Nixify-Delivery-Id) UUID عمومی برای idempotency / همبستگی replay است.",
      headerCol: "هدر",
      valueCol: "مثال",
      descCol: "حمل می‌کند",
      headers: [
        {
          header: "Nixify-Signature",
          value: "t=1700000000,v1=4a2d8c1e7b3f4e7b9c1a8b4f5e2d3a01",
          desc: "امضای HMAC-SHA256: `t=<unix-ms>,v1=<hex>`. با راز ذخیره‌شدهٔ نقطهٔ پایانی + بدنهٔ خام درخواست تأیید کنید.",
          tone: "sign",
        },
        {
          header: "Nixify-Event",
          value: "otp.verified",
          desc: "نوع پاکت رویداد (مثلاً otp.sent، otp.verified، contact.created، nixify.webhook.test). هندلر خود را روی این مسیریابی کنید — همچنین در فیلد `type` در payload است.",
          tone: "verify",
        },
        {
          header: "Nixify-Delivery-Id",
          value: "4a2d8c1e-7b3f-4e7b-9c1a-8b4f5e2d3a01",
          desc: "UUID عمومی برای تحویل. به‌عنوان کلید idempotency خود استفاده کنید — تحویل‌ها at-least-once هستند، پس همان deliveryId ممکن است دو بار برسد (نادر؛ بازیابی stale-lock).",
          tone: "id",
        },
      ],
      stepsTitle: "امضا + تأیید در کنار هم",
      steps: [
        {
          badge: "01",
          title: "ساخت payload امضاشده",
          body: "مهر زمانی unix-ms + \".\" + payload خام JSON را به‌عنوان رشته الحاق کنید. مهر زمانی گنجانده شده تا گیرنده بتواند replayهای خارج از پنجرهٔ 5 دقیقه را رد کند.",
          token: "signedPayload = `${timestamp}.${payload}`",
          tone: "sign",
        },
        {
          badge: "02",
          title: "محاسبهٔ HMAC",
          body: "از createHmac(\"sha256\", secret).update(signedPayload).digest(\"hex\") یعنی Node استفاده کنید. خروجی یک رشتهٔ هگز 64 کاراکتری با حروف کوچک است. راز مقدار mg_whsec_… نقطهٔ پایانی است — Nixify آن را به‌صورت plaintext ذخیره می‌کند تا این را در هر تحویل محاسبه کند.",
          token: "createHmac(\"sha256\", secret).update(signedPayload).digest(\"hex\")",
          tone: "sign",
        },
        {
          badge: "03",
          title: "قالب‌بندی هدر",
          body: "رشتهٔ `t=<timestamp>,v1=<hex>` را بسازید و در هدر Nixify-Signature بگذارید. گیرنده دقیقاً همین قالب را تجزیه می‌کند — روی «,» تقسیم کنید، سپس هر کدام را روی «=» تقسیم کنید.",
          token: "Nixify-Signature: t=1700000000,v1=4a2d…",
          tone: "sign",
        },
        {
          badge: "04",
          title: "تجزیهٔ هدر",
          body: "در سمت گیرنده، هدر Nixify-Signature را بخوانید، روی «,» تقسیم کنید، یک map {t, v1} بسازید. در صورت غایب بودن هر کدام یا عدد نبودن / خالی نبودن رشته با 401 رد کنید.",
          token: "Object.fromEntries(header.split(\",\").map(p => p.split(\"=\")))",
          tone: "verify",
        },
        {
          badge: "05",
          title: "بررسی پنجرهٔ تلورانس",
          body: "|Date.now() - t| را محاسبه کنید. اگر از 5 دقیقه (300000 ms) فراتر رفته، با 401 رد کنید. این پنجرهٔ حملات replay را محدود می‌کند — یک امضای ضبط‌شده پس از 5 دقیقه بی‌ارزش است.",
          token: "toleranceMs = 5 * 60 * 1000",
          tone: "guard",
        },
        {
          badge: "06",
          title: "مقایسهٔ constant-time",
          body: "expected = HMAC-SHA256(secret, `${t}.${rawRequestBody}`).digest(\"hex\") را دوباره محاسبه کنید. با v1 با یک حلقهٔ XOR constant-time مقایسه کنید — هرگز از === استفاده نکنید (حملات timing). در هر عدم تطابق بایت با 401 رد کنید.",
          token: "for (i) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i); return diff === 0",
          tone: "guard",
        },
      ],
      toleranceTitle: "پنجرهٔ تلورانس 5 دقیقه‌ای",
      toleranceBody:
        "verifyWebhookSignature اگر |Date.now() - t| > 5 * 60 * 1000 ms باشد رد می‌کند. این پنجرهٔ حملات replay را محدود می‌کند: یک امضای ضبط‌شده پس از 5 دقیقه بی‌ارزش است. مطمئن شوید ساعت سرور شما با NTP همگام است — انحراف ساعت > 5 دقیقه هر تحویل را رد می‌کند.",
      constantTimeTitle: "مقایسهٔ constant-time",
      constantTimeBody:
        "حلقهٔ مقایسه هر بایت expected در برابر v1 را XOR می‌کند و نتیجه را در یک پرچم `diff` واحد OR می‌کند. برگرداندن `diff === 0` از short-circuit جلوگیری می‌کند: حتی اولین بایت نامطبق همچنان طول کامل را iter می‌کند، تا یک مهاجم timing نتواند پیشوند یک امضای معتبر را یاد بگیرد.",
      footnote:
        "امضا در src/lib/dx/webhooks.ts پیاده‌سازی شده است (signWebhook + generateWebhookSecret). تأیید در همان فایل (verifyWebhookSignature) — می‌توانید این تابع را عیناً در گیرنده خود کپی کنید. تلورانس 5 دقیقه‌ای و مقایسهٔ constant-time اجباری‌اند؛ آن‌ها را تضعیف نکنید.",
      warningTitle: "در صورت شک به نفوذ rotate کنید",
      warningBody:
        "اگر شک دارید راز امضا نشت کرده (در یک IP غیرمنتظره ظاهر شده، یک شریک گزارش نقض می‌دهد، آن را در git commit کرده‌اید)، از طریق POST /:id/rotate-secret آن را rotate کنید. Nixify ستون را بازنویسی می‌کند و راز جدید را یک‌بار برمی‌گرداند — امضاهای قدیمی بلافاصله تأیید نمی‌شوند چون HMAC محاسبه‌شده دیگر با v1 در هدر مطابقت ندارد.",
    },

    /* 4. Delivery lifecycle — pending → processing → delivered/failed */
    deliveryLifecycle: {
      heading: "چرخهٔ حیات تحویل",
      subheading:
        "هر تحویل از یک چرخهٔ حیات 5 وضعیتی پیروی می‌کند که توسط پردازشگر صف هدایت می‌شود. تحویل‌های pending به‌صورت atomic claim می‌شوند (فقط یک worker هر کار را می‌برد)، با یک تلاش POST پردازش می‌شوند، و یا delivered (2xx) علامت‌گذاری می‌شوند یا برای retry با backoff نمایی (10s → 30s → 90s) زمان‌بندی می‌شوند. پس از maxRetries (پیش‌فرض 3)، تحویل با lastError = max_attempts_exceeded ناموفق علامت‌گذاری می‌شود. stale lockها به‌طور خودکار از طریق timeout 5 دقیقه‌ای بازیابی می‌شوند.",
      statesTitle: "وضعیت‌های تحویل",
      states: [
        {
          key: "pending",
          label: "در انتظار",
          desc: "وضعیت پیش‌فرض هنگام ایجاد. کار در WebhookQueue با status='pending' و nextRetryAt <= NOW() است. منتظر یک worker برای claim کردن atomic.",
          tone: "pending",
        },
        {
          key: "processing",
          label: "در حال پردازش",
          desc: "یک worker کار را claim کرده است (status='processing'، lockedAt=now، lockedBy=workerId). تلاش POST در جریان است. فقط یک worker می‌تواند در هر لحظه این وضعیت را برای هر کار نگه دارد.",
          tone: "active",
        },
        {
          key: "delivered",
          label: "تحویل‌شده",
          desc: "نقطهٔ پایانی 2xx برگردانده. status='done' روی کار صف، status='delivered' روی ردیف تحویل. deliveredAt + responseCode ضبط شده. وضعیت ترمینال — هیچ تلاش بعدی.",
          tone: "good",
        },
        {
          key: "failed",
          label: "ناموفق",
          desc: "یا max_attempts_exceeded (retryها مصرف شده، lastError=max_attempts_exceeded) یا endpoint_missing (نقطهٔ پایانی میان پرواز غیرفعال یا حذف شده). وضعیت ترمینال — اما همچنان می‌توانید برای ایجاد یک تحویل جدید replay کنید.",
          tone: "bad",
        },
        {
          key: "recovered",
          label: "بازیابی stale-lock",
          desc: "یک worker 'processing' را برای > 5min (STALE_LOCK_TIMEOUT_MS) نگه داشته. پاس processWebhookQueue بعدی آن را به pending بازنشانی می‌کند (با backoff اگر مصرف نشده) یا به failed (اگر attempts >= maxRetries). محافظ compare-and-swap از بازنشانی یک claim تازه جلوگیری می‌کند.",
          tone: "warn",
        },
      ],
      transitionsTitle: "گذارها",
      transitions: [
        {
          from: "pending",
          to: "processing",
          trigger: "Worker کار را claim می‌کند",
          token: "updateMany WHERE status='pending' AND nextRetryAt <= NOW()",
          tone: "claim",
        },
        {
          from: "processing",
          to: "delivered",
          trigger: "نقطهٔ پایانی 2xx برمی‌گرداند",
          token: "singleAttempt → res.ok",
          tone: "success",
        },
        {
          from: "processing",
          to: "pending",
          trigger: "نقطهٔ پایانی شکست می‌خورد + attempts < maxRetries",
          token: "backoff: 10s → 30s → 90s (Math.min(10_000 * 3^(n-1), 90_000))",
          tone: "failure",
        },
        {
          from: "processing",
          to: "failed",
          trigger: "نقطهٔ پایانی شکست می‌خورد + attempts >= maxRetries",
          token: "lastError: max_attempts_exceeded",
          tone: "exhaust",
        },
        {
          from: "processing",
          to: "pending",
          trigger: "بازیابی stale lock (lockedAt > 5min) + attempts < maxRetries",
          token: "recoverStaleLocks → بازنشانی به pending با backoff",
          tone: "recover",
        },
        {
          from: "processing",
          to: "failed",
          trigger: "بازیابی stale lock + attempts >= maxRetries",
          token: "recoverStaleLocks → علامت‌گذاری failed",
          tone: "exhaust",
        },
        {
          from: "processing",
          to: "failed",
          trigger: "نقطهٔ پایانی میان پرواز غیرفعال یا حذف شده",
          token: "lastError: endpoint_missing",
          tone: "exhaust",
        },
        {
          from: "processing",
          to: "failed",
          trigger: "URL مجدداً به محدودهٔ private / loopback / datacenter resolve شده",
          token: "lastError: ssrf_blocked",
          tone: "exhaust",
        },
      ],
      retryTitle: "Backoff نمایی",
      retryBody:
        "nextRetryAt هر retry = now + Math.min(BACKOFF_BASE_MS * 3^(attempts-1), 90_000). BACKOFF_BASE_MS = 10_000 (10s)، پس تلاش‌های 1 → 2 → 3 منتظر 10s → 30s → 90s می‌مانند. سقف 90s است — یک نقطهٔ پایانی بدرفتار نمی‌تواند یک تحویل را برای ساعت‌ها گروگان بگیرد. maxRetries از entitlement WEBHOOK_RETRIES مالک نقطهٔ پایانی (پیش‌فرض 3) resolve می‌شود — بنابراین توالی کامل retry 10s → 30s → 90s → failed است.",
      staleLockTitle: "بازیابی stale-lock",
      staleLockBody:
        "اگر یک worker میان پرواز crash کند (status='processing' اما فرآیند مرده است)، پاس processWebhookQueue بعدی کارهایی را که lockedAt < (now - 5min) است پیدا می‌کند و آن‌ها را بازنشانی می‌کند. محافظ compare-and-swap (WHERE lockedAt < cutoff) از یک رقبت جلوگیری می‌کند که در آن یک worker یک کار stale را می‌خواند، worker دیگری آن را بازیابی می‌کند، یک worker جدید آن را با یک lockedAt تازه claim می‌کند، و تلاش بازیابی قدیمی claim تازه را بازنشانی می‌کند.",
      footnote:
        "ماشین حالت کامل در src/lib/dx/webhooks.ts پیاده‌سازی شده است (processWebhookQueue، claimPendingJobs، recoverStaleLocks، processOneJob، markJobFailed، singleAttempt). MAX_BATCH_SIZE = 25 — هر پاس worker حداکثر 25 کار پردازش می‌کند. workerها out-of-band هستند (cron / فرآیند جداگانه / edge function)؛ مسیر درخواست برنامه‌ای فقط تحویل‌ها را زمان‌بندی می‌کند.",
      warningTitle: "Replay یک تحویل NEW ایجاد می‌کند",
      warningBody:
        "Replay (POST /deliveries/:deliveryId/replay) تحویل اصلی را گذار نمی‌دهد — یک تحویل NEW با امضای تازه (راز فعلی + مهر زمانی تازه) و یک deliveryId جدید ایجاد می‌کند. اصلی شواهد تغییرناپذیرِ آنچه تلاش شده و چه زمانی است. به همین دلیل replay از یک endpoint جداگانه استفاده می‌کند، نه یک گذار وضعیت روی اصلی.",
    },
  },
};
