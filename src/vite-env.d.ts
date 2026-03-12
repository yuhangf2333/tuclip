/// <reference types="vite/client" />

import type { TuClipBridge } from "./lib/api";

declare global {
  interface Window {
    tuclip?: TuClipBridge;
  }
}
