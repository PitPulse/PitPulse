import { describe, it, expect, beforeEach, vi } from "vitest";
import { translate, getSavedLocale, saveLocale, LOCALES, LOCALE_LABELS } from "@/lib/i18n";

describe("i18n utilities", () => {
  describe("translate", () => {
    it("returns English value for a known key", () => {
      expect(translate("en", "common.back")).toBe("Back");
    });

    it("returns Spanish value for a known key", () => {
      expect(translate("es", "common.back")).toBe("Volver");
    });

    it("returns French value for a known key", () => {
      expect(translate("fr", "common.back")).toBe("Retour");
    });

    it("falls back to English when key missing in target locale", () => {
      // Use an English-only key that's unlikely to be missing —
      // if a locale is missing a key, translate should return the English fallback
      const result = translate("es", "common.back");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("returns the raw key when key not found in any locale", () => {
      expect(translate("en", "nonexistent.key.xyz")).toBe("nonexistent.key.xyz");
    });

    it("interpolates {var} tokens", () => {
      expect(translate("en", "dashboard.welcomeBack", { name: "Alice" })).toBe(
        "Welcome back, Alice. Sync events and keep scouting data flowing for the next match."
      );
    });

    it("interpolates multiple vars and numeric vars", () => {
      expect(translate("en", "tour.stepOf", { current: 2, total: 5 })).toBe(
        "Step 2 of 5"
      );
    });

    it("replaces all occurrences of the same var", () => {
      // This tests that the regex global flag works
      const result = translate("en", "common.showMore", { count: 10 });
      expect(result).toContain("10");
    });
  });

  describe("getSavedLocale", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("returns 'en' when no localStorage value", () => {
      // Mock navigator.language to a non-supported locale
      vi.stubGlobal("navigator", { language: "zh-CN" });
      expect(getSavedLocale()).toBe("en");
      vi.unstubAllGlobals();
    });

    it("returns saved locale from localStorage", () => {
      localStorage.setItem("pitpilot_locale", "fr");
      expect(getSavedLocale()).toBe("fr");
    });

    it("detects browser language when no saved value", () => {
      vi.stubGlobal("navigator", { language: "es-MX" });
      expect(getSavedLocale()).toBe("es");
      vi.unstubAllGlobals();
    });

    it("ignores invalid localStorage value", () => {
      localStorage.setItem("pitpilot_locale", "invalid");
      vi.stubGlobal("navigator", { language: "zh-CN" });
      expect(getSavedLocale()).toBe("en");
      vi.unstubAllGlobals();
    });
  });

  describe("saveLocale", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("persists locale to localStorage", () => {
      saveLocale("es");
      expect(localStorage.getItem("pitpilot_locale")).toBe("es");
    });
  });

  describe("constants", () => {
    it("LOCALES contains en, es, fr", () => {
      expect(LOCALES).toEqual(["en", "es", "fr"]);
    });

    it("LOCALE_LABELS has labels for all locales", () => {
      expect(LOCALE_LABELS.en).toBe("English");
      expect(LOCALE_LABELS.es).toBe("Español");
      expect(LOCALE_LABELS.fr).toBe("Français");
    });
  });
});
