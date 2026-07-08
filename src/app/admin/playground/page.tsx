import { redirect } from "next/navigation";
/** /admin/playground → /dashboard/playground (moved to user dashboard). */
export default function PlaygroundRedirect() {
  redirect("/dashboard/playground");
}
