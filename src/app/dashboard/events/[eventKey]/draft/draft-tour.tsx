"use client";

import { OnboardingTour, type TourStep } from "@/components/onboarding-tour";

const DRAFT_TOUR_STEPS: TourStep[] = [
  {
    selector: null,
    titleKey: "tour.draftWelcome",
    descKey: "tour.draftWelcomeDesc",
  },
  {
    selector: "[data-tour='draft-header']",
    titleKey: "tour.draftHeader",
    descKey: "tour.draftHeaderDesc",
  },
  {
    selector: "[data-tour='draft-status']",
    titleKey: "tour.draftStatus",
    descKey: "tour.draftStatusDesc",
  },
  {
    selector: "[data-tour='draft-best-available']",
    titleKey: "tour.draftBestAvailable",
    descKey: "tour.draftBestAvailableDesc",
  },
  {
    selector: "[data-tour='draft-board']",
    titleKey: "tour.draftBoard",
    descKey: "tour.draftBoardDesc",
  },
  {
    selector: "[data-tour='draft-pool']",
    titleKey: "tour.draftPool",
    descKey: "tour.draftPoolDesc",
  },
];

export function DraftTour() {
  return (
    <OnboardingTour
      storageKey="pitpilot_tour_seen_draft_room"
      steps={DRAFT_TOUR_STEPS}
    />
  );
}
