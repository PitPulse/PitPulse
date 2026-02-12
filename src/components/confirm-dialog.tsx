"use client";

import { useEffect } from "react";

type ConfirmTone = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const toneStyles: Record<
  ConfirmTone,
  { icon: string; button: string }
> = {
  danger: {
    icon: "bg-red-500/20 text-red-300",
    button: "bg-red-600 hover:bg-red-500 text-white",
  },
  warning: {
    icon: "bg-amber-500/20 text-amber-300",
    button: "bg-amber-600 hover:bg-amber-500 text-white",
  },
  info: {
    icon: "bg-blue-500/20 text-blue-300",
    button: "bg-blue-600 hover:bg-blue-500 text-white",
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  confirmDisabled = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const toneClass = toneStyles[tone];

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl dashboard-panel p-6"
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 flex-none items-center justify-center rounded-full aspect-square ${toneClass.icon}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-gray-300">{description}</p>
            )}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${toneClass.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
