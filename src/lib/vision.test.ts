import { describe, expect, it } from "vitest";

import { detectionPresetConfig } from "./vision";

describe("vision", () => {
  it("uses denser thresholds for dense detection", () => {
    const balanced = detectionPresetConfig("balanced");
    const dense = detectionPresetConfig("dense");
    const focused = detectionPresetConfig("focused");

    expect(dense.maxCount).toBeGreaterThan(balanced.maxCount);
    expect(dense.minWidth).toBeLessThan(balanced.minWidth);
    expect(focused.maxCount).toBeLessThan(balanced.maxCount);
    expect(focused.minWidth).toBeGreaterThan(balanced.minWidth);
  });
});
