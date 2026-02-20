"use client";

import { OnboardingTour, type TourStep } from "@/components/onboarding-tour";

const CAPTAIN_ASSIGNMENTS_TOUR_STEPS: TourStep[] = [
  {
    selector: null,
    titleKey: "tour.assignmentsWelcome",
    descKey: "tour.assignmentsWelcomeDesc",
  },
  {
    selector: "[data-tour='assignments-header']",
    titleKey: "tour.assignmentsHeader",
    descKey: "tour.assignmentsHeaderDesc",
  },
  {
    selector: "[data-tour='assignments-controls']",
    titleKey: "tour.assignmentsControls",
    descKey: "tour.assignmentsControlsDesc",
  },
  {
    selector: "[data-tour='assignments-workspace']",
    titleKey: "tour.assignmentsGrid",
    descKey: "tour.assignmentsGridDesc",
  },
];

const SCOUT_ASSIGNMENTS_TOUR_STEPS: TourStep[] = [
  {
    selector: null,
    titleKey: "tour.assignmentsWelcome",
    descKey: "tour.assignmentsWelcomeDesc",
  },
  {
    selector: "[data-tour='assignments-header']",
    titleKey: "tour.assignmentsHeader",
    descKey: "tour.assignmentsHeaderDesc",
  },
  {
    selector: "[data-tour='assignments-workspace']",
    titleKey: "tour.assignmentsWorkspace",
    descKey: "tour.assignmentsWorkspaceDesc",
  },
  {
    selector: "[data-tour='my-assignments-list']",
    titleKey: "tour.assignmentsMyList",
    descKey: "tour.assignmentsMyListDesc",
  },
];

export function AssignmentsTour({ isCaptain }: { isCaptain: boolean }) {
  return (
    <OnboardingTour
      storageKey="pitpilot_tour_seen_assignments"
      steps={isCaptain ? CAPTAIN_ASSIGNMENTS_TOUR_STEPS : SCOUT_ASSIGNMENTS_TOUR_STEPS}
    />
  );
}
