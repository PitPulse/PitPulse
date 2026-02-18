import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StarRating } from "@/components/star-rating";

describe("StarRating", () => {
  it("renders with label", () => {
    render(<StarRating label="Defense" value={3} onChange={() => {}} />);
    expect(screen.getByText("Defense")).toBeInTheDocument();
  });

  it("renders 5 star buttons", () => {
    render(<StarRating label="Defense" value={3} onChange={() => {}} />);
    const buttons = screen.getAllByRole("radio");
    expect(buttons).toHaveLength(5);
  });

  it("calls onChange with star number on click", () => {
    const onChange = vi.fn();
    render(<StarRating label="Defense" value={1} onChange={onChange} />);
    const buttons = screen.getAllByRole("radio");
    fireEvent.click(buttons[3]); // 4th star (1-indexed = 4)
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("marks correct stars as checked", () => {
    render(<StarRating label="Test" value={3} onChange={() => {}} />);
    const buttons = screen.getAllByRole("radio");
    expect(buttons[0]).toHaveAttribute("aria-checked", "true");
    expect(buttons[2]).toHaveAttribute("aria-checked", "true");
    expect(buttons[3]).toHaveAttribute("aria-checked", "false");
  });

  it("has accessible radiogroup role", () => {
    render(<StarRating label="Rating" value={2} onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: /rating/i })).toBeInTheDocument();
  });

  it("supports keyboard arrow navigation", () => {
    const onChange = vi.fn();
    render(<StarRating label="Test" value={3} onChange={onChange} />);
    const group = screen.getByRole("radiogroup");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("wraps around on ArrowRight at max", () => {
    const onChange = vi.fn();
    render(<StarRating label="Test" value={5} onChange={onChange} />);
    const group = screen.getByRole("radiogroup");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("wraps around on ArrowLeft at min", () => {
    const onChange = vi.fn();
    render(<StarRating label="Test" value={1} onChange={onChange} />);
    const group = screen.getByRole("radiogroup");
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
