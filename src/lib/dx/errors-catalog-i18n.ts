/**
 * Localized error catalog overlay for the ERRORS_CATALOG.
 *
 * The canonical ERRORS_CATALOG (src/lib/dx/errors-catalog.ts) stores
 * machine-stable data: code, httpStatus, title, description, causes, fixes.
 * These are English by default (they're also used by the API's errorResponse).
 *
 * For Persian UI rendering, this module provides a locale-aware overlay:
 * when locale=fa, the human-readable fields (title, description, causes,
 * fixes) are replaced with Persian translations. The machine `code` and
 * `httpStatus` are never translated.
 *
 * Usage:
 *   const t = useTranslations();
 *   const entry = getLocalizedError(code, locale);
 *   // entry.code is always the machine code (e.g. "rate_limited")
 *   // entry.httpStatus is always the HTTP status number
 *   // entry.title/description/causes/fixes are Persian when locale=fa
 */

import type { ErrorEntry } from "@/lib/dx/errors-catalog";

export type Locale = "en" | "fa";

export interface LocalizedErrorEntry {
  code: string;
  httpStatus: number;
  title: string;
  description: string;
  causes: string[];
  fixes: string[];
}

/**
 * Persian translations for each error code's human-readable fields.
 * Keyed by the machine error code.
 */
export const FA_TRANSLATIONS: Record<string, {
  title: string;
  description: string;
  causes: string[];
  fixes: string[];
}> = {
  validation_failed: {
    title: "اعتبارسنجی ناموفق",
    description: "بدنه درخواست یا پارامترها اعتبارسنجی نشدند.",
    causes: ["فیلد مورد نیاز موجود نیست", "فرمت ایمیل نامعتبر", "کد OTP دقیقاً ۶ رقم نیست"],
    fixes: ["فیلد نامعتبر را در فیلد message بررسی کنید", "اطمینان از فرمت صحیح ایمیل", "کدهای OTP باید دقیقاً ۶ رقم عددی باشند"],
  },
  unauthorized: {
    title: "غیرمجاز",
    description: "هیچ کلید API معتبری ارائه نشده است.",
    causes: ["هدر Authorization موجود نیست", "کلید API فرمت نامعتبر دارد", "کلید API وجود ندارد"],
    fixes: ["یک کلید API در داشبورد ایجاد کنید", "آن را به صورت: Bearer mg_live_xxx ارسال کنید"],
  },
  key_revoked: {
    title: "کلید API ابطال شده",
    description: "این کلید API ابطال شده و دیگر قابل استفاده نیست.",
    causes: ["یک مدیر کلید را ابطال کرده است", "کلید چرخش شده و کلید قدیمی ابطال شده"],
    fixes: ["یک کلید API جدید تولید کنید", "متغیرهای محیطی برنامه خود را به‌روزرسانی کنید"],
  },
  key_expired: {
    title: "انقضای کلید API",
    description: "تاریخ انقضای کلید API گذشته است.",
    causes: ["کلید با تاریخ انقضایی ایجاد شده که اکنون گذشته است"],
    fixes: ["یک کلید API جدید تولید کنید", "برای کلیدهای طولانی‌مدت، انقضا را حذف کنید"],
  },
  insufficient_scope: {
    title: "محدوده ناکافی",
    description: "کلید API اجازه انجام این عملیات را ندارد.",
    causes: ["یک کلید فقط‌خواندنی برای عملیات نوشتن استفاده شده", "محدوده‌های کلید شامل عملیات مورد نیاز نیست"],
    fixes: ["از کلیدی با محدوده full یا محدوده مورد نیاز استفاده کنید", "محدوده‌های کلید را در داشبورد به‌روزرسانی کنید"],
  },
  rate_limited: {
    title: "محدودیت نرخ",
    description: "تعداد درخواست‌ها در پنجره زمانی بیش از حد بوده است.",
    causes: ["بیش از ۳ ارسال OTP در دقیقه برای هر ایمیل", "بیش از ۱۰ ارسال OTP در ساعت برای هر ایمیل", "محدودیت نرخ سطح IP فراتر رفته"],
    fixes: ["به مدت هدر Retry-After قبل از تلاش مجدد صبر کنید", "backoff نمایی در کلاینت خود پیاده‌سازی کنید"],
  },
  locked: {
    title: "قفل شده",
    description: "تعداد تلاش‌های تأیید ناموفق بیش از حد بوده است.",
    causes: ["۵ تلاش اشتباه برای یک کد", "۱۰ تأیید ناموفق تجمعی (قفل ضد brute-force)"],
    fixes: ["۱۵ دقیقه برای انقضای قفل هر کد صبر کنید", "۳۰ دقیقه برای انقضای قفل حساب صبر کنید"],
  },
  code_mismatch: {
    title: "عدم تطابق کد",
    description: "کد OTP با کد ذخیره شده تطابق نداشت.",
    causes: ["کاربر کد اشتباه وارد کرده", "کد برای ایمیل یا هدف دیگری بوده"],
    fixes: ["از کاربر بخواهید کد را دوباره وارد کند", "کد جدیدی از طریق نقطه انتهایی ارسال مجدد درخواست کنید"],
  },
  expired: {
    title: "انقضای OTP",
    description: "کد OTP منقضی شده است (۱۰ دقیقه TTL).",
    causes: ["بیش از ۱۰ دقیقه از صدور کد گذشته"],
    fixes: ["کد جدیدی از طریق POST /api/v1/otp/resend درخواست کنید"],
  },
  already_used: {
    title: "OTP قبلاً استفاده شده",
    description: "این کد OTP قبلاً مصرف شده است (یکبار مصرف).",
    causes: ["کد قبلاً با موفقیت تأیید شده", "یک درخواست همزمان آن را اول مصرف کرده"],
    fixes: ["اگر نیاز به تأیید مجدد دارید کد جدید درخواست کنید"],
  },
  disposable_email: {
    title: "ایمیل یکبارمصرف رد شد",
    description: "دامنه ایمیل در لیست سیاه ایمیل‌های یکبارمصرف است.",
    causes: ["دامنه (مثلاً mailinator.com) مسدود شده"],
    fixes: ["از یک ایمیل واقعی استفاده کنید"],
  },
  ip_blocked: {
    title: "IP مسدود شده",
    description: "IP کلاینت به طور موقت تعلیق شده است.",
    causes: ["تعداد زیادی نقض محدودیت نرخ از این IP"],
    fixes: ["برای انقضای مسدودیت صبر کنید", "اگر فکر می‌کنید این یک خطاست با پشتیبانی تماس بگیرید"],
  },
  not_found: {
    title: "یافت نشد",
    description: "منبع درخواستی یافت نشد.",
    causes: ["هیچ OTP فعالی برای این ایمیل یافت نشد", "حساب کاربری وجود ندارد"],
    fixes: ["ابتدا یک OTP جدید درخواست کنید", "املای ایمیل را بررسی کنید"],
  },
  quota_exceeded: {
    title: "سهمیه ماهانه API تمام شد",
    description: "سهمیه API_MESSAGES پلن شما به پایان رسیده است. این سهمیه تمام درخواست‌های احراز هویت v1 API را پوشش می‌دهد و از محدودیت‌های هر ایمیل و هر IP جدا است.",
    causes: ["پلن دارنده کلید تمام سهمیه ماهانه API_MESSAGES خود را مصرف کرده", "توجه: کلیدهای mg_test_ متعلق به کاربر نیز این سهمیه را مصرف می‌کنند"],
    fixes: ["برای بازنشانی سهمیه در چرخه بعدی صورتحساب صبر کنید", "به پلن بالاتری با سهمیه بیشتر ارتقا دهید", "تست‌های بار را با کلید توسعه‌ای سیستم (بدون کاربر) اجرا کنید"],
  },
  feature_not_available: {
    title: "ویژگی در دسترس نیست",
    description: "پلن فعلی شما شامل دسترسی به این ویژگی نیست.",
    causes: ["پلن دارنده کلید این ویژگی را شامل نمی‌شود"],
    fixes: ["به پلنی که شامل این ویژگی است ارتقا دهید", "از کلید دیگری مرتبط با پلن واجد شرایط استفاده کنید"],
  },
  internal_error: {
    title: "خطای داخلی سرور",
    description: "یک خطای غیرمنتظره رخ داد.",
    causes: ["اتصال SMTP ناموفق", "خطای پایگاه داده", "باگ غیرمنتظره سرور"],
    fixes: ["با backoff نمایی تلاش مجدد کنید", "با شناسه درخواست با پشتیبانی تماس بگیرید"],
  },
};

/**
 * Get a locale-aware error entry.
 *
 * When locale=fa, the human-readable fields (title, description, causes,
 * fixes) are replaced with Persian translations. When locale=en (or when
 * no Persian translation exists for the code), the original English
 * values from ERRORS_CATALOG are returned.
 *
 * The `code` and `httpStatus` are NEVER translated.
 */
export function getLocalizedError(
  entry: ErrorEntry,
  locale: Locale = "en",
): LocalizedErrorEntry {
  if (locale === "fa") {
    const fa = FA_TRANSLATIONS[entry.code];
    if (fa) {
      return {
        code: entry.code,
        httpStatus: entry.httpStatus,
        title: fa.title,
        description: fa.description,
        causes: fa.causes,
        fixes: fa.fixes,
      };
    }
  }
  return entry;
}

/**
 * Get a localized error by code. Looks up the canonical ERRORS_CATALOG
 * first, then applies the locale overlay.
 */
export function getLocalizedErrorByCode(
  code: string,
  locale: Locale = "en",
): LocalizedErrorEntry | undefined {
  // Import inline to avoid circular dependency at module load time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { findError } = require("@/lib/dx/errors-catalog") as typeof import("@/lib/dx/errors-catalog");
  const entry = findError(code);
  if (!entry) return undefined;
  return getLocalizedError(entry, locale);
}
