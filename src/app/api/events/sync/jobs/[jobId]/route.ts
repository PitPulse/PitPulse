import { NextResponse } from "next/server";
import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import { getEventSyncJob, kickSyncWorker, toPublicJob } from "@/lib/sync-job-queue";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!profile?.org_id) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    const job = await getEventSyncJob(jobId);
    if (!job || job.org_id !== profile.org_id) {
      return NextResponse.json({ error: "Sync job not found" }, { status: 404 });
    }

    if (
      job.phase === "queued" ||
      job.phase === "retrying" ||
      job.phase === "syncing_event" ||
      job.phase === "syncing_stats"
    ) {
      kickSyncWorker({ maxJobs: 1, workerId: `poll-${profile.org_id}` });
    }

    return NextResponse.json({ success: true, job: toPublicJob(job) });
  } catch (error) {
    await reportError({
      source: "sync-jobs-api",
      title: "Failed to fetch sync job status",
      error,
      severity: "error",
    });
    const message = error instanceof Error ? error.message : "Failed to fetch job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
