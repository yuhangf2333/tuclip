import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyAppearance, detectPlatform, resolveTheme } from "./theme";

describe("theme", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves system theme using the system preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("detects macOS from navigator.platform", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(detectPlatform()).toBe("mac");
  });

  it("applies a custom accent color to css variables", () => {
    vi.stubGlobal("document", {
      documentElement: {
        dataset: {},
        style: {
          setProperty: vi.fn(),
        },
      },
    });

    applyAppearance("light", "custom", "#123456", "en", "mac");

    expect(document.documentElement.dataset.accent).toBe("custom");
    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith("--accent", "#123456");
    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith("--accent-rgb", "18 52 86");
  });
});
