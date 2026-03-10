import { beforeEach, describe, expect, it, vi } from "vitest";

import { detectPlatform, resolveTheme } from "./theme";

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
});

