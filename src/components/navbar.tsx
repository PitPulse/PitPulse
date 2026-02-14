import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/user-menu";

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("display_name, role, is_staff")
        .eq("id", user.id)
        .single()
    : { data: null };

  const { data: announcement } = await supabase
    .from("announcements")
    .select("message, variant")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const bannerStyles: Record<string, string> = {
    info: "border-teal-500/30 bg-teal-500/10 text-teal-100",
    success: "border-green-500/30 bg-green-500/10 text-green-100",
    warning: "border-teal-500/30 bg-teal-500/10 text-teal-100",
    danger: "border-red-500/30 bg-red-500/10 text-red-100",
  };

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/[0.06] bg-[#06080f]/80 backdrop-blur-2xl">
      {announcement?.message && (
        <div className={`border-b px-4 py-2 text-center text-xs font-medium ${bannerStyles[announcement.variant] ?? bannerStyles.info}`}>
          {announcement.message}
        </div>
      )}
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-outfit text-lg font-bold tracking-tight text-white">
          Pit<span className="text-teal-400">Pilot</span>
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu
              name={profile?.display_name ?? user.email ?? "Account"}
              email={user.email ?? ""}
              isStaff={profile?.is_staff === true}
            />
          ) : (
            <>
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-400 transition hover:bg-white/5 hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-teal-500 px-4 py-1.5 text-sm font-semibold text-gray-950 transition hover:bg-teal-400"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
