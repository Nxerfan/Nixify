import type { BlogArticle } from "@/lib/blog/types";

const article: BlogArticle = {
  slug: "welcome-to-nixify",
  locale: "fa",
  title: "به Nixify خوش آمدید",
  description: "معرفی Nixify — تأیید ایمیل OTP واقعی از طریق SMTP، رایگان برای شروع، قابل self-host.",
  publishedAt: "2026-09-01",
  category: "اعلامیه‌ها",
  author: "تیم Nixify",
  body: `# به Nixify خوش آمدید

Nixify یک پلتفرم تأیید ایمیل واقعی است که کدهای ۶ رقمی OTP را از طریق SMTP ارسال می‌کند.

## چه چیزی Nixify را متفاوت می‌کند

- **تحویل واقعی SMTP** — کدها به یک صندوق پستی واقعی تحویل داده می‌شوند، نه شبیه‌سازی شده
- **یک‌بارمصرف و نرخ‌محدود** — هر کد یک‌بارمصرف، با انقضا و محافظت در برابر حملات فرسایشی
- **قابل تعویض SMTP** — انتقال قابل‌پیکربندی توسط اپراتور از طریق متغیرهای محیطی
- **ایمن برای Serverless** — تمام وضعیت در Postgres/SQLite، بدون نرخ‌حدود در حافظه

## شروع کار

یک حساب کاربری ایجاد کنید و ایمیل خود را تأیید کنید. طرح رایگان شامل ۱۰۰ ایمیل OTP در ماه است.

\`\`\`bash
curl -X POST https://nixify.vercel.app/api/v1/otp/send \\
  -H "Authorization: Bearer mg_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","purpose":"signup"}'
\`\`\`

## محلی‌سازی

Nixify از انگلیسی و فارسی پشتیبانی می‌کند. داشبورد و ایمیل‌های OTP به زبان ترجیحی کاربر نمایش داده می‌شوند.
`,
};

export default article;
