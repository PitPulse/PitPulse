import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter } from "@/components/site-footer";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, onboarding_complete, is_staff")
    .eq("id", user.id)
    .single();

  if (!profile?.is_staff && !profile?.org_id) {
    redirect("/join");
  }

  if (!profile?.is_staff && profile?.org_id && !profile?.onboarding_complete) {
    redirect("/onboarding");
  }

  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
