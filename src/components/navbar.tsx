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
    info: "border-blue-500/30 bg-blue-500/10 text-blue-100",
    success: "border-green-500/30 bg-green-500/10 text-green-100",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    danger: "border-red-500/30 bg-red-500/10 text-red-100",
  };

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-gray-950/80 backdrop-blur-xl">
      {announcement?.message && (
        <div className={`border-b px-4 py-2 text-center text-xs font-medium ${bannerStyles[announcement.variant] ?? bannerStyles.info}`}>
          {announcement.message}
        </div>
      )}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          Scout<span className="text-blue-500">AI</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <UserMenu
              name={profile?.display_name ?? user.email ?? "Account"}
              email={user.email ?? ""}
              isStaff={profile?.is_staff === true}
            />
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-sm font-medium text-gray-400 transition hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
