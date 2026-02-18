"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { signOut } from "@/lib/auth-actions";
import { useTranslation } from "@/components/i18n-provider";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { getPendingCount } from "@/lib/offline-queue";
import { clearAllOfflineData } from "@/lib/offline-cleanup";

interface UserMenuProps {
  name: string;
  email: string;
  isStaff: boolean;
}

function initialsFor(name: string, email: string) {
  const trimmed = name.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
  }
  if (email) {
    return email[0]?.toUpperCase() || "U";
  }
  return "U";
}

export function UserMenu({ name, email, isStaff }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { locale, setLocale, t } = useTranslation();

  // Poll pending count every 10s for badge
  const refreshPending = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB may not be available
    }
  }, []);

  useEffect(() => {
    void refreshPending();
    const interval = setInterval(() => void refreshPending(), 10000);
    return () => clearInterval(interval);
  }, [refreshPending]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const initials = initialsFor(name, email);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 text-sm font-semibold text-white transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open account menu"
      >
        <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 transition-opacity duration-200 group-active:opacity-100" />
        <span className="absolute inset-0 animate-ping rounded-full bg-teal-400 opacity-0 group-active:opacity-30" style={{ animationDuration: '0.4s', animationIterationCount: 1 }} />
        {initials}
        {pendingCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow"
            aria-label={`${pendingCount} entries pending sync`}
          >
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 max-h-[calc(100vh-120px)] max-w-[calc(100vw-24px)] overflow-hidden overflow-y-auto rounded-xl border border-white/10 bg-gray-950/95 text-white shadow-2xl backdrop-blur"
        >
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-sm font-semibold text-white">{name || "Account"}</p>
            <p className="text-sm text-gray-400">{email}</p>
          </div>

          <div className="py-2">
            <Link
              href="/dashboard/settings/account"
              className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-white/5"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              {t("menu.accountSettings")}
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-white/5"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9" /><path d="M9 21V9h6v12" /></svg>
              {t("menu.dashboard")}
            </Link>
            {isStaff && (
              <Link
                href="/dashboard/admin"
                className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-white/5"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18" /><path d="M12 3v18" /></svg>
                {t("menu.admin")}
              </Link>
            )}
          </div>

          {/* Language Selector */}
          <div className="border-t border-white/10 px-5 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {t("menu.language")}
            </p>
            <div className="flex gap-1.5">
              {LOCALES.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocale(loc as Locale)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    locale === loc
                      ? "bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/30"
                      : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                  }`}
                >
                  {LOCALE_LABELS[loc as Locale]}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 px-5 py-3">
            <button
              type="button"
              onClick={async () => {
                // Clear all offline data for privacy on shared devices
                try {
                  await clearAllOfflineData();
                } catch {
                  // Best effort — proceed with signOut regardless
                }
                await signOut();
              }}
              className="flex w-full items-center gap-3 text-sm font-semibold text-red-400 transition hover:text-red-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              {t("menu.signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
