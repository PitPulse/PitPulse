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

  // ── Inline editing tests ────────────────────────────────────────────

  it("shows input when value is clicked", () => {
    render(<CounterButton label="Points" value={5} onChange={() => {}} />);
    // Click the value display (which is a button with role="status")
    fireEvent.click(screen.getByRole("status"));
    // Input should now be visible
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toHaveValue(5);
  });

  it("commits typed value on Enter", () => {
    const onChange = vi.fn();
    render(<CounterButton label="Points" value={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("status"));
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it("commits typed value on blur", () => {
    const onChange = vi.fn();
    render(<CounterButton label="Points" value={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("status"));
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it("clamps typed value to max", () => {
    const onChange = vi.fn();
    render(<CounterButton label="Points" value={5} onChange={onChange} max={50} />);
    fireEvent.click(screen.getByRole("status"));
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it("cancels editing on Escape without changing value", () => {
    const onChange = vi.fn();
    render(<CounterButton label="Points" value={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("status"));
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.keyDown(input, { key: "Escape" });
    // Should NOT have called onChange
    expect(onChange).not.toHaveBeenCalled();
    // Should be back to display mode
    expect(screen.getByRole("status")).toHaveTextContent("5");
  });
});
