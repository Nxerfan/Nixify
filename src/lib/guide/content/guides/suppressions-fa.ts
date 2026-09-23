/**
 * UX-B: Suppressions guide — Persian content dictionary.
 *
 * همان استاندارد محتوای انگلیسی، با ترجمهٔ روان و وفادار.
 * توکن‌های فنی (آدرس‌های ایمیل، کدهای reason مثل manual/unsubscribe/
 * hard_bounce/complaint، کدهای source مثل dashboard/api/unsubscribe/
 * system، شناسه‌های عمومی suppression مثل sup_abc123، مهرهای زمانی ISO،
 * NON_LIFTABLE_BY_RESUBSCRIBE، also_subscribe، نام متدهای HTTP) به‌صورت
 * رشتهٔ خام ذخیره می‌شوند و در زمان رندر توسط <Ltr> به‌صورت
 * چپ‌به‌راست نمایش داده می‌شوند.
 *
 * دقت محتوایی (بازرسی مجدد در این پاس):
 *   - صفحهٔ واقعی Suppressions یک لیست ایمیل با نشان reason
 *     (REASON_LABELS: unsubscribe / manual / hard_bounce / complaint)،
 *     نشان source (SOURCE_LABELS: dashboard / api / unsubscribe / system)،
 *     نشان وضعیت Active یا Lifted (فعال=rose، لغو‌شده=slate)، خط
 *     زمان‌سنج Created/Lifted و دکمهٔ Lift روی ردیف‌های فعال نشان
 *     می‌دهد.
 *   - دیالوگ افزودن فقط یک ایمیل می‌گیرد و با reason = manual
 *     POST می‌کند (سخت‌کد شده — API اجازهٔ manual|unsubscribe را می‌دهد
 *     اما داشبورد همیشه manual می‌نویسد).
 *   - دیالوگ Lift (AlertDialog) عنوان شامل ایمیل، توضیح صریح مبنی بر
 *     «Lifting alone does NOT resubscribe»، و یک چک‌باکس «Also
 *     subscribe this contact to marketing (explicit consent)» نشان
 *     می‌دهد. دکمهٔ تأیید هنگام تیک‌خوردن چک‌باکس emerald و در غیر
 *     این صورت rose می‌شود.
 *   - نقطهٔ پایانی lift به‌صورت POST /api/dashboard/suppressions/{id}
 *     با { also_subscribe?: boolean (پیش‌فرض false) } است. POST (نه
 *     DELETE) چون lifting یک انتقال وضعیت با تاریخچهٔ ممیزی است.
 *   - مدل رضایت (src/lib/consent/service.ts):
 *       * چهار reason: manual، unsubscribe، hard_bounce، complaint.
 *       * NON_LIFTABLE_BY_RESUBSCRIBE = { hard_bounce, complaint }.
 *         Subscribe برای این‌ها ResubscribeBlockedError پرتاب می‌کند.
 *       * manual و unsubscribe با resubscribe عادی قابل‌لغو هستند.
 *       * Lift فقط SuppressionEntry را غیرفعال می‌کند. marketing_status
 *         را تغییر نمی‌دهد. با alsoSubscribe: true به‌صورت اتمیک lift +
 *         subscribe انجام می‌شود.
 *   - ناموساری eligibility: eligible = marketing_status === subscribed
 *     و فعلاً suppress نشده. یک مخاطب مشترک می‌تواند suppress شده
 *     باشد (eligible = false). یک مخاطب لغو اشتراک‌شده می‌تواند
 *     suppress نشده باشد (eligible = false — دروازهٔ marketing_status
 *     رد می‌شود). دو دروازه مستقل هستند؛ هر دو باید بگذرند.
 *
 * این دیکشنری همچنین شامل:
 *   - stage: رشته‌های انسانی صفحهٔ شبیه‌سازی‌شدهٔ SuppressionsStage به
 *     فارسی.
 *   - creative: محتوای چهار بخش خلاقانه (کالبدشناسی دلیل، فعال در
 *     برابر لغو‌شده، درخت تصمیم ایمن، رابطهٔ eligibility).
 * که همگی از طریق SuppressionsGuideContent تایپ می‌شوند.
 */

import type { SuppressionsGuideContent } from "./suppressions-types";

export const suppressionsFa: SuppressionsGuideContent = {
  slug: "suppressions",
  routeKey: "suppressions",
  backHref: "/dashboard/suppressions",
  stepCount: 6,
  durationMin: 4,
  category: "audience",
  dashboardRoute: "/dashboard/suppressions",
  title: "Suppressions",
  description:
    "مدیریت عدم‌ارسال بازاریابی: افزودن ورودی‌های دستی، لغو فعال‌ها و درک چرایی عدم‌قابلیت لغو hard_bounce و complaint با resubscribe عادی.",
  chapters: [
    {
      id: "intro",
      title: "Suppressions",
      steps: [
        {
          id: "suppressionsOverview",
          caption:
            "این لیست Suppressions است. هر ردیف یک ایمیل با نشان reason (Manual، Unsubscribe، Hard bounce، Complaint)، نشان source، نشان وضعیت Active یا Lifted و دکمهٔ Lift فقط روی ردیف‌های فعال است.",
          duration: 7000,
          scene: "suppressionsOverview",
        },
        {
          id: "createSuppression",
          caption:
            "برای افزودن یک عدم‌ارسال دستی، «Suppress email» را بزنید. دیالوگ فقط یک ایمیل می‌گیرد — reason پیش‌فرض manual است. ذخیره یک SuppressionEntry می‌نویسد و مخاطب را لغو اشتراک نمی‌کند. پیام‌های تراکنشی موجود تحت تأثیر قرار نمی‌گیرند.",
          duration: 7500,
          scene: "createSuppression",
          typedText: "spammer@example.com",
        },
        {
          id: "liftConfirmation",
          caption:
            "روی یک ردیف فعال، Lift را بزنید. دیالوگ تأیید، ورودی عدم‌ارسال را غیرفعال می‌کند. لغو به‌تنهایی مخاطب را مشترک نمی‌کند — marketing_status مخاطب تغییر نمی‌کند.",
          duration: 7500,
          scene: "liftConfirmation",
        },
        {
          id: "alsoSubscribeChecked",
          caption:
            "برای ترکیب اتمیک lift + subscribe، «Also subscribe this contact to marketing» را تیک بزنید. دکمهٔ تأیید emerald می‌شود. وقتی گیرنده صریحاً درخواست بازگشت به بازاریابی کرده و دلیل manual یا unsubscribe است، از این مسیر استفاده کنید.",
          duration: 7500,
          scene: "alsoSubscribeChecked",
        },
        {
          id: "nonLiftableReview",
          caption:
            "عدم‌ارسال‌های hard_bounce و complaint به‌صورت NON_LIFTABLE_BY_RESUBSCRIBE هستند. این‌ها سیگنال‌های provider-driven هستند — ارائه‌دهندهٔ صندوق گیرنده به ما گفته ارسال را متوقف کنیم. داشبورد همچنان می‌تواند ورودی را lift کند، اما یک فراخوانی Subscribe عادی از جای دیگر رد می‌شود.",
          duration: 8000,
          scene: "nonLiftableReview",
        },
        {
          id: "liftedState",
          caption:
            "پس از lift، نشان وضعیت ردیف به Lifted تغییر می‌کند، دکمهٔ Lift ناپدید می‌شود و یک مهر زمانی Lifted به مهر Created می‌پیوندد. تاریخچهٔ ممیزی رویداد lifted را نگه می‌دارد — lifting یک انتقال وضعیت است، نه یک حذف.",
          duration: 7000,
          scene: "liftedState",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "خواندن لیست عدم‌ارسال",
      body: "صفحهٔ Suppressions هر ورودی عدم‌ارسال حساب شما را فهرست می‌کند. هر ردیف ایمیل، نشان reason (Manual، Unsubscribe، Hard bounce یا Complaint)، نشان source (Dashboard، API، Unsubscribe link یا System)، نشان وضعیت Active یا Lifted و یک خط زمان‌سنج را نشان می‌دهد. ردیف‌های فعال دکمهٔ Lift دارند؛ ردیف‌های لغو‌شده هیچ عملی ندارند.",
    },
    {
      title: "جست‌وجو و فیلتر",
      body: "برای فیلتر بر اساس ایمیل از کادر جست‌وجو استفاده کنید. دکمهٔ toggle بین «فقط فعال‌ها» (پیش‌فرض — فقط ورودی‌های فعال) و «همه» (هر ورودی، شامل لغو‌شده‌ها) جابه‌جا می‌شود. فیلتر سمت کلاینت است: هر جست‌وجو با پارامترهای activeOnly و search دوباره API را فراخوانی می‌کند.",
    },
    {
      title: "افزودن عدم‌ارسال دستی",
      body: "برای باز کردن دیالوگ Add، «Suppress email» را بزنید. یک ایمیل وارد کرده و تأیید کنید. دیالوگ با reason = manual (سخت‌کد شده — API اجازهٔ manual یا unsubscribe می‌دهد، اما داشبورد برای عدم‌ارسال آغاز‌شده توسط اپراتور همیشه manual می‌نویسد) POST می‌کند. ذخیره یک SuppressionEntry با active = true می‌سازد. این کار marketing_status مخاطب را تغییر نمی‌دهد — یک مخاطب مشترک مشترک می‌ماند اما برای بازاریابی eligible نمی‌شود (eligible = false هنگام suppress).",
    },
    {
      title: "لغو یک عدم‌ارسال",
      body: "روی یک ردیف فعال، Lift را بزنید. دیالوگ تأیید ورودی را غیرفعال می‌کند: active به false برمی‌گردد، liftedAt تنظیم می‌شود و یک ردیف SuppressionEvent(lifted) به تاریخچهٔ ممیزی اضافه می‌شود. لغو به‌تنهایی مخاطب را مشترک نمی‌کند. این دکمه از POST (نه DELETE) استفاده می‌کند چون lifting یک انتقال وضعیت با تاریخچهٔ ممیزی است، نه یک حذف مخرب.",
    },
    {
      title: "اتمیک lift + subscribe",
      body: "برای ترکیب lift + subscribe در یک فراخوانی اتمیک، «Also subscribe this contact to marketing (explicit consent)» را تیک بزنید. نقطهٔ پایانی POST /api/dashboard/suppressions/{id} با also_subscribe: true دریافت می‌کند. سرویس رضایت قفل mutation کانونی را می‌گیرد، عدم‌ارسال را lift می‌کند و marketing_status = subscribed را در همان تراکنش تنظیم می‌کند. وقتی گیرنده صریحاً درخواست بازگشت به بازاریابی کرده و دلیل manual یا unsubscribe است، از این مسیر استفاده کنید.",
    },
    {
      title: "احترام به دلایل غیرقابل‌لغو",
      body: "عدم‌ارسال‌های hard_bounce و complaint به‌صورت NON_LIFTABLE_BY_RESUBSCRIBE هستند. این‌ها سیگنال‌های provider-driven هستند (ارائه‌دهندهٔ صندوق گیرنده به ما گفته ارسال را متوقف کنیم). دکمهٔ Lift داشبورد همچنان روی آن‌ها کار می‌کند — اما یک فراخوانی Subscribe عادی از جای دیگر (صفحهٔ Contacts، API، خودکارسازی) با ResubscribeBlockedError رد می‌شود. Lift کردن آن‌ها نیازمند تصمیم صریح و خارج از باند است، نه کلیک resubscribe روتین.",
    },
  ],
  whyWhen: [
    {
      title: "چه‌زمانی از عدم‌ارسال دستی استفاده کنیم",
      body: "وقتی می‌خواهید ارسال بازاریابی به یک آدرس را بدون حذف مخاطب متوقف کنید، از عدم‌ارسال دستی استفاده کنید. موارد رایج: گیرنده از شما خواست ارسال را متوقف کنید اما لینک لغو اشتراک شما را نزد؛ یک مشتری churn کرده و می‌خواهید او را در CRM خود suppress کنید؛ یک عضو تیم داخلی در حال آزمایش است و می‌خواهید آدرس او را ساکت کنید. مخاطب در لیست شما می‌ماند و کاملاً قابل‌بازرسی است؛ فقط eligibility بازاریابی او باطل می‌شود.",
    },
    {
      title: "چرا lift به‌طور خودکار subscribe نمی‌کند",
      body: "Lift ورودی عدم‌ارسال را غیرفعال می‌کند. Subscribe برابر marketing_status = subscribed تنظیم می‌کند. این‌ها عملیات متفاوتی هستند که رویدادهای ممیزی متفاوتی تولید می‌کنند. ترکیب خاموش آن‌ها در هر lift، تمایز بین «دیگر نمی‌خواهم این ایمیل suppress شود» و «می‌خواهم این مخاطب را مشترک کنم» را از بین می‌برد — همان تمایزی که CAN-SPAM و GDPR به آن اهمیت می‌دهند. چک‌باکس رضایت را صریح و قابل‌ممیزی می‌کند.",
    },
    {
      title: "چرا hard_bounce و complaint با resubscribe قابل‌لغو نیستند",
      body: "hard bounce یعنی ارائه‌دهندهٔ صندوق گیرنده پیام را به‌طور دائم رد کرده (آدرس وجود ندارد، صندوق غیرفعال است). complaint یعنی گیرنده در صندوق خود «Mark as spam» را زده. هر دو سیگنال‌های provider-driven هستند که صندوق گیرنده نمی‌خواهد ایمیل شما را بپذیرد. اشتراک مجدد یک مخاطب با یکی از این عدم‌ارسال‌های فعال صرفاً یک bounce یا complaint دیگر تولید می‌کند — به اعتبار فرستندهٔ شما آسیب می‌زند و ریسک throttling در سطح provider را افزایش می‌دهد. سیستم resubscribe را رد می‌کند و عدم‌ارسال را فعال نگه می‌دارد.",
    },
  ],
  mistakes: [
    {
      title: "اشتباه گرفتن «Suppress» با «Unsubscribe»",
      body: "Suppress کردن یک ایمیل یک SuppressionEntry با reason = manual می‌نویسد. این کار marketing_status را تغییر نمی‌دهد. Unsubscribe کردن، marketing_status را برابر unsubscribed تنظیم می‌کند و یک SuppressionEntry با reason = unsubscribe می‌نویسد. یک مخاطب مشترک می‌تواند suppress شود (eligible = false) بدون آنکه لغو اشتراک شده باشد. این دو دروازه مستقل هستند؛ suppress کردن به‌تنهایی marketing_status را تغییر نمی‌دهد.",
    },
    {
      title: "انتظار auto-subscribe روی Lift",
      body: "Lift فقط ورودی عدم‌ارسال را غیرفعال می‌کند. marketing_status تغییر نمی‌کند. اگر یک عدم‌ارسال را روی مخاطبی با marketing_status = unsubscribed lift کنید، او همچنان لغو اشتراک‌شده است — eligible همچنان false است. برای فعال‌سازی مجدد بازاریابی، چک‌باکس «Also subscribe» را در دیالوگ lift (lift + subscribe اتمیک) تیک بزنید، یا پس از lift مخاطب را جداگانه subscribe کنید.",
    },
    {
      title: "تلاش برای resubscribe یک hard_bounce یا complaint",
      body: "یک فراخوانی Subscribe عادی روی مخاطبی با عدم‌ارسال فعال hard_bounce یا complaint با ResubscribeBlockedError رد می‌شود. عدم‌ارسال فعال می‌ماند. دکمهٔ Lift داشبورد مسیر صریح خارج از باند است — آگاهانه از آن استفاده کنید، نه تصادفی. اگر گیرنده پس از bounce واقعاً می‌خواهد بازگردد، آدرس زیرین را قبل از lift اصلاح کنید.",
    },
    {
      title: "در نظر گرفتن عدم‌ارسال‌های لغو‌شده به‌عنوان حذف‌شده",
      body: "Lift ورودی را غیرفعال می‌کند؛ آن را حذف نمی‌کند. تاریخچهٔ ممیزی رویداد lifted را با مهر زمانی نگه می‌دارد. ردیف در لیست می‌ماند (زمانی که «همه» انتخاب شده باشد قابل‌مشاهده است). اگر به صفحهٔ پاک نیاز دارید، مسیر درست این است که هرگز ورودی لغو‌شده را دوباره suppress نکنید — تاریخچهٔ ممیزی بماند.",
    },
    {
      title: "فرض بر اینکه دیالوگ Add اجازهٔ انتخاب reason را می‌دهد",
      body: "دیالوگ فقط یک ایمیل می‌گیرد. داشبورد در بدنهٔ POST مقدار reason = manual را سخت‌کد می‌کند. API اجازهٔ manual یا unsubscribe می‌دهد، اما برای نوشتن یک عدم‌ارسال unsubscribe از طریق رابط کاربری داشبورد، مخاطب را از صفحهٔ Contacts لغو اشتراک کنید (که marketing_status = unsubscribed و عدم‌ارسال را با هم می‌نویسد). دیالوگ فقط برای عدم‌ارسال‌های دستی است.",
    },
  ],
  proTips: [
    {
      title: "پیش از lift از «Showing all» استفاده کنید",
      body: "پیش از lift یک عدم‌ارسال، فیلتر را به «Showing all» تغییر دهید و ایمیل را جست‌وجو کنید. اگر از قبل یک ورودی lifted می‌بینید، ممکن است مخاطب چند بار suppress و lift شده باشد — تاریخچهٔ ممیزی منبع حقیقت است، نه فقط آخرین وضعیت فعال.",
    },
    {
      title: "ترجیح lift + subscribe بر lift-then-subscribe",
      body: "وقتی می‌خواهید بازاریابی را برای مخاطب فعال کنید، در دیالوگ lift «Also subscribe» را تیک بزنید، به‌جای lift جداگانه و سپس subscribe. مسیر اتمیک قفل mutation کانونی را برای کل انتقال نگه می‌دارد و یک زنجیرهٔ ممیزی منسجم می‌نویسد. دو فراخوانی جداگانه می‌توانند با سایر عملیات رضایت روی همان مخاطب رقابت کنند.",
    },
    {
      title: "پیش از lift، hard_bounce را بررسی کنید",
      body: "یک عدم‌ارسال hard_bounce معمولاً یعنی آدرس اشتباه یا از بین رفته است. پیش از lift، بررسی کنید آیا ایمیل مخاطب یک غلط املایی است (رایج — .con به‌جای .com)، یک آدرس بازیافتی، یا یک صندوق بسته است. lift یک hard bounce واقعی در ارسال بعدی bounce دیگری تولید می‌کند و به اعتبار فرستندهٔ شما آسیب می‌زند.",
    },
    {
      title: "عدم‌ارسال complaint را مقدس بدانید",
      body: "complaint یعنی گیرنده «Mark as spam» را زده — این سیگنالی قوی‌تر از unsubscribe است. یک عدم‌ارسال complaint را آسان‌نبینید و lift نکنید. اگر واقعاً باید (مثلاً گیرنده‌ای که شکایت کرده سپس از طریق double opt-in تأییدشده دوباره درگیر شده)، دلیل را مستند کنید و آگاهانه lift کنید.",
    },
  ],
  troubleshooting: [
    {
      title: "Suppressions در دسترس نیست",
      body: "اگر «Contacts not available» می‌بینید، طرح شما شامل قابلیت Contacts نیست. مدیریت عدم‌ارسال بخشی از Contacts است — هم صفحهٔ لیست و هم رابط API همان entitlement را بررسی می‌کنند. طرح خود را ارتقا دهید. پاسخ 403 با code = feature_not_available است.",
    },
    {
      title: "Subscribe با ResubscribeBlockedError رد شد",
      body: "مخاطب یک عدم‌ارسال فعال hard_bounce یا complaint داشت. این‌ها NON_LIFTABLE_BY_RESUBSCRIBE هستند — سرویس رضایت به‌جای lift خاموش، پرتاب می‌کند. برای فعال‌سازی مجدد بازاریابی برای این مخاطب، عدم‌ارسال را به‌صورت صریح از طریق دکمهٔ Lift داشبورد (یا POST /api/dashboard/suppressions/{id} از API) lift کنید. اگر دلیل hard_bounce بود، ابتدا مشکل آدرس زیرین را اصلاح کنید.",
    },
    {
      title: "ردیف لغو‌شده همچنان دکمهٔ Lift نشان نمی‌دهد",
      body: "ردیف‌های لغو‌شده active = false دارند؛ دکمهٔ Lift فقط هنگام active = true نشان داده می‌شود. برای suppress مجدد یک ایمیل لغو‌شده، از دکمهٔ «Suppress email» در بالا استفاده کنید — یک SuppressionEntry دستی جدید می‌نویسد. ورودی لغو‌شده در تاریخچهٔ ممیزی می‌ماند؛ به فعال برنمی‌گردد.",
    },
    {
      title: "دکمهٔ Lift روی یک ردیف وجود ندارد",
      body: "دکمهٔ Lift فقط روی ردیف‌های فعال ظاهر می‌شود. اگر نشان وضعیت ردیف «Lifted» (slate، نه rose) باشد، عدم‌ارسال از قبل غیرفعال است — هیچ عملی موجود نیست. اگر نشان وضعیت «Active» است اما دکمهٔ Lift قابل‌مشاهده نیست، صفحه را refresh کنید؛ ممکن است وضعیت ردیف از زمان بارگذاری لیست تغییر کرده باشد.",
    },
    {
      title: "also-subscribe تغییر marketing_status نداد",
      body: "اگر «Also subscribe» را تیک کردید اما marketing_status مخاطب همچنان unsubscribed است، ممکن است مخاطب در حساب شما وجود نداشته باشد (عدم‌ارسال‌ها tenant-scoped با ایمیل هستند؛ رکورد مخاطب یک ردیف جداگانه است). Lift + subscribe در صورت عدم وجود یک ردیف مخاطب می‌سازد و marketing_status = subscribed را تنظیم می‌کند. از صفحهٔ Contacts با جست‌وجوی ایمیل، آن را تأیید کنید.",
    },
    {
      title: "جست‌وجو نتیجه‌ای ندارد ولی ایمیل suppress شده است",
      body: "دکمهٔ toggle فیلتر را بررسی کنید. اگر «Showing active only» انتخاب شده، ورودی‌های لغو‌شده حتی اگر با جست‌وجو مطابقت دارند پنهان می‌شوند. به «Showing all» تغییر دهید و جست‌وجو را دوباره اجرا کنید. پارامتر activeOnly=true سمت سرور اعمال می‌شود.",
    },
  ],
  checklist: [
    { label: "نشان reason ردیف با دلیل عدم‌ارسال مورد انتظار مطابقت دارد (Manual / Unsubscribe / Hard bounce / Complaint)" },
    { label: "ردیف فعال دکمهٔ Lift دارد؛ ردیف لغو‌شده هیچ عملی ندارد" },
    { label: "دیالوگ Add فقط یک ایمیل می‌گیرد — reason پیش‌فرض manual است" },
    { label: "چک‌باکس «Also subscribe» در دیالوگ Lift پیش‌فرض بدون تیک است (lift ≠ subscribe)" },
    { label: "عدم‌ارسال‌های hard_bounce و complaint به‌صورت NON_LIFTABLE_BY_RESUBSCRIBE هستند" },
    { label: "ردیف‌های لغو‌شده یک مهر زمانی Lifted در کنار مهر Created نشان می‌دهند" },
  ],
  whatNext:
    "پس از lift یک عدم‌ارسال، بازگشت eligibility بازاریابی مخاطب را در صفحهٔ Contacts ببینید (eligible = true هنگامی که marketing_status = subscribed و فعلاً suppress نشده باشد). از Sent Emails برای بررسی تحویل‌های جداگانه و تأیید دریافت بازاریابی توسط مخاطب استفاده کنید. با تاریخچهٔ ممیزی (از طریق لاگ سرویس رضایت) زنجیرهٔ کامل انتقال را ردیابی کنید.",
  related: [
    { label: "داشبورد Suppressions", href: "/dashboard/suppressions" },
    { label: "راهنمای مخاطبان", href: "/guide/contacts" },
    { label: "راهنمای ارسال انبوه", href: "/guide/broadcasts" },
  ],

  /* ─── Stage copy ──────────────────────────────────────────────────────── */
  stage: {
    dir: "rtl",
    locale: "fa",

    header: {
      title: "فهرست عدم‌ارسال",
      addSuppression: "عدم ارسال ایمیل",
    },

    card: {
      title: "فهرست عدم‌ارسال",
      subtitle:
        "لیست عدم ارسال بازاریابی. ایمیل‌های عدم‌ارسال‌شده از eligibility بازاریابی حذف می‌شوند.",
    },

    search: {
      placeholder: "جست‌وجو با ایمیل…",
    },

    filter: {
      showingActiveOnly: "فقط فعال‌ها",
      showingAll: "همه",
    },

    reasonLabels: {
      manual: "دستی",
      unsubscribe: "لغو اشتراک",
      hard_bounce: "Hard bounce",
      complaint: "Complaint",
    },

    sourceLabels: {
      dashboard: "داشبورد",
      api: "API",
      unsubscribe: "لینک لغو اشتراک",
      system: "سیستم",
    },
    sourcePrefix: "منبع",

    state: {
      active: "فعال",
      lifted: "لغو‌شده",
    },

    timestamps: {
      created: (when) => `ایجاد شده ${when}`,
      lifted: (when) => `لغو شده ${when}`,
      joined: (created, lifted) =>
        lifted
          ? `ایجاد شده ${created} · لغو شده ${lifted}`
          : `ایجاد شده ${created}`,
    },

    actions: {
      lift: "لغو",
      noAction: "—",
    },

    empty: "هیچ عدم‌ارسالی یافت نشد. یکی در بالا اضافه کنید یا فیلتر را تغییر دهید.",

    pagination: {
      pageOf: (page, total) => `صفحه ${page} · ${total} مجموع`,
      prev: "قبلی",
      next: "بعدی",
    },

    notAvailable: {
      title: "Contacts در دسترس نیست",
      description:
        "مدیریت عدم‌ارسال بخشی از قابلیت Contacts است که در طرح فعلی شما موجود نیست.",
      cta: "مشاهده طرح‌ها",
    },

    addDialog: {
      title: "افزودن عدم‌ارسال دستی",
      description:
        "یک ایمیل را از بازاریابی suppress کنید. مخاطب منطبق بر این ایمیل (در صورت وجود) نیز لغو اشتراک خواهد شد. پیام‌های تراکنشی موجود تحت تأثیر قرار نمی‌گیرند.",
      emailLabel: "ایمیل",
      emailPlaceholder: "user@example.com",
      cancel: "انصراف",
      submit: "عدم ارسال",
      submitting: "در حال عدم ارسال…",
    },

    liftDialog: {
      title: (email) => `لغو عدم‌ارسال برای ${email}؟`,
      description:
        "این کار ورودی عدم‌ارسال را غیرفعال می‌کند. لغو به‌تنهایی مخاطب را مشترک نمی‌کند — برای subscribe صریح، چک‌باکس زیر را تیک بزنید. سپس مخاطب برای پیام‌های بازاریابی eligible می‌شود.",
      alsoSubscribeLabel:
        "همچنین این مخاطب را در بازاریابی مشترک کن (رضایت صریح)",
      cancel: "انصراف",
      confirmLiftOnly: "لغو عدم‌ارسال",
      confirmLiftAndSubscribe: "لغو + اشتراک",
      submitting: "در حال لغو…",
      footnote:
        "POST /api/dashboard/suppressions/{suppressionId} با also_subscribe (پیش‌فرض false). اتمیک تحت قفل mutation کانونی.",
      nonLiftableWarningTitle: "عدم‌ارسال provider-driven",
      nonLiftableWarningBody:
        "دلیل این ورودی hard_bounce یا complaint است — NON_LIFTABLE_BY_RESUBSCRIBE. یک فراخوانی Subscribe عادی از جای دیگر رد می‌شود؛ تنها Lift صریح اینجا آن را غیرفعال می‌کند.",
    },

    /* Seed suppressions — local demo data only. NEVER fetched from the API. */
    entries: [
      {
        id: 1,
        suppressionId: "sup_manual_spammer",
        email: "spammer@example.com",
        reason: "manual",
        source: "dashboard",
        active: true,
        createdAtRelative: "2 ساعت پیش",
        liftedAtRelative: null,
      },
      {
        id: 2,
        suppressionId: "sup_unsub_alice",
        email: "alice@example.com",
        reason: "unsubscribe",
        source: "unsubscribe",
        active: true,
        createdAtRelative: "1 روز پیش",
        liftedAtRelative: null,
      },
      {
        id: 3,
        suppressionId: "sup_bounce_bob",
        email: "bob@closed-mailbox.test",
        reason: "hard_bounce",
        source: "system",
        active: true,
        createdAtRelative: "3 روز پیش",
        liftedAtRelative: null,
      },
      {
        id: 4,
        suppressionId: "sup_complaint_carol",
        email: "carol@example.org",
        reason: "complaint",
        source: "system",
        active: true,
        createdAtRelative: "5 روز پیش",
        liftedAtRelative: null,
      },
      {
        id: 5,
        suppressionId: "sup_manual_eve",
        email: "eve@example.com",
        reason: "manual",
        source: "api",
        active: false,
        createdAtRelative: "8 روز پیش",
        liftedAtRelative: "6 روز پیش",
      },
      {
        id: 6,
        suppressionId: "sup_unsub_dan",
        email: "dan@example.com",
        reason: "unsubscribe",
        source: "dashboard",
        active: false,
        createdAtRelative: "12 روز پیش",
        liftedAtRelative: "10 روز پیش",
      },
    ],
  },

  /* ─── Creative section copy ──────────────────────────────────────────── */
  creative: {
    /* 1. Suppression reason anatomy — the four reason codes decoded */
    reasonAnatomy: {
      heading: "کالبدشناسی چهار دلیل عدم‌ارسال",
      subheading:
        "هر ورودی عدم‌ارسال یک reason code دارد. دلیل به شما می‌گوید چه کسی این عدم‌ارسال را نوشته، آیا با resubscribe عادی قابل‌لغو است، و اگر تلاش کنید چه می‌شود. چهار دلیل در مدل کانونی وجود دارد — دو تا توسط اپراتور نوشته و قابل‌لغو؛ دو تا توسط provider نوشته و با resubscribe قابل‌لغو نیستند.",
      tableTitle: "مرجع دلایل",
      columns: {
        reason: "دلیل",
        label: "برچسب نشان",
        trigger: "ماژورکننده",
        writtenBy: "نوشته‌شده توسط",
        liftable: "قابل‌لغو با resubscribe؟",
      },
      rows: [
        {
          reason: "manual",
          label: "دستی",
          trigger:
            "اپراتور در داشبورد «Suppress email» را می‌زند، یا POST /api/dashboard/suppressions با reason = manual فراخوانی می‌شود.",
          writtenBy: "داشبورد (یا API، با reason = manual)",
          liftableByResubscribe: true,
          tone: "liftable",
        },
        {
          reason: "unsubscribe",
          label: "لغو اشتراک",
          trigger:
            "مخاطب روی لینک لغو اشتراک در یک ایمیل بازاریابی کلیک می‌کند، یا اپراتور از صفحهٔ Contacts او را unsubscribe می‌کند. marketing_status = unsubscribed و یک ورودی عدم‌ارسال با reason = unsubscribe می‌نویسد.",
          writtenBy: "لینک لغو اشتراک (یا عمل Unsubscribe از داشبورد)",
          liftableByResubscribe: true,
          tone: "liftable",
        },
        {
          reason: "hard_bounce",
          label: "Hard bounce",
          trigger:
            "ارائه‌دهندهٔ صندوق گیرنده یک شکست دائمی برگردانده (550 — آدرس وجود ندارد، صندوق غیرفعال، دامنه نامعتبر). توسط سیستم در پاسخ به رویداد bounce نوشته می‌شود.",
          writtenBy: "سیستم (رویداد bounce از provider)",
          liftableByResubscribe: false,
          tone: "non-liftable",
        },
        {
          reason: "complaint",
          label: "Complaint",
          trigger:
            "گیرنده در صندوق خود «Mark as spam» را زده (یک سیگنال feedback-loop از provider). توسط سیستم در پاسخ به رویداد complaint نوشته می‌شود.",
          writtenBy: "سیستم (رویداد complaint از provider)",
          liftableByResubscribe: false,
          tone: "non-liftable",
        },
      ],
      legendTitle: "رنگ",
      legendLiftable: "قابل‌لغو با resubscribe عادی (manual، unsubscribe)",
      legendNonLiftable:
        "NON_LIFTABLE_BY_RESUBSCRIBE (hard_bounce، complaint) — Lift صریح لازم است",
      footnote:
        "NON_LIFTABLE_BY_RESUBSCRIBE در src/lib/consent/service.ts به‌صورت یک ReadonlySet شامل hard_bounce و complaint تعریف شده. subscribeContact() برای این‌ها ResubscribeBlockedError پرتاب می‌کند. Lift (از داشبورد یا POST /api/dashboard/suppressions/{id}) تنها مسیری است که آن‌ها را غیرفعال می‌کند.",
    },

    /* 2. Active vs Lifted — the two states side-by-side */
    activeVsLifted: {
      heading: "فعال در برابر لغو‌شده — دو وضعیت",
      subheading:
        "یک ورودی عدم‌ارسال دقیقاً دو وضعیت دارد: فعال (eligible برای بازاریابی = false) و لغو‌شده (eligible برای بازاریابی = بسته به marketing_status). این وضعیت از marketing_status مستقل است — هر دو باید برای eligibility بگذرند. Lift یک انتقال وضعیت با تاریخچهٔ ممیزی است؛ یک حذف نیست.",
      activeCard: {
        badge: "فعال",
        title: "active: true",
        body: "ورودی در حال حاضر مؤثر است. هر مخاطبی با این ایمیل (subscribed، unsubscribed یا unknown) از بازاریابی حذف می‌شود. ردیف یک نشان «فعال» rose و دکمهٔ Lift نشان می‌دهد.",
        effects: [
          "Eligible برای بازاریابی = false (مستقل از marketing_status)",
          "از مخاطبان ارسال انبوه حذف شده",
          "دکمهٔ Lift در داشبورد قابل‌مشاهده",
          "Subscribe (هنگامی که دلیل hard_bounce یا complaint است) با ResubscribeBlockedError رد می‌شود",
        ],
      },
      liftedCard: {
        badge: "لغو‌شده",
        title: "active: false, liftedAt: تنظیم شده",
        body: "ورودی با عمل Lift غیرفعال شده. تاریخچهٔ ممیزی رویداد lifted را با مهر زمانی نگه می‌دارد. ردیف یک نشان «لغو‌شده» slate نشان می‌دهد و هیچ دکمهٔ عملی ندارد. suppress مجدد ایمیل یک ورودی جدید می‌سازد؛ این یکی را به فعال برنمی‌گرداند.",
        effects: [
          "Eligible برای بازاریابی = (marketing_status === subscribed)",
          "در مخاطبان ارسال انبوه دوباره گنجانده می‌شود (در صورت subscribed)",
          "هیچ دکمهٔ Lift روی ردیف",
          "مهر زمانی liftedAt به مهر createdAt می‌پیوندد",
        ],
      },
      comparison: [
        {
          dimension: "Eligible برای بازاریابی؟",
          activeValue: "خیر (همیشه)",
          liftedValue: "فقط اگر marketing_status = subscribed",
        },
        {
          dimension: "نشان وضعیت",
          activeValue: "فعال (rose)",
          liftedValue: "لغو‌شده (slate)",
        },
        {
          dimension: "عمل ردیف",
          activeValue: "دکمهٔ Lift",
          liftedValue: "بدون عمل",
        },
        {
          dimension: "تاریخچهٔ ممیزی",
          activeValue: "رویداد Suppress ثبت شده",
          liftedValue: "رویدادهای Suppress + Lifted ثبت شده",
        },
        {
          dimension: "مسیر suppress مجدد",
          activeValue: "بدون عمل (از قبل فعال)",
          liftedValue: "ایجاد ورودی جدید از طریق «Suppress email»",
        },
        {
          dimension: "فراخوانی Subscribe",
          activeValue:
            "برای hard_bounce/complaint رد؛ برای manual/unsubscribe موفق (و lift می‌کند)",
          liftedValue: "موفق (هیچ عدم‌ارسالی برای lift وجود ندارد)",
        },
      ],
      warningTitle: "Lift یک انتقال وضعیت است، نه یک حذف",
      warningBody:
        "Lift ورودی را غیرفعال می‌کند؛ آن را حذف نمی‌کند. تاریخچهٔ ممیزی رویداد lifted را با مهر زمانی نگه می‌دارد. ردیف در لیست می‌ماند (زمانی که «Showing all» انتخاب شده باشد قابل‌مشاهده است). این برای انطباق لازم است — هر تغییر رضایت باید قابل‌ممیزی باشد، از جمله پایان یک عدم‌ارسال.",
    },

    /* 3. Safe-lifting decision tree */
    safeLiftingDecisionTree: {
      heading: "درخت تصمیم lift ایمن",
      subheading:
        "پیش از زدن Lift، این درخت تصمیم را اجرا کنید. به شما می‌گوید آیا lift ایمن است، آیا باید subscribe کنید، و آیا یک Subscribe عادی از جای دیگر کار می‌کرد. تصمیم به reason code عدم‌ارسال و marketing_status فعلی مخاطب بستگی دارد.",
      rootQuestion:
        "reason code عدم‌ارسال چیست؟ (نشان reason ردیف را ببینید.)",
      branches: [
        {
          key: "manual-or-unsubscribe",
          question: "دلیل manual یا unsubscribe است؟",
          outcome:
            "قابل‌لغو. یک فراخوانی Subscribe عادی از جای دیگر این عدم‌ارسال را به‌عنوان عارضه جانبی lift می‌کرد — اما مسیر Lift صریح روشن‌تر است و یک مسیر ممیزی پاک‌تر تولید می‌کند.",
          recommendation:
            "از داشبورد Lift کنید. «Also subscribe» را فقط در صورتی تیک بزنید که مخاطب صریحاً درخواست بازگشت به بازاریابی کرده باشد.",
          tone: "safe",
          token: "manual | unsubscribe",
        },
        {
          key: "hard-bounce",
          question: "دلیل hard_bounce است؟",
          outcome:
            "NON_LIFTABLE_BY_RESUBSCRIBE. ارائه‌دهندهٔ صندوق گیرنده پیام را به‌طور دائم رد کرده. اشتراک مجدد bounce دیگری تولید می‌کند و به اعتبار فرستندهٔ شما آسیب می‌زند.",
          recommendation:
            "آدرس را بررسی کنید (غلط املایی؟ بازیافتی؟ صندوق بسته؟). ابتدا اصلاح کنید. سپس به‌صورت صریح از داشبورد Lift کنید — به Subscribe تکیه نکنید.",
          tone: "blocked",
          token: "hard_bounce",
        },
        {
          key: "complaint",
          question: "دلیل complaint است؟",
          outcome:
            "NON_LIFTABLE_BY_RESUBSCRIBE. گیرنده «Mark as spam» را زده — سیگنالی قوی‌تر از unsubscribe. اشتراک مجدد ریسک complaint‌های بیشتر و throttling provider را افزایش می‌دهد.",
          recommendation:
            "آسان‌نبینید و lift نکنید. اگر باید (مثلاً گیرنده از طریق double opt-in تأییدشده دوباره درگیر شده)، دلیل را مستند و صریح lift کنید.",
          tone: "blocked",
          token: "complaint",
        },
        {
          key: "already-lifted",
          question: "نشان وضعیت ردیف Lifted است؟",
          outcome:
            "هیچ عملی موجود نیست. عدم‌ارسال از قبل غیرفعال است. suppress مجدد ایمیل یک ورودی جدید می‌سازد؛ این یکی را به فعال برنمی‌گرداند.",
          recommendation:
            "اگر می‌خواهید دوباره suppress کنید، از «Suppress email» در بالا استفاده کنید — یک SuppressionEntry دستی جدید می‌نویسد.",
          tone: "caution",
        },
      ],
      liftOnlyPath: {
        badge: "فقط lift",
        title: "also_subscribe: false",
        body: "فقط ورودی عدم‌ارسال را غیرفعال می‌کند. marketing_status تغییر نمی‌کند. وقتی استفاده کنید که مخاطب نباید suppress شود اما نباید auto-subscribe شود — مثلاً او جداگانه unsubscribe کرده و شما فقط یک عدم‌ارسال دستی قدیمی را پاک می‌کنید.",
        apiCall: "POST /api/dashboard/suppressions/{id} { also_subscribe: false }",
      },
      liftAndSubscribePath: {
        badge: "Lift + subscribe",
        title: "also_subscribe: true",
        body: "عدم‌ارسال را غیرفعال و marketing_status = subscribed را در یک تراکنش اتمیک تنظیم می‌کند. وقتی مخاطب صریحاً درخواست بازگشت به بازاریابی کرده (مثلاً از طریق double opt-in تأییدشده دوباره درگیر شده)، از این مسیر استفاده کنید.",
        apiCall: "POST /api/dashboard/suppressions/{id} { also_subscribe: true }",
      },
      warningTitle: "هرگز به‌پشت یک lift auto-subscribe نکنید",
      warningBody:
        "Lift ≠ subscribe. این دو عملیات رویدادهای ممیزی متفاوتی تولید می‌کنند و به سوالات متفاوتی پاسخ می‌دهند («آیا این ایمیل باید suppress شود؟» در برابر «آیا این مخاطب بازاریابی می‌خواهد؟»). چک‌باکس رضایت را صریح می‌کند. اگر همیشه می‌خواهید تیک بزنید، بپرسید آیا واقعاً یک عمل Subscribe می‌خواهید — و آیا رضایت صریح برای آن دارید.",
    },

    /* 4. Eligibility relationship */
    eligibilityRelationship: {
      heading: "نحوه ترکیب عدم‌ارسال و marketing_status",
      subheading:
        "eligibility بازاریابی با دو بررسی مستقل گیت می‌شود: marketing_status === subscribed و فعلاً suppress نشده. هر دو باید بگذرند. یک مخاطب مشترک می‌تواند suppress شده باشد (eligible = false). یک مخاطب لغو اشتراک‌شده می‌تواند suppress نشده باشد (eligible = false — دروازهٔ marketing_status رد می‌شود). دو دروازه مستقل هستند؛ ماتریس زیر هر ترکیب را برمی‌شمارد.",
      conceptCards: [
        {
          label: "marketing_status",
          value: "subscribed | unsubscribed | unknown",
          desc: "رضایت خود مخاطب برای دریافت بازاریابی. با Subscribe (→ subscribed)، Unsubscribe (→ unsubscribed) یا هرگز تنظیم‌نشده (→ unknown) ست می‌شود. مخاطبین واردشده به‌صورت unknown شروع می‌کنند — واردکردن یا افزودن هرگز subscribe نمی‌کند.",
        },
        {
          label: "suppressed",
          value: "active: true | active: false",
          desc: "آیا یک SuppressionEntry فعال برای این ایمیل وجود دارد. از marketing_status مستقل است — یک مخاطب مشترک می‌تواند suppress شده باشد (Manually Suppress یک عدم‌ارسال می‌نویسد بدون آنکه marketing_status را ببیند).",
        },
        {
          label: "eligible",
          value: "true | false",
          desc: "مشتق: true فقط هنگامی که marketing_status = subscribed و هیچ عدم‌ارسال فعالی نباشد. این دروازه‌ای است که ارسال انبوه و پیام‌های بازاریابی پیش از ارسال بررسی می‌کنند.",
        },
      ],
      matrixTitle: "ماتریس eligibility",
      matrixSubtitle:
        "هر 6 ترکیب (marketing_status, suppressed) → eligible. marketing_status و suppressed مستقل هستند — Manually Suppress تغییر marketing_status نمی‌دهد.",
      marketingCol: "marketing_status",
      suppressedCol: "suppressed (فعال)",
      eligibleCol: "Eligible؟",
      eligibleYes: "بله",
      eligibleNo: "خیر",
      matrix: [
        { marketingStatus: "subscribed", suppressed: false, eligible: true },
        { marketingStatus: "subscribed", suppressed: true, eligible: false },
        { marketingStatus: "unsubscribed", suppressed: false, eligible: false },
        { marketingStatus: "unsubscribed", suppressed: true, eligible: false },
        { marketingStatus: "unknown", suppressed: false, eligible: false },
        { marketingStatus: "unknown", suppressed: true, eligible: false },
      ],
      ruleTitle: "قاعدهٔ دو دروازه",
      ruleBody:
        "eligibility فقط و فقط در صورتی true است که marketing_status === subscribed و هیچ عدم‌ارسال فعالی برای ایمیل وجود نداشته باشد. عمل Lift داشبورد فقط دروازهٔ عدم‌ارسال را غیرفعال می‌کند. برای گذر هر دو دروازه، همچنین subscribe کنید (یا مخاطب از قبل subscribed باشد).",
      nonLiftableNote:
        "hard_bounce و complaint به‌صورت NON_LIFTABLE_BY_RESUBSCRIBE هستند — Subscribe به‌جای lift خاموش، رد می‌شود. برای پاک‌کردن آن‌ها از عمل Lift صریح استفاده کنید. این از گیرنده و اعتبار فرستندهٔ شما محافظت می‌کند.",
    },
  },
};
