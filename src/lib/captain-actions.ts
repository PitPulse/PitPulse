"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ROLE_OPTIONS = ["scout", "strategist", "captain"] as const;
type UserRole = (typeof ROLE_OPTIONS)[number];

async function requireCaptain() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" } as const;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "Profile not found" } as const;
  }

  if (profile.role !== "captain") {
    return { error: "Captain access required" } as const;
  }

  if (!profile.org_id) {
    return { error: "Organization not found" } as const;
  }

  return { supabase, profile, user } as const;
}

export async function updateMemberRole(formData: FormData) {
  const ctx = await requireCaptain();
  if ("error" in ctx) return ctx;

  const memberId = (formData.get("memberId") as string | null)?.trim();
  const role = (formData.get("role") as string | null)?.trim() as UserRole | null;

  if (!memberId) {
    return { error: "Missing member id" } as const;
  }

  if (!role || !ROLE_OPTIONS.includes(role)) {
    return { error: "Invalid role" } as const;
  }

  // Prevent removing the last captain in the org
  if (role !== "captain") {
    const { data: target } = await ctx.supabase
      .from("profiles")
      .select("id, role")
      .eq("id", memberId)
      .eq("org_id", ctx.profile.org_id)
      .single();

    if (!target) {
      return { error: "Member not found" } as const;
    }

    if (target.role === "captain") {
      const { count } = await ctx.supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("org_id", ctx.profile.org_id)
        .eq("role", "captain");

      if ((count ?? 0) <= 1) {
        return { error: "You must keep at least one captain in the organization." } as const;
      }
    }
  }

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("org_id", ctx.profile.org_id);

  if (error) {
    return { error: error.message } as const;
  }

  revalidatePath("/dashboard/settings");
  return { success: true } as const;
}
