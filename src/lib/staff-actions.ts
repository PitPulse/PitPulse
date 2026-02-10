"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  if ("error" in ctx) return ctx;

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
  if ("error" in ctx) return ctx;

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

export async function upsertAnnouncement(formData: FormData) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx;

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
  if ("error" in ctx) return ctx;

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
  if ("error" in ctx) return ctx;

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
  if ("error" in ctx) return ctx;

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
  if ("error" in ctx) return ctx;

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
  if ("error" in ctx) return ctx;

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
