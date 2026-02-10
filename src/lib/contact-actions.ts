"use server";

import { createClient } from "@/lib/supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitContactMessage(formData: FormData) {
  const supabase = await createClient();

  const honeypot = (formData.get("company") as string | null)?.trim();
  if (honeypot) {
    return { error: "Unable to submit message." } as const;
  }

  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const subject = (formData.get("subject") as string | null)?.trim() ?? "";
  const message = (formData.get("message") as string | null)?.trim() ?? "";

  if (!EMAIL_REGEX.test(email)) {
    return { error: "Enter a valid email address." } as const;
  }

  if (subject.length < 3) {
    return { error: "Subject must be at least 3 characters." } as const;
  }

  if (message.length < 10) {
    return { error: "Message must be at least 10 characters." } as const;
  }

  const { error } = await supabase.from("contact_messages").insert({
    email,
    subject,
    message,
    status: "new",
  });

  if (error) {
    return { error: error.message } as const;
  }

  return { success: true } as const;
}
