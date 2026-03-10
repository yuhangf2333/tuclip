import { createWorker, type Worker } from "tesseract.js";

import type { CropArea, DetectionPreset } from "../types/app";

export interface DetectionRules {
  preset: DetectionPreset;
  autoDetectLabels: boolean;
  autoNumberDetections: boolean;
}

export interface DetectedRegion {
  rect: CropArea;
  label: string;
}

interface DetectionOptions {
  signal?: AbortSignal;
}

interface DetectionPresetConfig {
  minWidth: number;
  minHeight: number;
  maxWidthRatio: number;
  maxHeightRatio: number;
  maxCount: number;
  cannyLow: number;
  cannyHigh: number;
  dilatePasses: number;
}

let workerPromise: Promise<Worker> | null = null;

function ensurePositiveRect(rect: CropArea): CropArea {
  const x = Math.min(rect.x, rect.x + rect.width);
  const y = Math.min(rect.y, rect.y + rect.height);
  const width = Math.abs(rect.width);
  const height = Math.abs(rect.height);
  return { x, y, width, height };
}

function clampRect(rect: CropArea, image: HTMLImageElement): CropArea {
  const safe = ensurePositiveRect(rect);
  const x = Math.max(0, Math.min(safe.x, image.naturalWidth - 1));
  const y = Math.max(0, Math.min(safe.y, image.naturalHeight - 1));
  const width = Math.max(1, Math.min(safe.width, image.naturalWidth - x));
  const height = Math.max(1, Math.min(safe.height, image.naturalHeight - y));
  return { x, y, width, height };
}

export function detectionPresetConfig(preset: DetectionPreset): DetectionPresetConfig {
  switch (preset) {
    case "dense":
      return {
        minWidth: 18,
        minHeight: 14,
        maxWidthRatio: 0.76,
        maxHeightRatio: 0.42,
        maxCount: 18,
        cannyLow: 28,
        cannyHigh: 128,
        dilatePasses: 2,
      };
    case "focused":
      return {
        minWidth: 28,
        minHeight: 20,
        maxWidthRatio: 0.62,
        maxHeightRatio: 0.32,
        maxCount: 8,
        cannyLow: 50,
        cannyHigh: 170,
        dilatePasses: 1,
      };
    case "balanced":
    default:
      return {
        minWidth: 22,
        minHeight: 16,
        maxWidthRatio: 0.68,
        maxHeightRatio: 0.36,
        maxCount: 12,
        cannyLow: 36,
        cannyHigh: 148,
        dilatePasses: 1,
      };
  }
}

function expandRect(rect: CropArea, image: HTMLImageElement, padding: number): CropArea {
  return clampRect(
    {
      x: rect.x - padding,
      y: rect.y - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    },
    image,
  );
}

function intersectionArea(left: CropArea, right: CropArea) {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - x);
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - y);
  return width * height;
}

function overlapRatio(left: CropArea, right: CropArea) {
  const intersection = intersectionArea(left, right);
  const smallest = Math.max(1, Math.min(left.width * left.height, right.width * right.height));
  return intersection / smallest;
}

function distanceScore(left: CropArea, right: CropArea) {
  const dx = Math.abs(left.x - right.x);
  const dy = Math.abs(left.y - right.y);
  const dw = Math.abs(left.width - right.width);
  const dh = Math.abs(left.height - right.height);
  return dx + dy + dw * 0.5 + dh * 0.5;
}

function luminance(data: Uint8ClampedArray, index: number) {
  return data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
}

function nextTick() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Detection cancelled", "AbortError");
  }
}

export function cropImageToCanvas(image: HTMLImageElement, rect: CropArea): HTMLCanvasElement {
  const safe = clampRect(rect, image);
  const canvas = document.createElement("canvas");
  canvas.width = safe.width;
  canvas.height = safe.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }
  ctx.drawImage(
    image,
    safe.x,
    safe.y,
    safe.width,
    safe.height,
    0,
    0,
    safe.width,
    safe.height,
  );
  return canvas;
}

async function getWorker() {
  if (!workerPromise) {
    const workerPath = new URL("./tesseract/worker.min.js", window.location.href).toString();
    const corePath = new URL("./tesseract-core", window.location.href).toString();
    const langPath = new URL("./tessdata", window.location.href).toString();
    workerPromise = createWorker(["eng", "chi_sim"], 1, {
      gzip: true,
      logger: () => undefined,
      workerPath,
      corePath,
      langPath,
    });
  }
  return workerPromise;
}

export async function suggestTextFromRegion(
  image: HTMLImageElement,
  rect: CropArea,
): Promise<string> {
  const canvas = cropImageToCanvas(image, rect);
  const worker = await getWorker();
  const result = await worker.recognize(canvas);
  return result.data.text.replace(/\s+/g, " ").trim();
}

export async function snapRectToEdges(
  image: HTMLImageElement,
  rect: CropArea,
): Promise<CropArea> {
  const safe = clampRect(rect, image);
  const padding = 26;
  const roi = {
    x: Math.max(0, safe.x - padding),
    y: Math.max(0, safe.y - padding),
    width: Math.min(image.naturalWidth - Math.max(0, safe.x - padding), safe.width + padding * 2),
    height: Math.min(image.naturalHeight - Math.max(0, safe.y - padding), safe.height + padding * 2),
  };

  try {
    const cvModule = await import("@techstark/opencv-js");
    const cv = cvModule as unknown as typeof import("@techstark/opencv-js");
    const canvas = cropImageToCanvas(image, roi);
    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    const blur = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.Canny(blur, edges, 40, 160);
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let best = safe;
    let bestScore = Number.POSITIVE_INFINITY;
    const originalCenter = {
      x: safe.x + safe.width / 2,
      y: safe.y + safe.height / 2,
    };

    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index);
      const bound = cv.boundingRect(contour);
      contour.delete();

      if (bound.width < 10 || bound.height < 10) {
        continue;
      }

      const candidate = {
        x: roi.x + bound.x,
        y: roi.y + bound.y,
        width: bound.width,
        height: bound.height,
      };
      const candidateCenter = {
        x: candidate.x + candidate.width / 2,
        y: candidate.y + candidate.height / 2,
      };
      const centerDistance =
        Math.abs(candidateCenter.x - originalCenter.x) +
        Math.abs(candidateCenter.y - originalCenter.y);
      const sizeDistance =
        Math.abs(candidate.width - safe.width) + Math.abs(candidate.height - safe.height);
      const score = centerDistance * 1.3 + sizeDistance * 0.7;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    src.delete();
    gray.delete();
    blur.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();

    return clampRect(best, image);
  } catch {
    return safe;
  }
}

export async function detectUiRegions(
  image: HTMLImageElement,
  rules: DetectionRules,
  options: DetectionOptions = {},
): Promise<DetectedRegion[]> {
  const preset = detectionPresetConfig(rules.preset);
  const signal = options.signal;

  try {
    throwIfAborted(signal);
    const maxProcessingWidth = 1280;
    const scale = Math.min(1, maxProcessingWidth / image.naturalWidth);
    const scanWidth = Math.max(1, Math.round(image.naturalWidth * scale));
    const scanHeight = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = scanWidth;
    canvas.height = scanHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return [];
    }
    ctx.drawImage(image, 0, 0, scanWidth, scanHeight);
    const pixelData = ctx.getImageData(0, 0, scanWidth, scanHeight).data;

    const cellSize =
      rules.preset === "dense" ? 10 : rules.preset === "focused" ? 16 : 12;
    const sampleStep =
      rules.preset === "dense" ? 2 : rules.preset === "focused" ? 4 : 3;
    const contrastThreshold =
      rules.preset === "dense" ? 26 : rules.preset === "focused" ? 34 : 30;
    const columns = Math.ceil(scanWidth / cellSize);
    const rows = Math.ceil(scanHeight / cellSize);
    const merged: Array<{
      left: number;
      top: number;
      right: number;
      bottom: number;
      lastRow: number;
    }> = [];

    for (let row = 0; row < rows; row += 1) {
      throwIfAborted(signal);
      const activeRuns: Array<{ left: number; right: number }> = [];
      let runStart = -1;

      for (let column = 0; column < columns; column += 1) {
        const startX = column * cellSize;
        const startY = row * cellSize;
        const endX = Math.min(scanWidth - 1, startX + cellSize - 1);
        const endY = Math.min(scanHeight - 1, startY + cellSize - 1);

        let contrast = 0;
        let samples = 0;

        for (let y = startY; y < endY; y += sampleStep) {
          for (let x = startX; x < endX; x += sampleStep) {
            const index = (y * scanWidth + x) * 4;
            const rightIndex = (y * scanWidth + Math.min(x + 1, scanWidth - 1)) * 4;
            const belowIndex = (Math.min(y + 1, scanHeight - 1) * scanWidth + x) * 4;
            contrast +=
              Math.abs(luminance(pixelData, index) - luminance(pixelData, rightIndex)) +
              Math.abs(luminance(pixelData, index) - luminance(pixelData, belowIndex));
            samples += 2;
          }
        }

        const avgContrast = samples > 0 ? contrast / samples : 0;
        const isActive = avgContrast >= contrastThreshold;

        if (isActive && runStart < 0) {
          runStart = column;
        }
        if (!isActive && runStart >= 0) {
          activeRuns.push({ left: runStart, right: column - 1 });
          runStart = -1;
        }
      }

      if (runStart >= 0) {
        activeRuns.push({ left: runStart, right: columns - 1 });
      }

      for (const run of activeRuns) {
        const runLeft = run.left * cellSize;
        const runRight = Math.min(scanWidth, (run.right + 1) * cellSize);
        const runTop = row * cellSize;
        const runBottom = Math.min(scanHeight, (row + 1) * cellSize);

        let target = null;
        for (let index = merged.length - 1; index >= 0; index -= 1) {
          const candidate = merged[index];
          const overlap =
            Math.max(
              0,
              Math.min(candidate.right, runRight) - Math.max(candidate.left, runLeft),
            ) / Math.max(1, Math.min(candidate.right - candidate.left, runRight - runLeft));
          if (overlap > 0.45 && row - candidate.lastRow <= 1) {
            target = candidate;
            break;
          }
        }

        if (target) {
          target.left = Math.min(target.left, runLeft);
          target.right = Math.max(target.right, runRight);
          target.bottom = runBottom;
          target.lastRow = row;
        } else {
          merged.push({
            left: runLeft,
            top: runTop,
            right: runRight,
            bottom: runBottom,
            lastRow: row,
          });
        }
      }

      if (row % 3 === 0) {
        await nextTick();
      }
    }

    const rawCandidates: CropArea[] = merged
      .map((candidate) =>
        expandRect(
          {
            x: Math.round(candidate.left / scale),
            y: Math.round(candidate.top / scale),
            width: Math.round((candidate.right - candidate.left) / scale),
            height: Math.round((candidate.bottom - candidate.top) / scale),
          },
          image,
          6,
        ),
      )
      .filter((candidate) => {
        if (candidate.width < preset.minWidth || candidate.height < preset.minHeight) {
          return false;
        }
        if (candidate.width > image.naturalWidth * preset.maxWidthRatio) {
          return false;
        }
        if (candidate.height > image.naturalHeight * preset.maxHeightRatio) {
          return false;
        }
        return true;
      });

    rawCandidates.sort((left, right) => {
      const topGap = Math.abs(left.y - right.y);
      if (topGap > 14) {
        return left.y - right.y;
      }
      return left.x - right.x;
    });

    const filtered: CropArea[] = [];
    for (const candidate of rawCandidates) {
      const duplicate = filtered.some(
        (current) =>
          overlapRatio(current, candidate) > 0.72 ||
          distanceScore(current, candidate) < 18,
      );
      if (!duplicate) {
        filtered.push(candidate);
      }
      if (filtered.length >= preset.maxCount) {
        break;
      }
    }

    const results: DetectedRegion[] = [];
    const labelLimit = rules.autoDetectLabels
      ? Math.min(filtered.length, Math.max(4, Math.floor(preset.maxCount / 2)))
      : 0;

    for (let index = 0; index < filtered.length; index += 1) {
      throwIfAborted(signal);
      const candidate = filtered[index];
      let label = "";
      if (rules.autoDetectLabels && index < labelLimit) {
        label = (await suggestTextFromRegion(image, candidate)).slice(0, 36);
      }
      results.push({ rect: candidate, label });
      if (index % 2 === 1) {
        await nextTick();
      }
    }

    return results;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return [];
    }
    return [];
  }
}
