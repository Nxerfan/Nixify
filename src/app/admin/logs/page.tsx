import { redirect } from "next/navigation";
/** /admin/logs → /dashboard/logs (moved to user dashboard). */
export default function LogsRedirect() {
  redirect("/dashboard/logs");
}
