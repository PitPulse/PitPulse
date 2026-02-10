import { redirect } from "next/navigation";

export default function StaffAdminRedirect() {
  redirect("/dashboard/admin");
}
