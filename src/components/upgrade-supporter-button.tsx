"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";

interface UpgradeSupporterButtonProps {
  className?: string;
}

export function UpgradeSupporterButton({ className }: UpgradeSupporterButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; url?: string }
        | null;

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Failed to start checkout.");
      }

      window.location.assign(data.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start checkout.";
      toast(message, "error");
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCheckout()}
      disabled={loading}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
      }
    >
      {loading ? "Redirecting..." : "Upgrade to Supporter"}
    </button>
  );
}

