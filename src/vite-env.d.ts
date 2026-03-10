/// <reference types="vite/client" />

import type { GleanDexBridge } from "./lib/api";

declare global {
  interface Window {
    gleandex?: GleanDexBridge;
  }
}
