"use client";

import { OnboardingTour, type TourStep } from "@/components/onboarding-tour";

const EVENT_TOUR_STEPS: TourStep[] = [
  {
    selector: null,
    titleKey: "tour.eventsWelcome",
    descKey: "tour.eventsWelcomeDesc",
  },
  {
    selector: "[data-tour='event-header']",
    titleKey: "tour.eventsHeader",
    descKey: "tour.eventsHeaderDesc",
  },
  {
    selector: "[data-tour='event-actions']",
    titleKey: "tour.eventsActions",
    descKey: "tour.eventsActionsDesc",
  },
  {
    selector: "[data-tour='event-team-stats']",
    titleKey: "tour.eventsTeams",
    descKey: "tour.eventsTeamsDesc",
  },
];

export function EventTour() {
  return (
    <OnboardingTour
      storageKey="pitpilot_tour_seen_event_overview"
      steps={EVENT_TOUR_STEPS}
    />
  );
}
