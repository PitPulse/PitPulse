import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { OnboardingTour } from "@/components/onboarding-tour";
import { I18nProvider } from "@/components/i18n-provider";

function renderTour(props: { forceShow?: boolean } = {}) {
  return render(
    <I18nProvider>
      <OnboardingTour {...props} />
    </I18nProvider>
  );
}

describe("OnboardingTour", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
  });

  it("renders nothing when tour already seen", () => {
    localStorage.setItem("pitpilot_tour_seen", "true");
    const { container } = renderTour();
    expect(container.innerHTML).toBe("");
  });

  it("shows tour dialog when forceShow=true", () => {
    localStorage.setItem("pitpilot_tour_seen", "true");
    renderTour({ forceShow: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows tour on first visit (no localStorage flag)", () => {
    renderTour();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows welcome step initially", () => {
    renderTour();
    expect(screen.getByText("Welcome to PitPilot!")).toBeInTheDocument();
  });

  it("shows step counter", () => {
    renderTour();
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
  });

  it("Next button advances to step 2", () => {
    renderTour();
    act(() => {
      fireEvent.click(screen.getByText("Next"));
    });
    expect(screen.getByText("Sync Your Events")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
  });

  it("Previous button goes back", () => {
    renderTour();
    // Go to step 2
    act(() => {
      fireEvent.click(screen.getByText("Next"));
    });
    expect(screen.getByText("Sync Your Events")).toBeInTheDocument();
    // Go back to step 1
    act(() => {
      fireEvent.click(screen.getByText("Previous"));
    });
    expect(screen.getByText("Welcome to PitPilot!")).toBeInTheDocument();
  });

  it("Previous button is invisible on first step", () => {
    renderTour();
    const prevBtn = screen.getByText("Previous");
    expect(prevBtn).toBeDisabled();
  });

  it("Skip button closes tour and sets localStorage", () => {
    renderTour();
    act(() => {
      fireEvent.click(screen.getByText("Skip tour"));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("pitpilot_tour_seen")).toBe("true");
  });

  it("Escape key closes tour", () => {
    renderTour();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("final step shows 'Get started!' button", () => {
    renderTour();
    // Navigate to the last step (step 5)
    for (let i = 0; i < 4; i++) {
      act(() => {
        fireEvent.click(screen.getByText("Next"));
      });
    }
    expect(screen.getByText("Get started!")).toBeInTheDocument();
    expect(screen.getByText("Step 5 of 5")).toBeInTheDocument();
  });

  it("clicking 'Get started!' on final step closes and marks seen", () => {
    renderTour();
    // Navigate to the last step
    for (let i = 0; i < 4; i++) {
      act(() => {
        fireEvent.click(screen.getByText("Next"));
      });
    }
    act(() => {
      fireEvent.click(screen.getByText("Get started!"));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("pitpilot_tour_seen")).toBe("true");
  });
});
