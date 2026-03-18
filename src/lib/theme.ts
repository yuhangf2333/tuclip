import type { AccentTheme, ThemeMode } from "../types/app";

export type ResolvedTheme = "light" | "dark";
export type RuntimePlatform = "mac" | "windows" | "other";

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "dark") {
    return "dark";
  }
  if (mode === "light") {
    return "light";
  }
  return prefersDark ? "dark" : "light";
}

export function detectPlatform(): RuntimePlatform {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("mac")) {
    return "mac";
  }
  if (platform.includes("win")) {
    return "windows";
  }
  return "other";
}

const ACCENT_MAP: Record<Exclude<AccentTheme, "custom">, string> = {
  blue: "#0f6cbd",
  graphite: "#64748b",
  mint: "#0f9f6e",
  rose: "#d94873",
};

function hexToRgbChannels(hex: string) {
  const normalized = hex.trim().replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `${red} ${green} ${blue}`;
}

export function applyAppearance(
  theme: ResolvedTheme,
  accent: AccentTheme,
  customAccentColor: string,
  language: string,
  platform: RuntimePlatform,
) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.accent = accent;
  root.dataset.language = language;
  root.dataset.platform = platform;

  const resolvedAccent =
    accent === "custom" ? customAccentColor || ACCENT_MAP.blue : ACCENT_MAP[accent];
  root.style.setProperty("--accent", resolvedAccent);
  root.style.setProperty("--accent-rgb", hexToRgbChannels(resolvedAccent));
  root.style.setProperty("--accent-soft", `rgb(${hexToRgbChannels(resolvedAccent)} / 0.12)`);
}
