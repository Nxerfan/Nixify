import type { BlogArticle } from "@/lib/blog/types";

const article: BlogArticle = {
  slug: "email-otp-api-for-nextjs",
  locale: "fa",
  title: "API تأیید OTP ایمیل برای Next.js — راهنمای کامل یکپارچه‌سازی",
  description:
    "نحوه افزودن تأیید OTP ایمیل به یک اپ Next.js با استفاده از API نسخه ۱ Nixify. شامل ارسال، تأیید، بررسی امضای وب‌هوک و مدیریت خطا — همه بر اساس API واقعی.",
  publishedAt: "2026-09-20",
  category: "مهندسی",
  author: "تیم Nixify",
  tags: ["nextjs", "email-otp", "verification", "integration"],
  body: `# API تأیید OTP ایمیل برای Next.js

اگر در حال ساخت یک اپ Next.js هستید و به تأیید ایمیل نیاز دارید — تأیید ثبت‌نام، بازنشانی رمز عبور، ورود — می‌توانید یک جریان کامل OTP را با استفاده از [API نسخه ۱ Nixify](https://nixify.ir/docs) اضافه کنید بدون اینکه خودتان زیرساخت را بسازید. این راهنما کل یکپارچه‌سازی را قدم به قدم توضیح می‌دهد.

## چرا API به جای ساخت دستی؟

ساخت تأیید OTP به معنای: تولید کدها، هَش کردن آن‌ها با یک pepper، ذخیره با انقضا، ارسال ایمیل از طریق SMTP، تأیید با مقایسه زمان‌سنج، اعمال یک‌بارمصرف، محدودسازی نرخ به ازای ایمیل و IP، و مدیریت قفل فرسایشی است. این‌ها همه قبل از وب‌هوک یا تم ایمیل است.

Nixify همه این‌ها را مدیریت می‌کند. اپ Next.js شما endPointهای اصلی ارسال و تأیید را از route handlerهای سمت سرور فراخوانی می‌کند (یک endPoint ارسال مجدد نیز موجود است) و اختیاری وب‌هوک‌های امضاشده دریافت می‌کند. برای جزئیات بیشتر به [Nixify در برابر ساخت دستی](/compare) مراجعه کنید.

## معماری

اپ Next.js شما Nixify را از **route handlerهای سمت سرور** (API routeها) فراخوانی می‌کند. componentهای کلاینت شما route handlerهای خودتان را فراخوانی می‌کنند — هرگز مستقیماً API Nixify را نه (کلید API شما سمت سرور می‌ماند). Nixify رویدادهای وب‌هوک امضاشده را به یک route handler جداگانه برای به‌روزرسانی‌های ناهمگام تحویل می‌دهد.

\`\`\`
Client ──▶ /api/otp/send ──▶ POST nixify.ir/api/v1/otp/send
                               (returns otp_request_id, expires_at)
Client ──▶ /api/otp/verify ─▶ POST nixify.ir/api/v1/otp/verify
                               (returns verified: true|false)

Nixify ──▶ /api/webhooks/nixify  (signed: otp.sent, otp.verified,
                                  otp.failed, otp.expired)
\`\`\`

## گام ۱ — دریافت کلید API

در [nixify.ir](https://nixify.ir) ثبت‌نام کنید و یک کلید API در [داشبورد کلیدهای API](https://nixify.ir/dashboard/api-keys) بسازید. برای توسعه از یک کلید \`mg_test_\` استفاده کنید — حالت sandbox کد OTP را تولید و ذخیره می‌کند اما ایمیل واقعی ارسال نمی‌کند. کد متنی صریح در بدنه پاسخ برگردانده می‌شود تا بتوانید بلافاصله \`/verify\` را بدون بررسی صندوق ورودی فراخوانی کنید.

## گام ۲ — ارسال OTP

فایل \`app/api/otp/send/route.ts\` را بسازید:

\`\`\`typescript
import { NextRequest, NextResponse } from "next/server";

const NIXIFY_API = "https://nixify.ir/api/v1";
const NIXIFY_KEY = process.env.NIXIFY_API_KEY!;

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const res = await fetch(\`\${NIXIFY_API}/otp/send\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${NIXIFY_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, purpose: "signup" }),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { error: data.error, requestId: data.request_id },
      { status: res.status },
    );
  }

  return NextResponse.json({
    otpRequestId: data.otp_request_id,
    requestId: data.request_id,
    expiresAt: data.expires_at,
  });
}
\`\`\`

## گام ۳ — تأیید OTP

فایل \`app/api/otp/verify/route.ts\` را بسازید:

\`\`\`typescript
import { NextRequest, NextResponse } from "next/server";

const NIXIFY_API = "https://nixify.ir/api/v1";
const NIXIFY_KEY = process.env.NIXIFY_API_KEY!;

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();
  if (!email || !code) {
    return NextResponse.json(
      { error: "email and code are required" },
      { status: 400 },
    );
  }

  const res = await fetch(\`\${NIXIFY_API}/otp/verify\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${NIXIFY_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, code, purpose: "signup" }),
  });

  const data = await res.json();
  if (!res.ok || !data.verified) {
    return NextResponse.json(
      { verified: false, error: data.error, requestId: data.request_id },
      { status: res.status },
    );
  }

  // ایمیل تأیید شد. حساب کاربری را بسازید، session تنظیم کنید و غیره.
  return NextResponse.json({ verified: true });
}
\`\`\`

## گام ۴ — component کلاینت

\`\`\`tsx
"use client";
import { useState } from "react";

export function OtpForm({ email }: { email: string }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "verified" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setStatus("verifying");
    setError(null);

    const res = await fetch("/api/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();

    if (data.verified) {
      setStatus("verified");
    } else {
      setStatus("error");
      setError(data.error?.message ?? "Verification failed.");
    }
  }

  if (status === "verified") {
    return <p className="text-emerald-600">Email verified successfully.</p>;
  }

  return (
    <form onSubmit={handleVerify}>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\\D/g, ""))}
        placeholder="6-digit code"
      />
      {error && <p>{error}</p>}
      <button type="submit" disabled={status === "verifying" || code.length !== 6}>
        {status === "verifying" ? "Verifying…" : "Verify code"}
      </button>
    </form>
  );
}
\`\`\`

## مدیریت خطا

API Nixify یک پاکت خطای یکدست برمی‌گرداند:

\`\`\`json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many OTP sends. Retry in 47s.",
    "doc_url": "/docs#error-rate_limited"
  },
  "request_id": "a1b2c3d4-..."
}
\`\`\`

کدهای رایج برای مدیریت در UI شما:

- \`code_mismatch\` — کد اشتباه وارد شده
- \`expired\` — انقضای ۱۰ دقیقه‌ای سپری شده
- \`locked\` — تلاش‌های ناموفق بیش از حد (۱۰ مورد در ۱۵ دقیقه → قفل ۳۰ دقیقه‌ای)
- \`rate_limited\` — محدودیت نرخ به ازای ایمیل، IP یا سهمیه طرح (برای هدر هر منبع به /docs#rate-limits مراجعه کنید)
- \`validation_failed\` — ایمیل یا کد نامعتبر

برای هر کد، وضعیت HTTP، دلایل و راه‌حل‌ها را در [کاتالوگ کامل خطاها](/docs#errors) ببینید.

## وب‌هوک (اختیاری)

یک endPoint وب‌هوک در [داشبورد وب‌هوک‌ها](https://nixify.ir/dashboard/webhooks) ثبت کنید تا تحویل‌های امضاشده برای رویدادهای \`otp.sent\`، \`otp.verified\`، \`otp.failed\` و \`otp.expired\` دریافت کنید. هدر \`Nixify-Signature\` از HMAC-SHA256 استفاده می‌کند — همیشه قبل از پردازش آن را تأیید کنید:

\`\`\`typescript
import crypto from "crypto";

function verifySignature(
  secret,
  payload,
  signatureHeader,
  toleranceMs = 5 * 60 * 1000,
) {
  // هدر Nixify-Signature فرمت: t=<timestamp>,v1=<hmac>
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=")),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;

  // t/v1 مفقود یا نامعتبر را رد کن — هرگز اجازه نده نامعتبر استثنا پرتاب کند.
  if (!t || !v1 || typeof v1 !== "string") return false;

  // حملات replay قدیمی‌تر از پنجره تلورانس را رد کن.
  if (Math.abs(Date.now() - t) > toleranceMs) return false;

  const signedPayload = \`\${t}.\${payload}\`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // v1 باید دقیقاً یک digest هگز SHA-256 ۶۴ کاراکتری باشد. این تضمین
  // می‌کند Buffer.from(v1) و Buffer.from(expected) قبل از مقایسه
  // زمان‌سنج طول بایت یکسانی دارند — یک v1 چندبایتی با همان تعداد کاراکتر
  // در غیر این صورت داخل timingSafeEqual (RangeError) به دلیل عدم تطابق
  // طول بایت پرتاب می‌شد. اعتبارسنجی فرمت هکس در اینجا یعنی امضاهای
  // نامعتبر همیشه false برمی‌گردانند، نه استثنا.
  if (typeof v1 !== "string" || !/^[0-9a-f]{64}$/.test(v1)) return false;

  // هر دو رشته هکس ۶۴ کاراکتری → هر دو Buffer ۳۲ بایتی. امن.
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
\`\`\`

برای route handler کامل وب‌هوک به [صفحه نمونه‌ها](/examples) مراجعه کنید.

## گام بعدی

- [مستندات کامل API](/docs)
- [نمونه آماده Next.js](/examples)
- [Nixify در برابر ساخت دستی](/compare)
- [قیمت‌گذاری و سهمیه‌ها](/pricing) (طرح رایگان: ۱٬۰۰۰ درخواست API نسخه ۱ احراز هویت‌شده در ماه)
- [کنترل‌های امنیتی](/security)
`,
};

export default article;
