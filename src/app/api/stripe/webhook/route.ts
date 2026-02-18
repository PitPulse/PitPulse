import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  getStripeWebhookSecret,
  retrieveStripeSubscription,
  verifyStripeWebhookSignature,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTER_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

interface StripeEvent<T = unknown> {
  id: string;
  type: string;
  data: {
    object: T;
  };
}

interface StripeCheckoutSessionObject {
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
}

interface StripeSubscriptionObject {
  id: string;
  status: string;
  metadata?: Record<string, string>;
}

interface StripeInvoiceObject {
  subscription?: string | null;
  metadata?: Record<string, string>;
  lines?: {
    data?: Array<{
      metadata?: Record<string, string>;
    }>;
  };
}

function metadataValue(
  metadata: Record<string, string> | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service credentials are missing.");
  }

  return createAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function applyOrgPlan(orgId: string, planTier: "free" | "supporter") {
  const admin = getAdminClient();
  const { data: existing, error: readError } = await admin
    .from("organizations")
    .select("plan_tier")
    .eq("id", orgId)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  if (!existing) {
    throw new Error("Organization not found.");
  }

  // Gifted supporter teams are manually managed and should not be overwritten by Stripe events.
  if (existing.plan_tier === "gifted_supporter") {
    return;
  }

  const { error } = await admin
    .from("organizations")
    .update({ plan_tier: planTier })
    .eq("id", orgId);

  if (error) {
    throw new Error(error.message);
  }
}

async function orgIdFromInvoice(invoice: StripeInvoiceObject) {
  const direct =
    metadataValue(invoice.metadata, "org_id") ??
    metadataValue(invoice.lines?.data?.[0]?.metadata, "org_id");
  if (direct) return direct;

  if (!invoice.subscription || typeof invoice.subscription !== "string") {
    return null;
  }

  try {
    const subscription = await retrieveStripeSubscription(invoice.subscription);
    return metadataValue(subscription.metadata, "org_id");
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const signatureHeader = request.headers.get("stripe-signature");
  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();

  let webhookSecret: string;
  try {
    webhookSecret = getStripeWebhookSecret();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "STRIPE_WEBHOOK_SECRET is missing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const isValid = verifyStripeWebhookSignature({
    payload,
    signatureHeader,
    webhookSecret,
  });

  if (!isValid) {
    console.warn(
      "Stripe webhook signature verification failed.",
      "Signature header present:", !!signatureHeader,
      "Payload length:", payload.length
    );
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as StripeCheckoutSessionObject;
        const orgId =
          metadataValue(session.metadata, "org_id") ??
          (typeof session.client_reference_id === "string"
            ? session.client_reference_id
            : null);

        if (orgId) {
          await applyOrgPlan(orgId, "supporter");
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as StripeSubscriptionObject;
        const orgId = metadataValue(subscription.metadata, "org_id");
        if (!orgId) break;

        const planTier =
          event.type === "customer.subscription.deleted"
            ? "free"
            : SUPPORTER_STATUSES.has(subscription.status)
            ? "supporter"
            : "free";

        await applyOrgPlan(orgId, planTier);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as StripeInvoiceObject;
        const orgId = await orgIdFromInvoice(invoice);
        if (orgId) {
          await applyOrgPlan(orgId, "supporter");
        }
        break;
      }
      case "invoice.payment_failed":
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
