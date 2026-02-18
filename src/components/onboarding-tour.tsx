"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/components/i18n-provider";

interface TourStep {
  /** CSS selector to highlight (null = centered modal) */
  selector: string | null;
  titleKey: string;
  descKey: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    selector: null,
    titleKey: "tour.welcome",
    descKey: "tour.welcomeDesc",
  },
  {
    selector: "[data-tour='quick-sync']",
    titleKey: "tour.syncEvents",
    descKey: "tour.syncEventsDesc",
  },
  {
    selector: "[data-tour='events-list']",
    titleKey: "tour.yourEvents",
    descKey: "tour.yourEventsDesc",
  },
  {
    selector: "[data-tour='scouting-reports']",
    titleKey: "tour.scoutingReports",
    descKey: "tour.scoutingReportsDesc",
  },
  {
    selector: "[data-tour='team-pulse']",
    titleKey: "tour.teamPulse",
    descKey: "tour.teamPulseDesc",
  },
];

const STORAGE_KEY = "pitpilot_tour_seen";

function hasTourBeenSeen(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function markTourSeen(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, "true");
}

interface TooltipPosition {
  top: number;
  left: number;
  arrowSide: "top" | "bottom" | "left" | "right" | "none";
}

function computePosition(
  targetRect: DOMRect | null,
  tooltipWidth: number,
  tooltipHeight: number
): TooltipPosition {
  if (!targetRect) {
    // Center in viewport
    return {
      top: Math.max(80, (window.innerHeight - tooltipHeight) / 2),
      left: Math.max(16, (window.innerWidth - tooltipWidth) / 2),
      arrowSide: "none",
    };
  }

  const gap = 12;
  const padding = 16;

  // Try bottom first
  const bottomTop = targetRect.bottom + gap;
  if (bottomTop + tooltipHeight < window.innerHeight - padding) {
    return {
      top: bottomTop,
      left: Math.max(
        padding,
        Math.min(
          targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
          window.innerWidth - tooltipWidth - padding
        )
      ),
      arrowSide: "top",
    };
  }

  // Try top
  const topTop = targetRect.top - gap - tooltipHeight;
  if (topTop > padding) {
    return {
      top: topTop,
      left: Math.max(
        padding,
        Math.min(
          targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
          window.innerWidth - tooltipWidth - padding
        )
      ),
      arrowSide: "bottom",
    };
  }

  // Fallback: below target with scroll
  return {
    top: bottomTop,
    left: Math.max(
      padding,
      Math.min(
        targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        window.innerWidth - tooltipWidth - padding
      )
    ),
    arrowSide: "top",
  };
}

interface OnboardingTourProps {
  /** Override auto-detection; force show the tour */
  forceShow?: boolean;
}

export function OnboardingTour({ forceShow = false }: OnboardingTourProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [position, setPosition] = useState<TooltipPosition>({
    top: 0,
    left: 0,
    arrowSide: "none",
  });
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Decide whether to show tour on mount
  useEffect(() => {
    if (forceShow || !hasTourBeenSeen()) {
      setVisible(true);
    }
  }, [forceShow]);

  // Position tooltip whenever step changes
  const positionTooltip = useCallback(() => {
    const currentStep = TOUR_STEPS[step];
    if (!currentStep || !visible) return;

    let targetRect: DOMRect | null = null;

    if (currentStep.selector) {
      const el = document.querySelector(currentStep.selector);
      if (el) {
        targetRect = el.getBoundingClientRect();
        // Scroll into view if off screen
        if (
          targetRect.top < 0 ||
          targetRect.bottom > window.innerHeight
        ) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Re-measure after scroll
          requestAnimationFrame(() => {
            const newRect = el.getBoundingClientRect();
            setHighlightRect(newRect);
            const tw = tooltipRef.current?.offsetWidth ?? 340;
            const th = tooltipRef.current?.offsetHeight ?? 200;
            setPosition(computePosition(newRect, tw, th));
          });
          return;
        }
      }
    }

    setHighlightRect(targetRect);
    const tw = tooltipRef.current?.offsetWidth ?? 340;
    const th = tooltipRef.current?.offsetHeight ?? 200;
    setPosition(computePosition(targetRect, tw, th));
  }, [step, visible]);

  useEffect(() => {
    if (!visible) return;
    // Small delay to let DOM settle
    const timeout = setTimeout(positionTooltip, 100);
    window.addEventListener("resize", positionTooltip);
    window.addEventListener("scroll", positionTooltip, true);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", positionTooltip);
      window.removeEventListener("scroll", positionTooltip, true);
    };
  }, [positionTooltip, visible]);

  const handleNext = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      // Finish
      markTourSeen();
      setVisible(false);
    }
  }, [step]);

  const handlePrev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const handleSkip = useCallback(() => {
    markTourSeen();
    setVisible(false);
  }, []);

  // Handle keyboard
  useEffect(() => {
    if (!visible) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleSkip();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [visible, handleSkip, handleNext, handlePrev]);

  if (!visible) return null;

  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;
  const currentStep = TOUR_STEPS[step];
  const totalSteps = TOUR_STEPS.length;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[9998] transition-opacity duration-300"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.65)" }}
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Highlight cutout */}
      {highlightRect && (
        <div
          className="fixed z-[9999] rounded-2xl ring-2 ring-teal-400/60 shadow-[0_0_0_4px_rgba(45,212,191,0.15),0_0_30px_-5px_rgba(45,212,191,0.4)] pointer-events-none transition-all duration-300"
          style={{
            top: highlightRect.top - 8,
            left: highlightRect.left - 8,
            width: highlightRect.width + 16,
            height: highlightRect.height + 16,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-label="Onboarding tour"
        className="fixed z-[10000] w-[340px] max-w-[calc(100vw-32px)] rounded-2xl border border-white/15 bg-gray-950/95 p-5 shadow-2xl backdrop-blur-lg transition-all duration-300"
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        {/* Arrow indicator */}
        {position.arrowSide === "top" && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-l border-t border-white/15 bg-gray-950/95" />
        )}
        {position.arrowSide === "bottom" && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-r border-b border-white/15 bg-gray-950/95" />
        )}

        {/* Step counter */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-teal-400">
            {t("tour.stepOf", { current: step + 1, total: totalSteps })}
          </span>
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs font-medium text-gray-500 transition hover:text-gray-300"
          >
            {t("tour.skip")}
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1 w-full rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Content */}
        <h3 className="mt-4 text-base font-bold text-white">
          {t(currentStep.titleKey)}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-300">
          {t(currentStep.descKey)}
        </p>

        {/* Navigation */}
        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={isFirst}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/5 disabled:invisible"
          >
            {t("tour.prev")}
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-teal-400 hover:to-cyan-400"
          >
            {isLast ? t("tour.finish") : t("tour.next")}
          </button>
        </div>
      </div>
    </>
  );
}
