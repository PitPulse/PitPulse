import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { CopyInviteLink } from "@/components/copy-invite-link";

describe("CopyInviteLink", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders 'Copy invite' button", () => {
    render(<CopyInviteLink joinCode="ABC123" />);
    expect(screen.getByRole("button")).toHaveTextContent("Copy invite");
  });

  it("calls clipboard.writeText on click with correct URL", async () => {
    render(<CopyInviteLink joinCode="ABC123" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/join?code=ABC123")
    );
  });

  it("shows 'Copied!' text after click", async () => {
    render(<CopyInviteLink joinCode="ABC123" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(screen.getByRole("button")).toHaveTextContent("Copied!");
  });

  it("reverts to 'Copy invite' after timeout", async () => {
    vi.useFakeTimers();
    render(<CopyInviteLink joinCode="ABC123" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(screen.getByRole("button")).toHaveTextContent("Copied!");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("button")).toHaveTextContent("Copy invite");
    vi.useRealTimers();
  });
});
