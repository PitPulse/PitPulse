import { randomUUID } from "node:crypto";
import { syncEventData, syncEventStats } from "@/lib/event-sync";
import { reportError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LooseSupabaseDatabase } from "@/types/supabase-loose";

const ACTIVE_JOB_PHASES = ["queued", "retrying", "syncing_event", "syncing_stats"] as const;
const MAX_ATTEMPTS = 3;
const STALE_LOCK_MS = 2 * 60 * 1000;

export type EventSyncJobPhase =
  | "queued"
  | "retrying"
  | "syncing_event"
  | "syncing_stats"
  | "done"
  | "failed"
  | "dead";

export type EventSyncJobKind = "full" | "stats_only";

type EventSyncJobResult = {
  eventName: string;
  teams: number | null;
  matches: number | null;
  synced: number;
  errors: number;
  total: number;
  failedTeams: number[];
};

type SyncJobRow = {
  id: string;
  org_id: string;
  requested_by: string;
  event_key: string;
  org_team_number: number | null;
  kind: EventSyncJobKind;
  phase: EventSyncJobPhase;
  progress: number;
  warning: string | null;
  status_message: string;
  error: string | null;
  result: EventSyncJobResult | null;
  attempt_count: number;
  max_attempts: number;
  run_after: string;
  locked_at: string | null;
  locked_by: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

function supabase() {
  return createAdminClient<LooseSupabaseDatabase>();
}

function normalizeJob(row: SyncJobRow) {
  return {
    id: row.id,
    orgId: row.org_id,
    requestedBy: row.requested_by,
    eventKey: row.event_key,
    orgTeamNumber: row.org_team_number,
    kind: row.kind,
    phase: row.phase,
    progress: row.progress,
    warning: row.warning,
    statusMessage: row.status_message,
    error: row.error,
    result: row.result,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    runAfter: row.run_after,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function retryDelaySeconds(attemptCount: number) {
  const cappedAttempt = Math.max(1, Math.min(attemptCount, 6));
  return Math.min(15 * 2 ** (cappedAttempt - 1), 5 * 60);
}

async function updateJob(
  jobId: string,
  patch: Partial<{
    phase: EventSyncJobPhase;
    progress: number;
    warning: string | null;
    status_message: string;
    error: string | null;
    result: EventSyncJobResult | null;
    run_after: string;
    locked_at: string | null;
    locked_by: string | null;
    finished_at: string | null;
  }>
) {
  const db = supabase();
  const { error } = await db
    .from("sync_jobs")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }
}

async function getEventIdByKey(eventKey: string) {
  const db = supabase();
  const { data, error } = await db
    .from("events")
    .select("id, name")
    .eq("tba_key", eventKey)
    .single();

  if (error || !data?.id) {
    throw new Error("Event not found. Sync the event first.");
  }

  return { id: data.id as string, name: (data.name as string | null) ?? null };
}

async function runJob(row: SyncJobRow) {
  if (row.kind === "stats_only") {
    await updateJob(row.id, {
      phase: "syncing_stats",
      progress: 12,
      status_message: "Syncing EPA stats from Statbotics...",
      error: null,
      locked_at: new Date().toISOString(),
    });

    const eventInfo = await getEventIdByKey(row.event_key);
    const statsResult = await syncEventStats({
      supabase: createAdminClient(),
      eventKey: row.event_key,
      eventId: eventInfo.id,
    });

    await updateJob(row.id, {
      phase: "done",
      progress: 100,
      status_message: `Done! Synced EPA for ${statsResult.synced}/${statsResult.total} teams.`,
      result: {
        eventName: eventInfo.name ?? row.event_key.toUpperCase(),
        teams: null,
        matches: null,
        synced: statsResult.synced,
        errors: statsResult.errors,
        total: statsResult.total,
        failedTeams: statsResult.failedTeams,
      },
      warning: null,
      error: null,
      finished_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
    });
    return;
  }

  await updateJob(row.id, {
    phase: "syncing_event",
    progress: 8,
    status_message: "Syncing event data from TBA...",
    error: null,
    locked_at: new Date().toISOString(),
  });

  const eventResult = await syncEventData({
    supabase: createAdminClient(),
    eventKey: row.event_key,
    orgId: row.org_id,
    orgTeamNumber: row.org_team_number,
  });

  await updateJob(row.id, {
    phase: "syncing_stats",
    progress: 58,
    warning: eventResult.warning,
    status_message: `Synced ${eventResult.eventName}: ${eventResult.teamCount} teams, ${eventResult.matchCount} matches. Syncing EPA stats...`,
    locked_at: new Date().toISOString(),
  });

  const statsResult = await syncEventStats({
    supabase: createAdminClient(),
    eventKey: row.event_key,
    eventId: eventResult.eventId,
  });

  await updateJob(row.id, {
    phase: "done",
    progress: 100,
    status_message: `Done! Synced EPA for ${statsResult.synced}/${statsResult.total} teams.`,
    result: {
      eventName: eventResult.eventName,
      teams: eventResult.teamCount,
      matches: eventResult.matchCount,
      synced: statsResult.synced,
      errors: statsResult.errors,
      total: statsResult.total,
      failedTeams: statsResult.failedTeams,
    },
    error: null,
    finished_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
  });
}

async function markRetryOrDead(row: SyncJobRow, error: Error) {
  const attemptsLeft = row.max_attempts - row.attempt_count;
  const now = new Date();

  if (attemptsLeft > 0) {
    const delaySeconds = retryDelaySeconds(row.attempt_count);
    const runAfter = new Date(now.getTime() + delaySeconds * 1000).toISOString();
    await updateJob(row.id, {
      phase: "retrying",
      progress: Math.max(8, Math.min(95, row.progress)),
      error: error.message,
      status_message: `Sync failed. Retrying in ${delaySeconds}s (${row.attempt_count}/${row.max_attempts}).`,
      run_after: runAfter,
      locked_at: null,
      locked_by: null,
    });
    return;
  }

  await updateJob(row.id, {
    phase: "dead",
    progress: 100,
    error: error.message,
    status_message: "Sync failed permanently after retries.",
    finished_at: now.toISOString(),
    locked_at: null,
    locked_by: null,
  });

  await reportError({
    source: "sync-jobs",
    title: "Sync job reached dead-letter state",
    error,
    severity: "critical",
    details: {
      jobId: row.id,
      orgId: row.org_id,
      eventKey: row.event_key,
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
      kind: row.kind,
    },
  });
}

async function recoverStalledJobs() {
  const staleThreshold = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  const db = supabase();
  const { error } = await db
    .from("sync_jobs")
    .update({
      phase: "retrying",
      status_message: "Recovered stalled job. Retrying...",
      run_after: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .in("phase", ["syncing_event", "syncing_stats"])
    .lt("locked_at", staleThreshold);

  if (error) {
    throw new Error(error.message);
  }
}

async function claimNextDueJob(workerId: string) {
  const db = supabase();
  const { data, error } = await db.rpc("claim_next_sync_job", {
    p_worker_id: workerId,
  });

  if (error) {
    if (error.code === "42883") {
      throw new Error(
        "Database function claim_next_sync_job is missing. Run the P0 migration SQL first."
      );
    }
    throw new Error(error.message);
  }

  if (!data) return null;
  const rows = Array.isArray(data) ? data : [data];
  const first = (rows[0] ?? null) as SyncJobRow | null;
  return first;
}

export async function processDueSyncJobs(options?: {
  maxJobs?: number;
  workerId?: string;
}) {
  const maxJobs = Math.max(1, Math.min(options?.maxJobs ?? 1, 25));
  const workerId = options?.workerId ?? `worker-${randomUUID()}`;
  let processed = 0;
  let failed = 0;

  await recoverStalledJobs();

  for (let i = 0; i < maxJobs; i += 1) {
    const claimed = await claimNextDueJob(workerId);
    if (!claimed) break;

    try {
      await runJob(claimed);
      processed += 1;
    } catch (error) {
      failed += 1;
      await markRetryOrDead(
        claimed,
        error instanceof Error ? error : new Error("Sync job failed.")
      );
    }
  }

  return { processed, failed, workerId };
}

export function kickSyncWorker(options?: { maxJobs?: number; workerId?: string }) {
  void processDueSyncJobs(options).catch((error) => {
    void reportError({
      source: "sync-jobs",
      title: "Failed to process queued sync jobs",
      error,
      severity: "critical",
      details: {
        maxJobs: options?.maxJobs ?? 1,
        workerId: options?.workerId ?? null,
      },
    });
  });
}

export async function getActiveEventSyncJob(orgId: string, eventKey: string) {
  const db = supabase();
  const { data, error } = await db
    .from("sync_jobs")
    .select("*")
    .eq("org_id", orgId)
    .eq("event_key", eventKey)
    .in("phase", [...ACTIVE_JOB_PHASES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SyncJobRow | null) ?? null;
}

export async function enqueueEventSyncJob(params: {
  orgId: string;
  requestedBy: string;
  eventKey: string;
  orgTeamNumber: number | null;
  kind?: EventSyncJobKind;
}) {
  const existing = await getActiveEventSyncJob(params.orgId, params.eventKey);
  if (existing) {
    return existing;
  }

  const kind = params.kind ?? "full";
  const db = supabase();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("sync_jobs")
    .insert({
      org_id: params.orgId,
      requested_by: params.requestedBy,
      event_key: params.eventKey,
      kind,
      org_team_number: params.orgTeamNumber,
      phase: "queued",
      progress: 2,
      warning: null,
      status_message:
        kind === "stats_only"
          ? "Job queued. Starting EPA sync..."
          : "Job queued. Starting sync...",
      error: null,
      result: null,
      attempt_count: 0,
      max_attempts: MAX_ATTEMPTS,
      run_after: now,
      locked_at: null,
      locked_by: null,
      finished_at: null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const active = await getActiveEventSyncJob(params.orgId, params.eventKey);
      if (active) return active;
    }
    throw new Error(error.message);
  }

  return data as SyncJobRow;
}

export async function getEventSyncJob(jobId: string) {
  const db = supabase();
  const { data, error } = await db
    .from("sync_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SyncJobRow | null) ?? null;
}

export function toPublicJob(record: SyncJobRow) {
  return normalizeJob(record);
}
