import { redirect } from "next/navigation";
/** /admin/errors → /dashboard/errors (moved to user dashboard). */
export default function ErrorsRedirect() {
  redirect("/dashboard/errors");
}
