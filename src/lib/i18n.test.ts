import { describe, expect, it } from "vitest";

import { getStrings, statusLabel } from "./i18n";

describe("i18n", () => {
  it("returns Chinese labels when zh is selected", () => {
    const strings = getStrings("zh");
    expect(strings.commands.settings).toBe("设置");
    expect(strings.workspace.inbox).toBe("收集箱");
    expect(strings.settings.tags).toBe("标签");
  });

  it("falls back to English saved status for unknown capture status", () => {
    const strings = getStrings("en");
    expect(statusLabel("saved", strings)).toBe("Saved");
    expect(statusLabel("whatever", strings)).toBe("Saved");
  });
});
