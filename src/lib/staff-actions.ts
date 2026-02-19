"use server";

import { revalidatePath } from "next/cache";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import {
  getDefaultEventSyncMinYear,
  getDefaultTeamAiPromptLimits,
  getDefaultScoutingFormConfig,
  normalizeScoutingAbilityQuestions,
  normalizeTeamAiPromptLimits,
  normalizeScoutingFormConfig,
  serializeQuestionSettingsPayload,
  type ScoutingFormConfig,
} from "@/lib/platform-settings";
import { resetRateLimitPrefix } from "@/lib/rate-limit";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" } as const;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_staff")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "Profile not found" } as const;
  }

  if (!profile.is_staff) {
    return { error: "Website admin access required" } as const;
  }

  return { supabase, user } as const;
}

export async function updateOrganizationTeamNumber(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return { error: ctx.error } as const;

  const orgId = (formData.get("orgId") as string | null)?.trim();
  if (!orgId) {
    return { error: "Missing organization id" } as const;
  }

  const teamNumberRaw = (formData.get("teamNumber") as string | null)?.trim();
  const teamNumber = teamNumberRaw ? parseInt(teamNumberRaw, 10) : NaN;

  if (!teamNumberRaw || Number.isNaN(teamNumber) || teamNumber <= 0) {
    return { error: "Enter a valid team number" } as const;
  }

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ team_number: teamNumber })
    .eq("id", orgId);

  if (error) {
    return { error: error.message } as const;
  }

  revalidatePath("/dashboard/admin");
  return { success: true } as const;
}

export async function clearOrganizationTeamNumber(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return { error: ctx.error } as const;

  const orgId = (formData.get("orgId") as string | null)?.trim();
  if (!orgId) {
    return { error: "Missing organization id" } as const;
  }

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ team_number: null })
    .eq("id", orgId);

  if (error) {
    return { error: error.message } as const;
  }

  revalidatePath("/dashboard/admin");
  return { success: true } as const;
}

export async function deleteOrganization(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return { error: ctx.error } as const;

  const orgId = (formData.get("orgId") as string | null)?.trim();
  if (!orgId) {
    return { error: "Missing organization id" } as const;
  }

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
    const { error } = await ctx.supabase
      .from(table)
      .delete()
      .eq("org_id", orgId);
    if (error) {
      return { error: error.message } as const;
    }
  }

  const { error: profileError } = await ctx.supabase
    .from("profiles")
    .update({
      org_id: null,
      role: "scout",
      team_roles: [],
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);

  if (profileError) {
    return { error: profileError.message } as const;
  }

  const { error: orgError } = await ctx.supabase
    .from("organizations")
    .delete()
    .eq("id", orgId);

  if (orgError) {
    return { error: orgError.message } as const;
  }

  revalidatePath("/dashboard/admin");
  return { success: true } as const;
}

export async function upsertAnnouncement(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return { error: ctx.error } as const;

  const id = (formData.get("id") as string | null)?.trim() || null;
  const message = (formData.get("message") as string | null)?.trim();
  const variant = (formData.get("variant") as string | null)?.trim() || "info";
  const isActive = formData.get("isActive") === "on";

  if (!message) {
    return { error: "Message is required." } as const;
  }

  const payload = {
    message,
    variant,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? ctx.supabase.from("announcements").update(payload).eq("id", id)
    : ctx.supabase.from("announcements").insert(payload);

  const { error } = await query;
  if (error) {
    return { error: error.message } as const;
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/admin");
  return { success: true } as const;
}

export async function deleteAnnouncement(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return { error: ctx.error } as const;

  const id = (formData.get("id") as string | null)?.trim();
  if (!id) {
    return { error: "Missing announcement id" } as const;
  }

  const { error } = await ctx.supabase.from("announcements").delete().eq("id", id);
  if (error) {
    return { error: error.message } as const;
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/admin");
  return { success: true } as const;
}

export async function upsertTestimonial(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return { error: ctx.error } as const;

  const id = (formData.get("id") as string | null)?.trim() || null;
  const quote = (formData.get("quote") as string | null)?.trim();
  const name = (formData.get("name") as string | null)?.trim();
  const role = (formData.get("role") as string | null)?.trim();
  const team = (formData.get("team") as string | null)?.trim();
  const ratingRaw = (formData.get("rating") as string | null)?.trim();
  const sortRaw = (formData.get("sortOrder") as string | null)?.trim();
  const isPublished = formData.get("isPublished") === "on";

  if (!quote || !name || !role || !team) {
    return { error: "Quote, name, role, and team are required." } as const;
  }

  const rating = ratingRaw ? Math.max(1, Math.min(5, parseInt(ratingRaw, 10))) : 5;
  const sortOrder = sortRaw ? parseInt(sortRaw, 10) : 0;

  const payload = {
    quote,
    name,
    role,
    team,
    rating,
    sort_order: Number.isNaN(sortOrder) ? 0 : sortOrder,
    is_published: isPublished,
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? ctx.supabase.from("testimonials").update(payload).eq("id", id)
    : ctx.supabase.from("testimonials").insert(payload);

  const { error } = await query;

  if (error) {
    return { error: error.message } as const;
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/admin");
  return { success: true } as const;
}

export async function deleteTestimonial(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return { error: ctx.error } as const;

  const id = (formData.get("id") as string | null)?.trim();
  if (!id) {
    return { error: "Missing testimonial id" } as const;
  }

  const { error } = await ctx.supabase.from("testimonials").delete().eq("id", id);
  if (error) {
    return { error: error.message } as const;
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/admin");
  return { success: true } as const;
}

export async function respondContactMessage(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return { error: ctx.error } as const;

  const id = (formData.get("id") as string | null)?.trim();
  if (!id) {
    return { error: "Missing contact message id" } as const;
  }

  const response = (formData.get("response") as string | null)?.trim() ?? "";
  const status = (formData.get("status") as string | null)?.trim() || "new";

  const payload: {
    response: string | null;
    status: string;
    responded_at?: string | null;
    responded_by?: string | null;
  } = {
    response: response.length > 0 ? response : null,
    status,
  };

  if (response.length > 0) {
    payload.responded_at = new Date().toISOString();
    payload.responded_by = ctx.user.id;
  }

  const { error } = await ctx.supabase
    .from("contact_messages")
    .update(payload)
    .eq("id", id);

  if (error) {
    return { error: error.message } as const;
  }

  revalidatePath("/dashboard/admin");
  return { success: true } as const;
}

export async function deleteContactMessage(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return { error: ctx.error } as const;

  const id = (formData.get("id") as string | null)?.trim();
  if (!id) {
    return { error: "Missing contact message id" } as const;
  }

  const { error } = await ctx.supabase
    .from("contact_messages")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message } as const;
  }

  revalidatePath("/dashboard/admin");
  return { success: true } as const;
}

function extractQuestionSettings(raw: unknown): {
  questions: string[];
  aiPromptLimits: { free: number; supporter: number };
  formConfig: ScoutingFormConfig;
} {
  const defaultQuestions = normalizeScoutingAbilityQuestions([]);
  const defaultLimits = getDefaultTeamAiPromptLimits();
  const defaultFormConfig = getDefaultScoutingFormConfig();

  if (!raw) {
    return { questions: defaultQuestions, aiPromptLimits: defaultLimits, formConfig: defaultFormConfig };
  }

  if (Array.isArray(raw)) {
    return {
      questions: normalizeScoutingAbilityQuestions(raw),
      aiPromptLimits: defaultLimits,
      formConfig: defaultFormConfig,
    };
  }

  if (typeof raw !== "object") {
    return { questions: defaultQuestions, aiPromptLimits: defaultLimits, formConfig: defaultFormConfig };
  }

  const obj = raw as Record<string, unknown>;
  const questionSource =
    obj.questions ??
    obj.scoutingAbilityQuestions ??
    obj.scouting_ability_questions;
  const aiLimitsSource = obj.aiPromptLimits ?? obj.ai_prompt_limits;
  const formConfigSource = obj.formConfig ?? obj.form_config;

  return {
    questions: normalizeScoutingAbilityQuestions(questionSource),
    aiPromptLimits: normalizeTeamAiPromptLimits(aiLimitsSource),
    formConfig: normalizeScoutingFormConfig(formConfigSource),
  };
}

export async function updateEventSyncMinYear(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return { error: ctx.error } as const;

  const yearRaw = (formData.get("eventSyncMinYear") as string | null)?.trim();
  const parsedYear = yearRaw ? Number.parseInt(yearRaw, 10) : NaN;
  const currentYear = new Date().getFullYear();

  if (!yearRaw || Number.isNaN(parsedYear)) {
    return { error: "Enter a valid year." } as const;
  }

  if (parsedYear < 1992 || parsedYear > currentYear) {
    return {
      error: `Year must be between 1992 and ${currentYear}.`,
    } as const;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return {
      error: "SUPABASE_SERVICE_ROLE_KEY is missing.",
    } as const;
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { error } = await admin
    .from("platform_settings")
    .upsert(
      {
        id: 1,
        event_sync_min_year: parsedYear,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    if (error.message.toLowerCase().includes("platform_settings")) {
      return {
        error:
          "Platform settings table is missing. Run the new migration first.",
      } as const;
    }
    return { error: error.message } as const;
  }

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard");
  return { success: true } as const;
}

export async function updateScoutingAbilityQuestions(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return { error: ctx.error } as const;

  const raw = (formData.get("questionsJson") as string | null)?.trim();
  if (!raw) {
    return { error: "Missing scouting list payload." } as const;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Invalid scouting list payload." } as const;
  }

  const questions = normalizeScoutingAbilityQuestions(parsed);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return {
      error: "SUPABASE_SERVICE_ROLE_KEY is missing.",
    } as const;
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { data: current } = await admin
    .from("platform_settings")
    .select("event_sync_min_year, scouting_ability_questions")
    .eq("id", 1)
    .maybeSingle();

  const eventSyncMinYear =
    current?.event_sync_min_year ?? getDefaultEventSyncMinYear();
  const { aiPromptLimits, formConfig } = extractQuestionSettings(
    current?.scouting_ability_questions
  );

  const { error } = await admin
    .from("platform_settings")
    .upsert(
      {
        id: 1,
        event_sync_min_year: eventSyncMinYear,
        scouting_ability_questions: serializeQuestionSettingsPayload({
          questions,
          aiPromptLimits,
          formConfig,
        }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    if (error.message.toLowerCase().includes("scouting_ability_questions")) {
      return {
        error:
          "Scouting question settings are missing in the database. Run the latest migration first.",
      } as const;
    }
    if (error.message.toLowerCase().includes("platform_settings")) {
      return {
        error:
          "Platform settings table is missing. Run the new migration first.",
      } as const;
    }
    return { error: error.message } as const;
  }

  revalidatePath("/dashboard/admin");
  revalidatePath("/scout");
  return { success: true } as const;
}

export async function updateTeamAiPromptLimits(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return { error: ctx.error } as const;

  const freeRaw = (formData.get("freeAiLimit") as string | null)?.trim();
  const supporterRaw = (formData.get("supporterAiLimit") as string | null)?.trim();

  if (!freeRaw || !supporterRaw) {
    return { error: "Both free and supporter limits are required." } as const;
  }

  const freeParsed = Number.parseInt(freeRaw, 10);
  const supporterParsed = Number.parseInt(supporterRaw, 10);

  if (
    Number.isNaN(freeParsed) ||
    Number.isNaN(supporterParsed) ||
    freeParsed < 1 ||
    supporterParsed < 1 ||
    freeParsed > 50 ||
    supporterParsed > 50
  ) {
    return { error: "Limits must be whole numbers between 1 and 50." } as const;
  }

  if (supporterParsed < freeParsed) {
    return {
      error: "Supporter limit should be greater than or equal to free limit.",
    } as const;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return {
      error: "SUPABASE_SERVICE_ROLE_KEY is missing.",
    } as const;
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { data: current } = await admin
    .from("platform_settings")
    .select("event_sync_min_year, scouting_ability_questions")
    .eq("id", 1)
    .maybeSingle();

  const eventSyncMinYear =
    current?.event_sync_min_year ?? getDefaultEventSyncMinYear();
  const { questions, formConfig } = extractQuestionSettings(current?.scouting_ability_questions);

  const { error } = await admin
    .from("platform_settings")
    .upsert(
      {
        id: 1,
        event_sync_min_year: eventSyncMinYear,
        scouting_ability_questions: serializeQuestionSettingsPayload({
          questions,
          aiPromptLimits: {
            free: freeParsed,
            supporter: supporterParsed,
          },
          formConfig,
        }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    if (error.message.toLowerCase().includes("scouting_ability_questions")) {
      return {
        error:
          "AI prompt limit settings are missing in the database. Run the latest migration first.",
      } as const;
    }
    if (error.message.toLowerCase().includes("platform_settings")) {
      return {
        error:
          "Platform settings table is missing. Run the new migration first.",
      } as const;
    }
    return { error: error.message } as const;
  }

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/events");
  return { success: true } as const;
}

export async function updateScoutingFormConfig(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return { error: ctx.error } as const;

  const raw = (formData.get("formConfigJson") as string | null)?.trim();
  if (!raw) {
    return { error: "Missing scouting form config payload." } as const;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Invalid scouting form config payload." } as const;
  }

  const formConfig = normalizeScoutingFormConfig(parsed);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return {
      error: "SUPABASE_SERVICE_ROLE_KEY is missing.",
    } as const;
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { data: current } = await admin
    .from("platform_settings")
    .select("event_sync_min_year, scouting_ability_questions")
    .eq("id", 1)
    .maybeSingle();

  const eventSyncMinYear =
    current?.event_sync_min_year ?? getDefaultEventSyncMinYear();
  const { questions, aiPromptLimits } = extractQuestionSettings(
    current?.scouting_ability_questions
  );

  const { error } = await admin
    .from("platform_settings")
    .upsert(
      {
        id: 1,
        event_sync_min_year: eventSyncMinYear,
        scouting_ability_questions: serializeQuestionSettingsPayload({
          questions,
          aiPromptLimits,
          formConfig,
        }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    if (error.message.toLowerCase().includes("platform_settings")) {
      return {
        error:
          "Platform settings table is missing. Run the new migration first.",
      } as const;
    }
    return { error: error.message } as const;
  }

  revalidatePath("/dashboard/admin");
  revalidatePath("/scout");
  return { success: true } as const;
}

export async function resetAllTeamAiCooldowns() {
  const ctx = await requireStaff();
  if ("error" in ctx) {
    return { error: ctx.error } as const;
  }

  const result = await resetRateLimitPrefix("ai-interactions:");

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/events");

  return {
    success: true,
    deleted: result.deleted,
    backend: result.backend,
  } as const;
}
