/**
 * Phase 12 — Persian (Farsi) translation dictionary.
 *
 * Shape MUST match `en.ts`. Missing keys fall back to English via the
 * `translate` function in `src/i18n/index.ts` — so partial coverage is safe
 * in development, but EVERY key in this file must have a complete Persian
 * value (no placeholders, no English mixed in for non-canonical strings).
 *
 * SERVICE NAMES (Verify / Send / Broadcast / Flow / Audience / Events / Relay /
 * Insights) remain canonical English — they are NOT translated. They appear
 * in the sidebar and elsewhere as their canonical English form, even on
 * Persian pages.
 *
 * Persian digits are NOT forced on technical data (OTP codes, API keys,
 * message IDs, ISO timestamps, HTTP statuses, emails, URLs) — these stay
 * canonical ASCII. The `Ltr` component wraps them with `dir="ltr"` for safe
 * inline embedding inside RTL prose.
 */

import type { Dict } from "./en";

export const fa: Dict = {
  common: {
    buttons: {
      save: "ذخیره",
      cancel: "انصراف",
      delete: "حذف",
      confirm: "تأیید",
      back: "بازگشت",
      loading: "در حال بارگذاری…",
    },
    status: {
      sent: "ارسال شد",
      failed: "ناموفق",
      pending: "در انتظار",
      active: "فعال",
      inactive: "غیرفعال",
    },
  },

  auth: {
    signIn: {
      title: "خوش آمدید",
      subtitle: "برای ورود به حساب Nixify خود وارد شوید.",
      email: "ایمیل",
      password: "رمز عبور",
      submit: "ورود",
      forgotPassword: "رمز عبور را فراموش کرده‌اید؟",
      submitting: "در حال ورود…",
      noAccount: "حساب کاربری ندارید؟",
      signUpLink: "ثبت‌نام",
    },
    signUp: {
      title: "ساخت حساب کاربری",
      subtitle: "ما یک کد ۶ رقمی به ایمیل شما ارسال می‌کنیم.",
      submit: "ساخت حساب",
      submitting: "در حال ساخت حساب…",
      haveAccount: "از قبل حساب دارید؟",
      logInLink: "ورود",
      passwordHelp: "حداقل ۸ کاراکتر استفاده کنید.",
    },
    forgotPassword: {
      title: "بازنشانی رمز عبور",
      subtitle: "ایمیل خود را وارد کنید تا کد ۶ رقمی بازنشانی برایتان ارسال شود.",
      email: "ایمیل",
      submit: "ارسال کد بازنشانی",
      submitting: "در حال ارسال…",
      backToLogin: "بازگشت به ورود",
      rememberedIt: "یادتان آمد؟",
      successTitle: "کد بازنشانی ارسال شد",
      successDescription: "اگر حسابی وجود داشته باشد، کد بازنشانی ارسال می‌شود.",
    },
    resetPassword: {
      title: "تعیین رمز عبور جدید",
      password: "رمز عبور جدید",
      confirm: "تأیید رمز عبور",
      submit: "به‌روزرسانی رمز عبور",
    },
    verifyEmail: {
      title: "تأیید ایمیل",
      subtitle: "کد ۶ رقمی ارسال‌شده به صندوق ورودی خود را وارد کنید.",
      code: "کد تأیید",
      resend: "ارسال مجدد کد",
      verifying: "در حال تأیید…",
    },
    logout: "خروج",
  },

  dashboard: {
    nav: {
      dashboard: "داشبورد",
      activity: "فعالیت",
      emails: "ایمیل‌ها",
      contacts: "مخاطبین",
      suppressions: "مسدودسازی‌ها",
      // Canonical product name — do NOT translate.
      broadcasts: "Broadcasts",
      templates: "قالب‌ها",
      automations: "اتوماسیون‌ها",
      analytics: "تحلیل‌ها",
      branding: "برندینگ",
      apiKeys: "کلیدهای API",
      webhooks: "Webhooks",
      playground: "Playground",
      logs: "لاگ‌ها",
      docs: "مستندات",
      notifications: "اعلان‌ها",
      settings: "تنظیمات",
    },
    overview: {
      title: "داشبورد",
      subtitle: "به فضای کاری Nixify خود خوش آمدید.",
      welcome: "خوش آمدید",
      yourWidgets: "ابزارک‌های شما",
      noWidgets: "هیچ ابزارکی فعال نیست.",
      addFirstWidget: "افزودن اولین ابزارک ←",
    },
    settings: {
      title: "تنظیمات",
      subtitle: "حساب کاربری و ترجیحات خود را مدیریت کنید.",
      localePreference: "ترجیح زبان",
      localePreferenceHelp:
        "زبانی که در سراسر داشبورد Nixify استفاده می‌شود را انتخاب کنید. زبان فارسی راست‌چین نمایش داده می‌شود.",
      language: "زبان",
    },
  },

  locale: {
    switcher: {
      title: "زبان",
      english: "English",
      persian: "فارسی",
      changeLanguage: "تغییر زبان",
    },
  },

  errors: {
    invalidEmail: "یک آدرس ایمیل معتبر وارد کنید",
    required: "این فیلد الزامی است",
    tooShort: "خیلی کوتاه",
    generic: "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
    networkError: "خطای شبکه. ارتباط با سرور ممکن نشد.",
  },
};
