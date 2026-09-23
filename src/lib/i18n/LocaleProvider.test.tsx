/**
 * Phase 12 audit — real runtime LocaleProvider regression (BLOCKER #4).
 *
 * Executes the ACTUAL production LocaleProvider component with a real DOM
 * (jsdom environment). Verifies:
 *   - setLocale("fa") updates the context locale to "fa" and stays there
 *     (the sync effect does NOT revert it to initialLocale).
 *   - document.documentElement.lang updates to "fa".
 *   - document.documentElement.dir updates to "rtl".
 *   - Translated text updates to the Persian value.
 *   - A genuine authoritative prop change (rerender with initialLocale="en")
 *     synchronizes back to "en".
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, renderHook, screen, act, waitFor, cleanup } from "@testing-library/react";
import React from "react";
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider";

// Helper component that reads the locale context and renders the translated
// title for the current locale.
function Probe() {
  const { locale, dir, t } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <span data-testid="text">{t("auth.signIn.title")}</span>
    </div>
  );
}

// Helper component that exposes setLocale via a button.
function Switcher({ target }: { target: "en" | "fa" }) {
  const { setLocale } = useLocale();
  return (
    <button data-testid={`switch-${target}`} onClick={() => setLocale(target)}>
      Switch to {target}
    </button>
  );
}

beforeEach(() => {
  // Reset document.documentElement before each test.
  document.documentElement.lang = "";
  document.documentElement.dir = "";
});

afterEach(() => {
  // Clean up the DOM between tests so test queries don't find stale elements.
  cleanup();
});

describe("LocaleProvider runtime regression (BLOCKER #4)", () => {
  it("initial locale=en; user selects fa → locale stays fa, lang=fa, dir=rtl, Persian text", async () => {
    render(
      <LocaleProvider locale="en">
        <Probe />
        <Switcher target="fa" />
      </LocaleProvider>,
    );

    // Initially en.
    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(screen.getByTestId("dir").textContent).toBe("ltr");

    // Click the switcher to select fa.
    act(() => {
      screen.getByTestId("switch-fa").click();
    });

    // The context locale must stay "fa" (NOT revert to "en").
    expect(screen.getByTestId("locale").textContent).toBe("fa");
    expect(screen.getByTestId("dir").textContent).toBe("rtl");

    // The html lang/dir must update to fa/rtl.
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("fa");
      expect(document.documentElement.dir).toBe("rtl");
    });

    // The translated text must be the Persian value.
    expect(screen.getByTestId("text").textContent).toBe("خوش آمدید");
  });

  it("setLocale does NOT revert: locale remains fa after the sync effect runs", async () => {
    // This is the core regression: the old effect deps [initialLocale, locale]
    // would revert local state. The fix uses [initialLocale] only.
    const { rerender } = render(
      <LocaleProvider locale="en">
        <Probe />
        <Switcher target="fa" />
      </LocaleProvider>,
    );

    act(() => {
      screen.getByTestId("switch-fa").click();
    });

    expect(screen.getByTestId("locale").textContent).toBe("fa");

    // Wait for any effects to settle (the sync effect should NOT fire because
    // initialLocale hasn't changed).
    await waitFor(() => {
      expect(screen.getByTestId("locale").textContent).toBe("fa");
    });

    // Even after a rerender with the SAME initialLocale, locale stays fa.
    rerender(
      <LocaleProvider locale="en">
        <Probe />
        <Switcher target="fa" />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("locale").textContent).toBe("fa");
  });

  it("genuine authoritative prop change (rerender with initialLocale=en) syncs back to en", async () => {
    // Start with fa, switch to... it's already fa. Then rerender with en.
    const { rerender } = render(
      <LocaleProvider locale="fa">
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("locale").textContent).toBe("fa");

    // Rerender with a DIFFERENT initialLocale — the sync effect MUST fire
    // (because initialLocale prop genuinely changed) and update to en.
    rerender(
      <LocaleProvider locale="en">
        <Probe />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("locale").textContent).toBe("en");
      expect(screen.getByTestId("dir").textContent).toBe("ltr");
    });

    await waitFor(() => {
      expect(document.documentElement.lang).toBe("en");
      expect(document.documentElement.dir).toBe("ltr");
    });
  });

  it("initial locale=fa renders Persian text immediately (no flash of English)", () => {
    render(
      <LocaleProvider locale="fa">
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("locale").textContent).toBe("fa");
    expect(screen.getByTestId("text").textContent).toBe("خوش آمدید");
  });

  it("invalid initialLocale falls back to en", () => {
    render(
      <LocaleProvider locale={"de" as any}>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(screen.getByTestId("dir").textContent).toBe("ltr");
  });
});
