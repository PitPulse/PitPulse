import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CounterButton } from "@/components/counter-button";

describe("CounterButton", () => {
  it("renders with label and value", () => {
    render(<CounterButton label="Points" value={5} onChange={() => {}} />);
    expect(screen.getByText("Points")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("calls onChange with incremented value on plus click", () => {
    const onChange = vi.fn();
    render(<CounterButton label="Points" value={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /increase points/i }));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("calls onChange with decremented value on minus click", () => {
    const onChange = vi.fn();
    render(<CounterButton label="Points" value={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /decrease points/i }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("disables minus button at min value", () => {
    render(<CounterButton label="Score" value={0} onChange={() => {}} min={0} />);
    expect(screen.getByRole("button", { name: /decrease score/i })).toBeDisabled();
  });

  it("disables plus button at max value", () => {
    render(<CounterButton label="Score" value={99} onChange={() => {}} max={99} />);
    expect(screen.getByRole("button", { name: /increase score/i })).toBeDisabled();
  });

  it("respects custom min and max", () => {
    const onChange = vi.fn();
    render(
      <CounterButton label="Test" value={1} onChange={onChange} min={1} max={3} />
    );
    // At min: decrease button should be disabled
    expect(screen.getByRole("button", { name: /decrease test/i })).toBeDisabled();
    // Increase should still work
    fireEvent.click(screen.getByRole("button", { name: /increase test/i }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("has accessible value announcement", () => {
    render(<CounterButton label="Points" value={7} onChange={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("7");
  });
});
