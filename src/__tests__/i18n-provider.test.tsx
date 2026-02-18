import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { I18nProvider, useTranslation } from "@/components/i18n-provider";

/** Helper component that exposes the context value for testing */
function TranslationConsumer() {
  const { locale, setLocale, t } = useTranslation();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="translated">{t("common.back")}</span>
      <span data-testid="unknown">{t("nonexistent.key")}</span>
      <button type="button" onClick={() => setLocale("es")}>
        Switch to Spanish
      </button>
    </div>
  );
}

describe("I18nProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
  });

  it("renders children", () => {
    render(
      <I18nProvider>
        <p>Hello</p>
      </I18nProvider>
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("provides default English locale", () => {
    render(
      <I18nProvider>
        <TranslationConsumer />
      </I18nProvider>
    );
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
  });

  it("t() translates known keys", () => {
    render(
      <I18nProvider>
        <TranslationConsumer />
      </I18nProvider>
    );
    expect(screen.getByTestId("translated")).toHaveTextContent("Back");
  });

  it("t() returns key string for unknown keys", () => {
    render(
      <I18nProvider>
        <TranslationConsumer />
      </I18nProvider>
    );
    expect(screen.getByTestId("unknown")).toHaveTextContent("nonexistent.key");
  });

  it("setLocale updates locale and persists to localStorage", () => {
    render(
      <I18nProvider>
        <TranslationConsumer />
      </I18nProvider>
    );
    act(() => {
      fireEvent.click(screen.getByText("Switch to Spanish"));
    });
    expect(screen.getByTestId("locale")).toHaveTextContent("es");
    expect(localStorage.getItem("pitpilot_locale")).toBe("es");
  });

  it("setLocale updates document.documentElement.lang", () => {
    render(
      <I18nProvider>
        <TranslationConsumer />
      </I18nProvider>
    );
    act(() => {
      fireEvent.click(screen.getByText("Switch to Spanish"));
    });
    expect(document.documentElement.lang).toBe("es");
  });
});
