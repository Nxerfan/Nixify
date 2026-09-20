"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { GuidePageLayout } from "@/components/guide/GuidePageLayout";
import type { WalkthroughChapter } from "@/components/guide/CinematicWalkthrough";

/**
 * /guide/contacts — Full learning experience for the Contacts dashboard.
 */

export default function ContactsGuidePage() {
  const { locale } = useLocale();
  const isFa = locale === "fa";

  const chapters: WalkthroughChapter[] = [
    {
      id: "intro",
      title: isFa ? "مخاطبان" : "Contacts",
      steps: [
        {
          id: "contactsOverview",
          caption: isFa
            ? "اینجا همه مخاطبان حساب شما را می‌بینید و می‌توانید آن‌ها را جستجو، گروه‌بندی یا بررسی کنید. هر مخاطب دارای ایمیل، نام، منبع و وضعیت بازاریابی است."
            : "Here you see all contacts in your account. Search, filter, and inspect each one. Every contact has an email, name, source, and marketing status.",
          duration: 6000,
          scene: "contactsOverview",
        },
        {
          id: "addContact",
          caption: isFa
            ? "برای افزودن یک مخاطب جدید، روی «افزودن مخاطب» کلیک کنید، ایمیل را وارد کنید و در صورت نیاز نام و اطلاعات تکمیلی را اضافه کنید."
            : "To add a new contact, click \"Add Contact\", enter the email, and optionally add a name and additional information.",
          duration: 6000,
          scene: "addContact",
          typedText: "sara@example.com",
        },
        {
          id: "searchFilter",
          caption: isFa
            ? "برای یافتن یک مخاطب خاص، در نوار جستجو ایمیل یا نام را تایپ کنید. نتایج به‌صورت زنده فیلتر می‌شوند."
            : "To find a specific contact, type an email or name in the search bar. Results filter live as you type.",
          duration: 5000,
          scene: "searchFilter",
          typedText: "sara",
        },
        {
          id: "contactDetail",
          caption: isFa
            ? "برای مشاهده جزئیات یک مخاطب، روی ردیف آن کلیک کنید. شما وضعیت بازاریابی، منبع، تاریخچه رویدادها و اقدامات موجود را خواهید دید."
            : "To view a contact's details, click on its row. You'll see marketing status, source, event history, and available actions.",
          duration: 6000,
          scene: "contactDetail",
        },
        {
          id: "actions",
          caption: isFa
            ? "از منوی اقدامات می‌توانید مخاطب را ویرایش، حذف، یا وضعیت بازاریابی او را تغییر دهید. همچنین می‌توانید او را به گروه‌ها اضافه کنید."
            : "From the actions menu, you can edit, delete, or change a contact's marketing status. You can also add them to groups.",
          duration: 5000,
          scene: "actions",
        },
      ],
    },
  ];

  return (
    <GuidePageLayout
      routeKey="contacts"
      backHref="/dashboard/contacts"
      chapters={chapters}
      stepCount={5}
      durationMin={4}
      writtenSteps={[
        {
          title: isFa ? "مشاهده لیست مخاطبان" : "View the contacts list",
          body: isFa
            ? "صفحه مخاطبان تمام مخاطبان حساب شما را در یک جدول نمایش می‌دهد. هر ردیف شامل ایمیل، نام، منبع (API، داشبورد، یا OTP تأییدشده)، وضعیت بازاریابی و تاریخ به‌روزرسانی است."
            : "The contacts page shows all contacts in your account in a table. Each row includes email, name, source (API, Dashboard, or OTP Verified), marketing status, and last updated date.",
        },
        {
          title: isFa ? "افزودن مخاطب جدید" : "Add a new contact",
          body: isFa
            ? "روی دکمه «افزودن مخاطب» کلیک کنید. ایمیل را وارد کنید (الزامی). نام و اطلاعات تکمیلی اختیاری هستند. پس از ذخیره، مخاطب جدید در جدول ظاهر می‌شود."
            : "Click the \"Add Contact\" button. Enter the email (required). Name and additional info are optional. After saving, the new contact appears in the table.",
        },
        {
          title: isFa ? "جستجو و فیلتر" : "Search and filter",
          body: isFa
            ? "از نوار جستجو برای پیدا کردن مخاطبان بر اساس ایمیل یا نام استفاده کنید. نتایج به‌صورت زنده فیلتر می‌شوند. از صفحه‌بندی برای مرور مخاطبان زیاد استفاده کنید."
            : "Use the search bar to find contacts by email or name. Results filter live. Use pagination to browse through large numbers of contacts.",
        },
        {
          title: isFa ? "باز کردن جزئیات مخاطب" : "Open contact details",
          body: isFa
            ? "روی هر ردیف مخاطب کلیک کنید تا صفحه جزئیات باز شود. آنجا می‌توانید ویژگی‌ها، وضعیت بازاریابی، تاریخچه رویدادها و اقدامات موجود را ببینید."
            : "Click any contact row to open the detail page. There you can see attributes, marketing status, event history, and available actions.",
        },
        {
          title: isFa ? "مدیریت وضعیت بازاریابی" : "Manage marketing status",
          body: isFa
            ? "از منوی اقدامات، می‌توانید وضعیت بازاریابی را تغییر دهید: مشترک، لغو اشتراک، یا عدم ارسال. این تغییرات بلافاصله بر ارسال ایمیل‌های آینده تأثیر می‌گذارد."
            : "From the actions menu, you can change marketing status: subscribed, unsubscribed, or suppressed. These changes immediately affect future email sends.",
        },
      ]}
      whyWhen={[
        {
          title: isFa ? "چه زمانی از مخاطبان استفاده کنید" : "When to use Contacts",
          body: isFa
            ? "هر زمان که نیاز دارید لیست ایمیل‌های کاربران خود را مدیریت کنید، وضعیت بازاریابی را بررسی کنید، یا مخاطبان را برای ارسال انبوه گروه‌بندی کنید."
            : "Whenever you need to manage your users' email list, check marketing status, or organize contacts for broadcasts.",
        },
        {
          title: isFa ? "تفاوت با گروه‌ها" : "Difference from Groups",
          body: isFa
            ? "مخاطبان لیست کامل افراد هستند. گروه‌ها زیرمجموعه‌هایی از مخاطبان هستند که برای هدف‌گیری ارسال انبوه استفاده می‌شوند. یک مخاطب می‌تواند در چندین گروه باشد."
            : "Contacts are the complete list of individuals. Groups are subsets of contacts used for broadcast targeting. A contact can be in multiple groups.",
        },
        {
          title: isFa ? "منبع مخاطب چیست؟" : "What is a contact source?",
          body: isFa
            ? "منبع نشان می‌دهد مخاطب چگونه ایجاد شده است: API (از طریق فراخوانی API)، Dashboard (افزودن دستی)، یا OTP Verified (کاربری که OTP را تأیید کرده است)."
            : "Source indicates how the contact was created: API (via API call), Dashboard (manually added), or OTP Verified (a user who verified their OTP).",
        },
      ]}
      mistakes={[
        {
          title: isFa ? "درک نادرست وضعیت عدم ارسال" : "Misunderstanding suppression status",
          body: isFa
            ? "وضعیت «عدم ارسال» به معنای حذف مخاطب نیست. این وضعیت فقط ارسال ایمیل به آن مخاطب را متوقف می‌کند. مخاطب همچنان در لیست باقی می‌ماند و می‌توانید وضعیت او را تغییر دهید."
            : "Suppressed status does not mean the contact is deleted. It only stops emails from being sent to that contact. The contact remains in the list and you can change their status.",
        },
        {
          title: isFa ? "حذف تصادفی مخاطب" : "Accidentally deleting a contact",
          body: isFa
            ? "قبل از حذف یک مخاطب، مطمئن شوید که تاریخچه رویدادها و ارتباطات آن را دیگر نیاز ندارید. حذف غیرقابل بازگشت است."
            : "Before deleting a contact, make sure you don't need their event history or associations. Deletion is permanent.",
        },
        {
          title: isFa ? "فراموش کردن گروه‌بندی" : "Forgetting to organize into groups",
          body: isFa
            ? "اگر مخاطبان زیاد دارید، بدون گروه‌بندی، انتخاب مخاطب برای ارسال انبوه دشوار می‌شود. پس از افزودن مخاطبان، آن‌ها را در گروه‌های منطقی سازماندهی کنید."
            : "If you have many contacts, without grouping, selecting an audience for broadcasts becomes difficult. After adding contacts, organize them into logical groups.",
        },
      ]}
      proTips={[
        {
          title: isFa ? "استفاده از جستجوی سریع" : "Use quick search",
          body: isFa
            ? "به‌جای مرور صفحات، بخشی از ایمیل یا نام را در نوار جستجو تایپ کنید. این کار سریع‌ترین راه برای پیدا کردن یک مخاطب خاص است."
            : "Instead of browsing pages, type part of the email or name in the search bar. This is the fastest way to find a specific contact.",
        },
        {
          title: isFa ? "بررسی منبع قبل از حذف" : "Check source before deleting",
          body: isFa
            ? "اگر مخاطب از طریق API ایجاد شده، حذف آن ممکن است بر یکپارچه‌سازی خارجی تأثیر بگذارد. ابتدا با تیم توسعه هماهنگ کنید."
            : "If a contact was created via API, deleting them may affect an external integration. Coordinate with your dev team first.",
        },
        {
          title: isFa ? "استفاده از وضعیت بازاریابی" : "Leverage marketing status",
          body: isFa
            ? "به‌جای حذف مخاطبان ناخواسته، وضعیت آن‌ها را به «عدم ارسال» تغییر دهید. این کار تاریخچه را حفظ می‌کند و از ارسال ایمیل جلوگیری می‌کند."
            : "Instead of deleting unwanted contacts, change their status to \"suppressed\". This preserves history and prevents emails from being sent.",
        },
      ]}
      troubleshooting={[
        {
          title: isFa ? "مخاطب جدید ظاهر نمی‌شود" : "New contact doesn't appear",
          body: isFa
            ? "اگر مخاطب جدید در لیست ظاهر نمی‌شود، صفحه را تازه‌سازی کنید. اگر همچنان ظاهر نشد، خطای اعتبارسنجی ممکن است رخ داده باشد — toast را بررسی کنید."
            : "If a new contact doesn't appear in the list, refresh the page. If still missing, a validation error may have occurred — check the toast notification.",
        },
        {
          title: isFa ? "جستجو نتیجه نمی‌دهد" : "Search returns no results",
          body: isFa
            ? "بررسی کنید که عبارت جستجو دقیقاً با ایمیل یا نام مطابقت ندارد. جستجو بخشی از کلمه را هم پیدا می‌کند. اگر مخاطب در صفحه دیگری است، صفحه‌بندی را بررسی کنید."
            : "Check that your search term matches part of the email or name. Search matches partial strings. If the contact is on another page, check pagination.",
        },
        {
          title: isFa ? "عدم امکان تغییر وضعیت" : "Cannot change marketing status",
          body: isFa
            ? "اگر امکان تغییر وضعیت بازاریابی وجود ندارد، ممکن است مخاطب توسط سیستم خودکار در حالت عدم ارسال قرار گرفته باشد. صبر کنید تا دوره قفل پایان یابد یا با پشتیبانی تماس بگیرید."
            : "If you cannot change marketing status, the contact may have been auto-suppressed by the system. Wait for the lockout period to expire or contact support.",
        },
      ]}
      checklist={[
        { label: isFa ? "مخاطب جدید ایجاد شده" : "New contact created" },
        { label: isFa ? "جستجو و فیلتر آزمایش شده" : "Search and filter tested" },
        { label: isFa ? "جزئیات مخاطب بررسی شده" : "Contact details inspected" },
        { label: isFa ? "وضعیت بازاریابی درک شده" : "Marketing status understood" },
        { label: isFa ? "گروه‌بندی بررسی شده" : "Groups reviewed" },
      ]}
      whatNext={isFa
        ? "پس از آشنایی با مخاطبان، گام منطقی بعدی یادگیری گروه‌ها برای سازماندهی بهتر مخاطبان و هدف‌گیری ارسال انبوه است."
        : "After mastering contacts, the logical next step is learning Groups to better organize contacts and target broadcasts."
      }
      related={[
        { label: isFa ? "راهنمای گروه‌ها" : "Groups Guide", href: "/guide/groups" },
        { label: isFa ? "راهنمای ارسال انبوه" : "Broadcasts Guide", href: "/guide/broadcasts" },
        { label: isFa ? "راهنمای واردسازی" : "Import Guide", href: "/guide/contacts-import" },
      ]}
    />
  );
}
