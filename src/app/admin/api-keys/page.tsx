import { redirect } from "next/navigation";
/** /admin/api-keys → /dashboard/api-keys (moved to user dashboard). */
export default function ApiKeysRedirect() {
  redirect("/dashboard/api-keys");
}
