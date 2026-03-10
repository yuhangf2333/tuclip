import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatShortcut, matchesShortcut, normalizeShortcut, shortcutFromKeyboardEvent } from "./shortcuts";

function keyboardEventLike(
  key: string,
  modifiers: Partial<Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey">> = {},
) {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...modifiers,
  } as KeyboardEvent;
}

describe("shortcuts", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
  });

  it("normalizes modifier aliases", () => {
    expect(normalizeShortcut("cmd + shift + s")).toBe("Mod+Shift+S");
    expect(normalizeShortcut("ctrl+alt+Delete")).toBe("Mod+Alt+Delete");
  });

  it("builds a shortcut string from keyboard events", () => {
    const event = keyboardEventLike("z", { metaKey: true, shiftKey: true });
    expect(shortcutFromKeyboardEvent(event)).toBe("Mod+Shift+Z");
  });

  it("matches shortcuts against events", () => {
    const event = keyboardEventLike("Enter", { ctrlKey: true });
    expect(matchesShortcut(event, "Mod+Enter")).toBe(true);
  });

  it("formats shortcuts with Mac labels", () => {
    expect(formatShortcut("Mod+Shift+M")).toBe("Cmd+Shift+M");
  });
});
