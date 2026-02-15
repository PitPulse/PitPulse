import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

interface StripeApiErrorResponse {
  error?: {
    message?: string;
    type?: string;
  };
}

interface StripeSearchResponse<T> {
  data: T[];
}

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
  client_reference_id: string | null;
  metadata?: Record<string, string>;
}

export interface StripeBillingPortalSession {
  id: string;
  url: string;
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  current_period_start?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean;
  cancel_at?: number | null;
  metadata?: Record<string, string>;
  items?: {
    data?: Array<{
      id: string;
      current_period_start?: number | null;
      current_period_end?: number | null;
    }>;
  };
}

export interface StripeInvoice {
  id: string;
  status: string | null;
  currency: string;
  amount_paid: number;
  amount_due: number;
  created: number;
  hosted_invoice_url: string | null;
  period_start?: number | null;
  period_end?: number | null;
}

interface StripeListResponse<T> {
  data: T[];
}

export interface OrgBillingOverview {
  stripeConfigured: boolean;
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: number | null;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
    cancelAt: number | null;
    customerId: string;
  } | null;
  invoices: Array<{
    id: string;
    status: string | null;
    currency: string;
    amountPaid: number;
    amountDue: number;
    created: number;
    hostedInvoiceUrl: string | null;
  }>;
  error: string | null;
}

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function getStripeWebhookSecret() {
  return readRequiredEnv("STRIPE_WEBHOOK_SECRET");
}

export function getStripeSupporterPriceId() {
  return readRequiredEnv("STRIPE_SUPPORTER_PRICE_ID");
}

function getStripeSecretKey() {
  return readRequiredEnv("STRIPE_SECRET_KEY");
}

export function isStripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_SUPPORTER_PRICE_ID?.trim()
  );
}

async function stripeRequest<T>(
  method: "GET" | "POST",
  path: string,
  params?: URLSearchParams
): Promise<T> {
  const secretKey = getStripeSecretKey();
  const url = new URL(`${STRIPE_API_BASE}${path}`);
  const headers: HeadersInit = {
    Authorization: `Bearer ${secretKey}`,
  };

  let body: string | undefined;

  if (method === "GET") {
    if (params) url.search = params.toString();
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = params?.toString();
  }

  const response = await fetch(url, { method, headers, body, cache: "no-store" });
  const text = await response.text();

  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const maybeError = parsed as StripeApiErrorResponse | null;
    const message =
      maybeError?.error?.message ??
      `Stripe request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return parsed as T;
}

function escapeStripeSearchValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

export async function createStripeCheckoutSession(input: {
  orgId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}) {
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", getStripeSupporterPriceId());
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  params.set("client_reference_id", input.orgId);
  params.set("metadata[org_id]", input.orgId);
  params.set("metadata[product]", "supporter");
  params.set("subscription_data[metadata][org_id]", input.orgId);
  params.set("subscription_data[metadata][plan_tier]", "supporter");
  params.set("allow_promotion_codes", "true");

  if (input.customerEmail) {
    params.set("customer_email", input.customerEmail);
  }

  return stripeRequest<StripeCheckoutSession>(
    "POST",
    "/checkout/sessions",
    params
  );
}

export async function findStripeSubscriptionByOrgId(orgId: string) {
  const escapedOrgId = escapeStripeSearchValue(orgId);
  const params = new URLSearchParams();
  params.set("query", `metadata['org_id']:'${escapedOrgId}'`);
  params.set("limit", "10");

  try {
    const result = await stripeRequest<StripeSearchResponse<StripeSubscription>>(
      "GET",
      "/subscriptions/search",
      params
    );

    if (!result.data || result.data.length === 0) {
      return null;
    }

    return result.data.sort((a, b) => {
      const aActive = ACTIVE_SUBSCRIPTION_STATUSES.has(a.status);
      const bActive = ACTIVE_SUBSCRIPTION_STATUSES.has(b.status);
      if (aActive === bActive) return 0;
      return aActive ? -1 : 1;
    })[0];
  } catch {
    return null;
  }
}

export async function createStripeBillingPortalSession(input: {
  customerId: string;
  returnUrl: string;
}) {
  const params = new URLSearchParams();
  params.set("customer", input.customerId);
  params.set("return_url", input.returnUrl);
  return stripeRequest<StripeBillingPortalSession>(
    "POST",
    "/billing_portal/sessions",
    params
  );
}

export async function retrieveStripeSubscription(subscriptionId: string) {
  return stripeRequest<StripeSubscription>(
    "GET",
    `/subscriptions/${encodeURIComponent(subscriptionId)}`
  );
}

export async function listStripeInvoices(input: {
  customerId?: string;
  subscriptionId?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? 6));
  if (input.customerId) {
    params.set("customer", input.customerId);
  }
  if (input.subscriptionId) {
    params.set("subscription", input.subscriptionId);
  }

  const response = await stripeRequest<StripeListResponse<StripeInvoice>>(
    "GET",
    "/invoices",
    params
  );
  return response.data ?? [];
}

export async function getOrgBillingOverview(
  orgId: string
): Promise<OrgBillingOverview> {
  if (!isStripeConfigured()) {
    return {
      stripeConfigured: false,
      subscription: null,
      invoices: [],
      error: null,
    };
  }

  try {
    const foundSubscription = await findStripeSubscriptionByOrgId(orgId);
    if (!foundSubscription) {
      return {
        stripeConfigured: true,
        subscription: null,
        invoices: [],
        error: null,
      };
    }

    let subscription = foundSubscription;
    // Stripe search responses can omit period fields on some API versions.
    // Fetch the full subscription object when period fields are missing.
    if (
      subscription.current_period_start == null ||
      subscription.current_period_end == null
    ) {
      try {
        subscription = await retrieveStripeSubscription(subscription.id);
      } catch {
        // Keep using the search result if retrieve fails.
      }
    }

    const itemPeriods = (subscription.items?.data ?? []).reduce(
      (acc, item) => {
        const itemStart = item.current_period_start ?? null;
        const itemEnd = item.current_period_end ?? null;

        if (itemStart !== null) {
          acc.start =
            acc.start === null ? itemStart : Math.min(acc.start, itemStart);
        }
        if (itemEnd !== null) {
          acc.end = acc.end === null ? itemEnd : Math.max(acc.end, itemEnd);
        }

        return acc;
      },
      { start: null as number | null, end: null as number | null }
    );

    const resolvedCurrentPeriodStart =
      subscription.current_period_start ?? itemPeriods.start;
    const resolvedCurrentPeriodEnd =
      subscription.current_period_end ?? itemPeriods.end;

    const invoices = await listStripeInvoices({
      customerId: subscription.customer,
      subscriptionId: subscription.id,
      limit: 6,
    });

    const latestInvoiceWithPeriod =
      invoices.find(
        (invoice) =>
          invoice.period_start != null && invoice.period_end != null
      ) ?? null;

    return {
      stripeConfigured: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart:
          resolvedCurrentPeriodStart ?? latestInvoiceWithPeriod?.period_start ?? null,
        currentPeriodEnd:
          resolvedCurrentPeriodEnd ?? latestInvoiceWithPeriod?.period_end ?? null,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        cancelAt: subscription.cancel_at ?? null,
        customerId: subscription.customer,
      },
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        status: invoice.status ?? null,
        currency: invoice.currency,
        amountPaid: invoice.amount_paid,
        amountDue: invoice.amount_due,
        created: invoice.created,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      })),
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to read Stripe billing status.";
    return {
      stripeConfigured: true,
      subscription: null,
      invoices: [],
      error: message,
    };
  }
}

export function verifyStripeWebhookSignature(input: {
  payload: string;
  signatureHeader: string;
  webhookSecret: string;
  toleranceSeconds?: number;
}) {
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  const parts = input.signatureHeader.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signatureParts = parts.filter((part) => part.startsWith("v1="));

  if (!timestampPart || signatureParts.length === 0) {
    return false;
  }

  const timestamp = Number.parseInt(timestampPart.slice(2), 10);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  const signedPayload = `${timestamp}.${input.payload}`;
  const expected = createHmac("sha256", input.webhookSecret)
    .update(signedPayload)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  const valid = signatureParts.some((part) => {
    const candidate = part.slice(3);
    if (!candidate || candidate.length !== expected.length) {
      return false;
    }
    const candidateBuffer = Buffer.from(candidate, "hex");
    if (candidateBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(candidateBuffer, expectedBuffer);
  });

  if (!valid) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - timestamp) <= toleranceSeconds;
}
