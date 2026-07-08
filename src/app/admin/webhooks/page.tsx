import { redirect } from "next/navigation";
/** /admin/webhooks → /dashboard/webhooks (moved to user dashboard). */
export default function WebhooksRedirect() {
  redirect("/dashboard/webhooks");
}
