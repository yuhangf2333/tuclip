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

export function applyAppearance(
  theme: ResolvedTheme,
  accent: AccentTheme,
  language: string,
  platform: RuntimePlatform,
) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.accent = accent;
  root.dataset.language = language;
  root.dataset.platform = platform;
}

