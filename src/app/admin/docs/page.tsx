import { redirect } from "next/navigation";
/** /admin/docs → /dashboard/docs (moved to user dashboard). */
export default function DocsRedirect() {
  redirect("/dashboard/docs");
}
