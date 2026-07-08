import { redirect } from "next/navigation";

/** /admin/email-themes → /dashboard/branding (moved to user dashboard). */
export default function EmailThemesRedirect() {
  redirect("/dashboard/branding");
}
