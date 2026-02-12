"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const MAX_TEAM_ROLES = 4;
const ALLOWED_TEAM_ROLES = new Set([
  "driver",
  "coach",
  "programmer",
  "scout",
  "data",
  "mechanical",
  "electrical",
  "cad",
  "pit",
  "mentor",
  "other",
]);

function sanitizeTeamRoles(rawRoles: string[]) {
  return Array.from(
    new Set(
      rawRoles
        .map((role) => role.trim())
        .filter((role) => ALLOWED_TEAM_ROLES.has(role))
    )
  );
}

function resolveSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;

  const port = process.env.PORT?.trim() || "3000";
  return `http://localhost:${port}`;
}

export async function sendMagicLink(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const siteUrl = resolveSiteUrl();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No O/0/1/I to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function fetchTeamName(teamNumber: number): Promise<string | null> {
  const apiKey = process.env.TBA_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://www.thebluealliance.com/api/v3/team/frc${teamNumber}`,
      {
        headers: { "X-TBA-Auth-Key": apiKey },
        next: { revalidate: 86400 }, // cache for 24h
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.nickname || data.name || null;
  } catch {
    return null;
  }
}

export async function createOrganization(formData: FormData) {
  const supabase = await createClient();

  const teamNumberStr = formData.get("teamNumber") as string;
  const teamNumber = parseInt(teamNumberStr, 10);

  if (isNaN(teamNumber) || teamNumber < 1 || teamNumber > 99999) {
    return { error: "Please enter a valid FRC team number (1–99999)." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Ensure a profile row exists for this user
  await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: user.user_metadata?.display_name ?? user.email ?? "User",
        role: "scout",
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

  // Check if this team number is already registered
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("team_number", teamNumber)
    .single();

  if (existing) {
    return {
      error: `Team ${teamNumber} is already registered. Ask your team captain for the join code.`,
    };
  }

  // Fetch team name from TBA
  const tbaName = await fetchTeamName(teamNumber);
  const orgName = tbaName
    ? `Team ${teamNumber} – ${tbaName}`
    : `Team ${teamNumber}`;

  const joinCode = generateJoinCode();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: orgName,
      team_number: teamNumber,
      join_code: joinCode,
    })
    .select()
    .single();

  if (orgError) {
    return { error: orgError.message };
  }

  // Update profile with org_id and captain role
  const { data: updatedProfile, error: profileError } = await supabase
    .from("profiles")
    .update({ org_id: org.id, role: "captain", onboarding_complete: true })
    .eq("id", user.id)
    .select("id, org_id, role")
    .single();

  if (profileError) {
    return { error: profileError.message };
  }
  if (!updatedProfile?.org_id) {
    return { error: "Failed to link profile to organization." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateOrganization(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify captain role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "captain") {
    return { error: "Only captains can update team settings." };
  }

  if (!profile.org_id) {
    return { error: "No organization found." };
  }

  const name = (formData.get("name") as string).trim();
  if (!name) {
    return { error: "Team name cannot be empty." };
  }

  const { error } = await supabase
    .from("organizations")
    .update({ name })
    .eq("id", profile.org_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Ensure a profile row exists for this user
  await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: user.user_metadata?.display_name ?? user.email ?? "User",
        role: "scout",
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

  const displayName = (formData.get("displayName") as string).trim();
  if (!displayName) {
    return { error: "Display name cannot be empty." };
  }

  const teamRoles = sanitizeTeamRoles(
    (formData.getAll("teamRoles") as string[]).map((role) => String(role))
  );

  if (teamRoles.length > MAX_TEAM_ROLES) {
    return { error: `Select up to ${MAX_TEAM_ROLES} team roles.` };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      team_roles: teamRoles,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/settings/account");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "Profile not found" };
  }

  if (profile.org_id && profile.role === "captain") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", profile.org_id)
      .eq("role", "captain");

    if ((count ?? 0) <= 1) {
      return {
        error: "Assign another captain before deleting your account.",
      };
    }
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return { error: "Service role key not configured." };
  }

  if (profile.org_id) {
    await supabase
      .from("profiles")
      .update({
        org_id: null,
        role: "scout",
        team_roles: [],
        onboarding_complete: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return { error: deleteError.message };
  }

  await supabase.auth.signOut();
  revalidatePath("/dashboard/settings/account");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function leaveOrganization() {
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

  if (!profile.org_id) {
    return { error: "You are not on a team." } as const;
  }

  if (profile.role === "captain") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", profile.org_id)
      .eq("role", "captain");

    if ((count ?? 0) <= 1) {
      return {
        error: "Assign another captain before leaving your team.",
      } as const;
    }
  }

  await supabase
    .from("scout_assignments")
    .delete()
    .eq("org_id", profile.org_id)
    .eq("assigned_to", user.id);

  const { error } = await supabase
    .from("profiles")
    .update({
      org_id: null,
      role: "scout",
      onboarding_complete: false,
      team_roles: [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message } as const;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { success: true } as const;
}

export async function deleteOrganizationAsCaptain() {
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
    return { error: "Only captains can delete a team." } as const;
  }

  if (!profile.org_id) {
    return { error: "No team found." } as const;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return { error: "Service role key not configured." } as const;
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  const tablesToDelete = [
    "team_messages",
    "draft_sessions",
    "scout_assignments",
    "scouting_entries",
    "strategy_briefs",
    "pick_lists",
    "org_events",
  ] as const;

  for (const table of tablesToDelete) {
    const { error } = await admin.from(table).delete().eq("org_id", profile.org_id);
    if (error) {
      return { error: error.message } as const;
    }
  }

  const { error: membersError } = await admin
    .from("profiles")
    .update({
      org_id: null,
      role: "scout",
      team_roles: [],
      onboarding_complete: false,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", profile.org_id);

  if (membersError) {
    return { error: membersError.message } as const;
  }

  const { error: orgError } = await admin
    .from("organizations")
    .delete()
    .eq("id", profile.org_id);

  if (orgError) {
    return { error: orgError.message } as const;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/join");
  return { success: true } as const;
}

export async function joinOrganization(formData: FormData) {
  const supabase = await createClient();

  const joinCode = (formData.get("joinCode") as string).toUpperCase().trim();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Ensure a profile row exists for this user
  await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: user.user_metadata?.display_name ?? user.email ?? "User",
        role: "scout",
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

  // Find org by join code
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("join_code", joinCode)
    .single();

  if (orgError || !org) {
    return { error: "Invalid join code. Please check and try again." };
  }

  // Update profile with org_id
  const { data: updatedProfile, error: profileError } = await supabase
    .from("profiles")
    .update({ org_id: org.id, role: "scout", onboarding_complete: false })
    .eq("id", user.id)
    .select("id, org_id, role")
    .single();

  if (profileError) {
    return { error: profileError.message };
  }
  if (!updatedProfile?.org_id) {
    return { error: "Failed to link profile to organization." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const displayName = (formData.get("displayName") as string | null)?.trim();
  const roles = formData
    .getAll("teamRoles")
    .map((r) => String(r));
  const sanitizedRoles = sanitizeTeamRoles(roles);

  if (!displayName) {
    return { error: "Please enter your name." };
  }

  if (sanitizedRoles.length === 0) {
    return { error: "Select at least one team role." };
  }

  if (sanitizedRoles.length > MAX_TEAM_ROLES) {
    return { error: `Select up to ${MAX_TEAM_ROLES} team roles.` };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    return { error: "Join a team before completing onboarding." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      team_roles: sanitizedRoles,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
