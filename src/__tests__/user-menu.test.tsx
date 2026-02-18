import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { UserMenu } from "@/components/user-menu";
import { I18nProvider } from "@/components/i18n-provider";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock signOut server action
vi.mock("@/lib/auth-actions", () => ({
  signOut: vi.fn(),
}));

function renderMenu(props?: Partial<{ name: string; email: string; isStaff: boolean }>) {
  return render(
    <I18nProvider>
      <UserMenu
        name={props?.name ?? "Jamie Chen"}
        email={props?.email ?? "jamie@team.org"}
        isStaff={props?.isStaff ?? false}
      />
    </I18nProvider>
  );
}

describe("UserMenu", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
  });

  it("renders user initials", () => {
    renderMenu({ name: "Jamie Chen" });
    expect(screen.getByText("JC")).toBeInTheDocument();
  });

  it("renders single initial from email when no name", () => {
    renderMenu({ name: "", email: "jamie@team.org" });
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("opens menu on click", () => {
    renderMenu();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /open account menu/i }));
    });
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("shows menu items when open", () => {
    renderMenu();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /open account menu/i }));
    });
    expect(screen.getByText("Account Settings")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("shows admin link when isStaff=true", () => {
    renderMenu({ isStaff: true });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /open account menu/i }));
    });
    expect(screen.getByText("Website Admin")).toBeInTheDocument();
  });

  it("hides admin link when isStaff=false", () => {
    renderMenu({ isStaff: false });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /open account menu/i }));
    });
    expect(screen.queryByText("Website Admin")).not.toBeInTheDocument();
  });

  it("shows language selector with 3 locale buttons", () => {
    renderMenu();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /open account menu/i }));
    });
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Español")).toBeInTheDocument();
    expect(screen.getByText("Français")).toBeInTheDocument();
  });

  it("closes menu on Escape key", () => {
    renderMenu();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /open account menu/i }));
    });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("displays user name and email in menu header", () => {
    renderMenu({ name: "Jamie Chen", email: "jamie@team.org" });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /open account menu/i }));
    });
    expect(screen.getByText("Jamie Chen")).toBeInTheDocument();
    expect(screen.getByText("jamie@team.org")).toBeInTheDocument();
  });
});
