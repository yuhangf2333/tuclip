const MODIFIER_KEYS = new Set(["Meta", "Control", "Shift", "Alt"]);

function normalizeKey(key: string): string {
  if (key.length === 1) {
    return key.toUpperCase();
  }

  switch (key) {
    case " ":
    case "Spacebar":
      return "Space";
    case "Escape":
    case "Esc":
      return "Escape";
    case "ArrowUp":
      return "ArrowUp";
    case "ArrowDown":
      return "ArrowDown";
    case "ArrowLeft":
      return "ArrowLeft";
    case "ArrowRight":
      return "ArrowRight";
    case "Backspace":
      return "Backspace";
    case "Delete":
    case "Del":
      return "Delete";
    case "Enter":
      return "Enter";
    default:
      return key;
  }
}

export function normalizeShortcut(shortcut: string): string {
  const raw = shortcut.trim();
  if (!raw) {
    return "";
  }

  const parts = raw
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  const modifiers: string[] = [];
  let primary = "";

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "mod" || lower === "cmd" || lower === "ctrl" || lower === "control") {
      if (!modifiers.includes("Mod")) {
        modifiers.push("Mod");
      }
      continue;
    }
    if (lower === "shift") {
      if (!modifiers.includes("Shift")) {
        modifiers.push("Shift");
      }
      continue;
    }
    if (lower === "alt" || lower === "option") {
      if (!modifiers.includes("Alt")) {
        modifiers.push("Alt");
      }
      continue;
    }
    primary = normalizeKey(part);
  }

  return [...modifiers, primary].filter(Boolean).join("+");
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent): string {
  const modifiers: string[] = [];
  if (event.metaKey || event.ctrlKey) {
    modifiers.push("Mod");
  }
  if (event.shiftKey) {
    modifiers.push("Shift");
  }
  if (event.altKey) {
    modifiers.push("Alt");
  }

  if (MODIFIER_KEYS.has(event.key)) {
    return modifiers.join("+");
  }

  return [...modifiers, normalizeKey(event.key)].filter(Boolean).join("+");
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  return shortcutFromKeyboardEvent(event) === normalizeShortcut(shortcut);
}

export function formatShortcut(shortcut: string): string {
  return normalizeShortcut(shortcut).replace(
    /Mod/g,
    navigator.platform.includes("Mac") ? "Cmd" : "Ctrl",
  );
}
