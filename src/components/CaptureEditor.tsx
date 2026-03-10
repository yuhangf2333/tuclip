import type Konva from "konva";
import {
  Eraser,
  Eye,
  Minus,
  PencilRuler,
  Plus,
  Redo2,
  Save,
  Square,
  StickyNote,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Circle, Group, Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";
import useImage from "use-image";

import { api } from "../lib/api";
import { formatShortcut, matchesShortcut } from "../lib/shortcuts";
import type {
  AnnotationDocument,
  AnnotationItem,
  BadgeAnnotation,
  CaptureItem,
  CropArea,
  EditorDocument,
  PreferencesConfig,
  QuickTag,
  RectAnnotation,
  ShortcutConfig,
  TextAnnotation,
  Workspace,
} from "../types/app";

type Tool = "select" | "rect" | "number" | "text" | "crop";

interface CaptureEditorProps {
  document: EditorDocument;
  preferences: PreferencesConfig;
  shortcuts: ShortcutConfig;
  tags: QuickTag[];
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onClose: () => void;
  onSave: (
    renderedPngBase64: string,
    annotationDocument: AnnotationDocument,
    options?: { targetWorkspaceId?: string | null; tagId?: string | null },
  ) => Promise<CaptureItem>;
}

interface EditorCopy {
  eyebrow: string;
  selection: string;
  noSelection: string;
  item: string;
  items: string;
  cropHistory: string;
  stableOutput: string;
  label: string;
  number: string;
  stroke: string;
  value: string;
  text: string;
  background: string;
  textColor: string;
  fontSize: string;
  tag: string;
  destination: string;
  keepCurrent: string;
  width: string;
  height: string;
  x: string;
  y: string;
  clearCrop: string;
  close: string;
  save: string;
  saving: string;
  fit: string;
  actual: string;
  selectionHint: string;
  cropHint: string;
  note: string;
  zoom: string;
  toolLabels: Record<Tool, string>;
}

const defaultStroke = "#8fb7ff";
const defaultFill = "rgba(30, 44, 96, 0.92)";
const minStageScale = 0.18;
const maxStageScale = 6;

function cloneDocument(document: AnnotationDocument): AnnotationDocument {
  return JSON.parse(JSON.stringify(document)) as AnnotationDocument;
}

function normalizeDocument(document: EditorDocument): AnnotationDocument {
  return {
    items: document.annotationDocument?.items ?? [],
    crop: document.annotationDocument?.crop ?? null,
    savedAt: document.annotationDocument?.savedAt,
  };
}

function createId() {
  return crypto.randomUUID();
}

function normalizeRect(rect: CropArea): CropArea {
  const x = rect.width < 0 ? rect.x + rect.width : rect.x;
  const y = rect.height < 0 ? rect.y + rect.height : rect.y;
  return {
    x,
    y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  };
}

function clampNumber(value: number, fallback: number, minimum = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, Math.round(value));
}

function clampScale(value: number) {
  return Math.max(minStageScale, Math.min(value, maxStageScale));
}

function isCanvasBackgroundTarget(target: Konva.Node | null | undefined, stage: Konva.Stage | null) {
  if (!target || !stage) {
    return false;
  }

  const className = target.getClassName?.() ?? "";
  return (
    target === stage ||
    className === "Stage" ||
    className === "Layer" ||
    target.getParent?.() === stage
  );
}

function textMetrics(item: TextAnnotation) {
  const fontSize = Math.max(12, Math.round(item.fontSize ?? 16));
  const padding = Math.max(8, Math.round(item.padding ?? 12));
  const lineHeight = Math.round(fontSize * 1.25);
  const lines = Math.max(1, item.text.split(/\r?\n/).length);
  return {
    fontSize,
    padding,
    lineHeight,
    height: lines * lineHeight + padding * 2,
    textColor: item.textColor || "#f8fbff",
  };
}

function editorCopy(language: PreferencesConfig["language"]): EditorCopy {
  if (language === "zh") {
    return {
      eyebrow: "编辑器",
      selection: "选中项",
      noSelection: "未选中",
      item: "个对象",
      items: "个对象",
      cropHistory: "裁剪与历史",
      stableOutput: "稳定导出",
      label: "标签",
      number: "编号",
      stroke: "描边",
      value: "数值",
      text: "文本",
      background: "背景",
      textColor: "文字颜色",
      fontSize: "字号",
      tag: "标签",
      destination: "目标位置",
      keepCurrent: "不设标签 / 保持当前",
      width: "宽",
      height: "高",
      x: "X",
      y: "Y",
      clearCrop: "清除裁剪",
      close: "关闭",
      save: "保存",
      saving: "保存中…",
      fit: "适应",
      actual: "100%",
      selectionHint: "Shift 可多选，方向键微调，坐标和尺寸可以直接精修。",
      cropHint: "裁剪只影响公开展示图，原图和历史编辑版本仍然保留在归档里。",
      note: "备注",
      zoom: "缩放",
      toolLabels: {
        select: "选择",
        rect: "框",
        number: "编号",
        text: "文字",
        crop: "裁剪",
      },
    };
  }

  return {
    eyebrow: "Editor",
    selection: "Selection",
    noSelection: "No selection",
    item: "item",
    items: "items",
    cropHistory: "Crop + History",
    stableOutput: "Stable output",
    label: "Label",
    number: "Number",
    stroke: "Stroke",
    value: "Value",
    text: "Text",
    background: "Background",
    textColor: "Text color",
    fontSize: "Size",
    tag: "Tag",
    destination: "Destination",
    keepCurrent: "No tag / keep current",
    width: "Width",
    height: "Height",
    x: "X",
    y: "Y",
    clearCrop: "Clear crop",
    close: "Close",
    save: "Save",
    saving: "Saving…",
    fit: "Fit",
    actual: "100%",
    selectionHint: "Use Shift for multi-select, nudge with arrows, and fine-tune geometry directly.",
    cropHint: "Crop only changes the public render. Originals and edited versions stay archived.",
    note: "Note",
    zoom: "Zoom",
    toolLabels: {
      select: "Select",
      rect: "Rect",
      number: "Number",
      text: "Text",
      crop: "Crop",
    },
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safe = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safe, y);
  ctx.arcTo(x + width, y, x + width, y + height, safe);
  ctx.arcTo(x + width, y + height, x, y + height, safe);
  ctx.arcTo(x, y + height, x, y, safe);
  ctx.arcTo(x, y, x + width, y, safe);
  ctx.closePath();
}

function renderToDataUrl(image: HTMLImageElement, annotationDoc: AnnotationDocument): string {
  const crop = annotationDoc.crop ?? {
    x: 0,
    y: 0,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
  const safeCrop = normalizeRect(crop);
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.max(1, safeCrop.width);
  canvas.height = Math.max(1, safeCrop.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }

  ctx.drawImage(
    image,
    safeCrop.x,
    safeCrop.y,
    safeCrop.width,
    safeCrop.height,
    0,
    0,
    safeCrop.width,
    safeCrop.height,
  );

  const translateX = -safeCrop.x;
  const translateY = -safeCrop.y;

  annotationDoc.items.forEach((item) => {
    if (item.kind === "rect") {
      ctx.save();
      ctx.strokeStyle = item.stroke;
      ctx.lineWidth = 4;
      ctx.strokeRect(item.x + translateX, item.y + translateY, item.width, item.height);

      if (item.label) {
        ctx.font = "600 24px Manrope";
        const textWidth = Math.max(90, ctx.measureText(item.label).width + 26);
        roundRect(ctx, item.x + translateX, item.y + translateY - 42, textWidth, 32, 14);
        ctx.fillStyle = "rgba(10, 16, 28, 0.9)";
        ctx.fill();
        ctx.fillStyle = "#f5f7ff";
        ctx.fillText(item.label, item.x + translateX + 13, item.y + translateY - 18);
      }

      if (item.number) {
        ctx.beginPath();
        ctx.arc(item.x + translateX + 14, item.y + translateY + 14, 18, 0, Math.PI * 2);
        ctx.fillStyle = item.stroke;
        ctx.fill();
        ctx.fillStyle = "#04111f";
        ctx.font = "700 20px Manrope";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(item.number), item.x + translateX + 14, item.y + translateY + 14);
      }
      ctx.restore();
    }

    if (item.kind === "badge") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(item.x + translateX, item.y + translateY, 18, 0, Math.PI * 2);
      ctx.fillStyle = item.fill;
      ctx.fill();
      ctx.fillStyle = "#04111f";
      ctx.font = "700 20px Manrope";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(item.value), item.x + translateX, item.y + translateY + 1);
      ctx.restore();
    }

    if (item.kind === "text") {
      const metrics = textMetrics(item);
      const lines = item.text.split(/\r?\n/);
      ctx.save();
      roundRect(ctx, item.x + translateX, item.y + translateY, item.width, metrics.height, 16);
      ctx.fillStyle = item.fill;
      ctx.fill();
      ctx.fillStyle = metrics.textColor;
      ctx.font = `600 ${metrics.fontSize}px Manrope`;
      ctx.textBaseline = "top";
      lines.forEach((line, index) => {
        ctx.fillText(
          line,
          item.x + translateX + metrics.padding,
          item.y + translateY + metrics.padding + index * metrics.lineHeight,
        );
      });
      ctx.restore();
    }
  });

  return canvas.toDataURL("image/png");
}

function maxBadgeValue(items: AnnotationItem[]) {
  return items.reduce((value, item) => {
    if (item.kind === "badge") {
      return Math.max(value, item.value);
    }
    if (item.kind === "rect" && item.number) {
      return Math.max(value, item.number);
    }
    return value;
  }, 0);
}

function selectionTitle(selectedIds: string[], copy: EditorCopy) {
  if (selectedIds.length === 0) {
    return copy.noSelection;
  }
  return `${selectedIds.length} ${selectedIds.length === 1 ? copy.item : copy.items}`;
}

export function CaptureEditor({
  document,
  preferences,
  shortcuts,
  tags,
  workspaces,
  activeWorkspaceId,
  onClose,
  onSave,
}: CaptureEditorProps) {
  const [image] = useImage(api.fileUrl(document.capture.publicPath), "anonymous");
  const [annotationDocument, setAnnotationDocument] = useState<AnnotationDocument>(
    normalizeDocument(document),
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [draftRect, setDraftRect] = useState<CropArea | null>(null);
  const [saving, setSaving] = useState(false);
  const [captureNote, setCaptureNote] = useState(document.capture.note ?? "");
  const [persistedCaptureNote, setPersistedCaptureNote] = useState(document.capture.note ?? "");
  const [noteSaving, setNoteSaving] = useState(false);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [stageViewport, setStageViewport] = useState({ width: 0, height: 0 });
  const [targetTagId, setTargetTagId] = useState<string>(document.capture.tagId ?? "");

  const copy = useMemo(() => editorCopy(preferences.language), [preferences.language]);
  const stageRef = useRef<Konva.Stage | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const historyPast = useRef<AnnotationDocument[]>([]);
  const historyFuture = useRef<AnnotationDocument[]>([]);
  const dragStartDocument = useRef<AnnotationDocument | null>(null);
  const dragAnchor = useRef<{ x: number; y: number } | null>(null);
  const aliveRef = useRef(true);
  const imageWidth = image?.naturalWidth ?? 1;
  const imageHeight = image?.naturalHeight ?? 1;

  useEffect(() => {
    setAnnotationDocument(normalizeDocument(document));
    historyPast.current = [];
    historyFuture.current = [];
    setSelectedIds([]);
    setActiveTool("select");
    setZoomFactor(1);
    setCaptureNote(document.capture.note ?? "");
    setPersistedCaptureNote(document.capture.note ?? "");
    setTargetTagId(document.capture.tagId ?? "");
  }, [document]);

  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    const element = stageContainerRef.current;
    if (!element) {
      return;
    }

    const updateBounds = () => {
      const rect = element.getBoundingClientRect();
      setStageViewport({
        width: Math.max(rect.width - 24, 0),
        height: Math.max(rect.height - 24, 0),
      });
    };

    updateBounds();
    const observer = new ResizeObserver(() => updateBounds());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    if (!image || !stageViewport.width || !stageViewport.height) {
      return 1;
    }
    return clampScale(
      Math.min(
        stageViewport.width / image.naturalWidth,
        stageViewport.height / image.naturalHeight,
        1,
      ),
    );
  }, [image, stageViewport]);

  const stageScale = useMemo(
    () => clampScale(fitScale * zoomFactor),
    [fitScale, zoomFactor],
  );
  const draftPreview = useMemo(() => (draftRect ? normalizeRect(draftRect) : null), [draftRect]);

  const selectedItem =
    selectedIds.length === 1
      ? annotationDocument.items.find((item) => item.id === selectedIds[0]) ?? null
      : null;
  const availableTags = useMemo(
    () => tags.filter((tag) => tag.visible !== false),
    [tags],
  );
  const selectedTagWorkspaceId =
    availableTags.find((tag) => tag.id === targetTagId)?.workspaceId ?? activeWorkspaceId;

  const commit = (next: AnnotationDocument) => {
    historyPast.current.push(cloneDocument(annotationDocument));
    historyFuture.current = [];
    setAnnotationDocument({ ...next, savedAt: new Date().toISOString() });
  };

  const setWithoutHistory = (next: AnnotationDocument) => {
    setAnnotationDocument(next);
  };

  const undo = () => {
    const previous = historyPast.current.pop();
    if (!previous) {
      return;
    }
    historyFuture.current.unshift(cloneDocument(annotationDocument));
    setAnnotationDocument(previous);
  };

  const redo = () => {
    const next = historyFuture.current.shift();
    if (!next) {
      return;
    }
    historyPast.current.push(cloneDocument(annotationDocument));
    setAnnotationDocument(next);
  };

  const setZoomScale = (nextScale: number) => {
    if (!fitScale) {
      return;
    }
    setZoomFactor(clampScale(nextScale) / fitScale);
  };

  const getStagePoint = () => {
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) {
      return null;
    }
    return {
      x: pointer.x / stageScale,
      y: pointer.y / stageScale,
    };
  };

  const moveSelection = (dx: number, dy: number) => {
    if (selectedIds.length === 0) {
      return;
    }
    commit({
      ...annotationDocument,
      items: annotationDocument.items.map((item) =>
        selectedIds.includes(item.id)
          ? { ...item, x: item.x + dx, y: item.y + dy }
          : item,
      ),
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (isTyping && !matchesShortcut(event, shortcuts.save)) {
        return;
      }

      if (matchesShortcut(event, shortcuts.rectTool)) {
        event.preventDefault();
        setActiveTool("rect");
      } else if (matchesShortcut(event, shortcuts.numberTool)) {
        event.preventDefault();
        setActiveTool("number");
      } else if (matchesShortcut(event, shortcuts.textTool)) {
        event.preventDefault();
        setActiveTool("text");
      } else if (matchesShortcut(event, shortcuts.cropTool)) {
        event.preventDefault();
        setActiveTool("crop");
      } else if (matchesShortcut(event, shortcuts.save)) {
        event.preventDefault();
        void handleSave();
      } else if (matchesShortcut(event, shortcuts.cancel)) {
        event.preventDefault();
        if (activeTool !== "select") {
          setActiveTool("select");
          setDraftRect(null);
        } else {
          handleClose();
        }
      } else if (matchesShortcut(event, shortcuts.deleteSelection) && selectedIds.length > 0) {
        event.preventDefault();
        commit({
          ...annotationDocument,
          items: annotationDocument.items.filter((item) => !selectedIds.includes(item.id)),
        });
        setSelectedIds([]);
      } else if (matchesShortcut(event, shortcuts.undo)) {
        event.preventDefault();
        undo();
      } else if (matchesShortcut(event, shortcuts.redo)) {
        event.preventDefault();
        redo();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelection(0, -1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelection(0, 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveSelection(-1, 0);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveSelection(1, 0);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTool, annotationDocument, selectedIds, shortcuts, stageScale]);

  const selectItem = (itemId: string, multiSelect: boolean) => {
    setSelectedIds((current) => {
      if (!multiSelect) {
        return [itemId];
      }
      return current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];
    });
  };

  const updateSelectedItem = (updater: (item: AnnotationItem) => AnnotationItem) => {
    if (!selectedItem) {
      return;
    }
    commit({
      ...annotationDocument,
      items: annotationDocument.items.map((item) =>
        item.id === selectedItem.id ? updater(item) : item,
      ),
    });
  };

  const handleMouseDown = (event: { target: unknown }) => {
    const point = getStagePoint();
    if (!point) {
      return;
    }
    const target = event.target as Konva.Node | null;
    const clickedOnEmpty = isCanvasBackgroundTarget(target, stageRef.current);

    if (activeTool === "select") {
      if (clickedOnEmpty) {
        setSelectedIds([]);
      }
      return;
    }

    if (!clickedOnEmpty) {
      return;
    }

    if (activeTool === "number") {
      const nextBadge: BadgeAnnotation = {
        id: createId(),
        kind: "badge",
        x: point.x,
        y: point.y,
        value: maxBadgeValue(annotationDocument.items) + 1,
        fill: "#b2d1ff",
      };
      commit({
        ...annotationDocument,
        items: [...annotationDocument.items, nextBadge],
      });
      setSelectedIds([nextBadge.id]);
      setActiveTool("select");
      return;
    }

    if (activeTool === "text") {
      const nextText: TextAnnotation = {
        id: createId(),
        kind: "text",
        x: point.x,
        y: point.y,
        width: 180,
        text: preferences.language === "zh" ? "标签" : "Label",
        fill: defaultFill,
        textColor: "#f8fbff",
        fontSize: 16,
        padding: 12,
      };
      commit({
        ...annotationDocument,
        items: [...annotationDocument.items, nextText],
      });
      setSelectedIds([nextText.id]);
      setActiveTool("select");
      return;
    }

    setDraftRect({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const handleMouseMove = () => {
    if (!draftRect) {
      return;
    }
    const point = getStagePoint();
    if (!point) {
      return;
    }
    setDraftRect({
      x: draftRect.x,
      y: draftRect.y,
      width: point.x - draftRect.x,
      height: point.y - draftRect.y,
    });
  };

  const handleMouseUp = () => {
    if (!draftRect) {
      return;
    }
    const normalized = normalizeRect(draftRect);
    setDraftRect(null);
    if (normalized.width < 12 || normalized.height < 12) {
      return;
    }

    if (activeTool === "crop") {
      commit({ ...annotationDocument, crop: normalized });
      setActiveTool("select");
      return;
    }

    const nextRect: RectAnnotation = {
      id: createId(),
      kind: "rect",
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
      label: "",
      stroke: defaultStroke,
    };
    commit({
      ...annotationDocument,
      items: [...annotationDocument.items, nextRect],
    });
    setSelectedIds([nextRect.id]);
  };

  const startDrag = (item: AnnotationItem, x: number, y: number) => {
    dragStartDocument.current = cloneDocument(annotationDocument);
    dragAnchor.current = { x, y };
    if (!selectedIds.includes(item.id)) {
      setSelectedIds([item.id]);
    }
  };

  const continueDrag = (item: AnnotationItem, x: number, y: number) => {
    if (!dragStartDocument.current || !dragAnchor.current) {
      return;
    }
    const selectedSet = new Set(selectedIds.includes(item.id) ? selectedIds : [item.id]);
    const deltaX = x - dragAnchor.current.x;
    const deltaY = y - dragAnchor.current.y;
    const next = cloneDocument(dragStartDocument.current);
    next.items = next.items.map((current) =>
      selectedSet.has(current.id)
        ? {
            ...current,
            x: current.x + deltaX,
            y: current.y + deltaY,
          }
        : current,
    );
    setWithoutHistory(next);
  };

  const endDrag = () => {
    if (dragStartDocument.current) {
      historyPast.current.push(dragStartDocument.current);
      historyFuture.current = [];
    }
    dragStartDocument.current = null;
    dragAnchor.current = null;
  };

  const handleClose = () => {
    void handleNotePersist();
    onClose();
  };

  const handleNotePersist = async () => {
    if (captureNote === persistedCaptureNote) {
      return;
    }
    setNoteSaving(true);
    try {
      const updated = await api.updateCaptureNote(
        document.capture.id,
        document.capture.workspaceId === "inbox" ? null : document.capture.workspaceId,
        captureNote,
      );
      if (aliveRef.current) {
        setPersistedCaptureNote(updated.note ?? captureNote);
      }
    } finally {
      if (aliveRef.current) {
        setNoteSaving(false);
      }
    }
  };

  const handleSave = async () => {
    if (!image) {
      return;
    }
    setSaving(true);
    try {
      await handleNotePersist();
      const snapshot = {
        ...annotationDocument,
        savedAt: new Date().toISOString(),
      };
      const rendered = renderToDataUrl(image, snapshot);
      await onSave(
        rendered,
        snapshot,
        {
          targetWorkspaceId:
            selectedTagWorkspaceId === activeWorkspaceId ? activeWorkspaceId : selectedTagWorkspaceId,
          tagId: targetTagId || null,
        },
      );
    } finally {
      if (aliveRef.current) {
        setNoteSaving(false);
      }
      setSaving(false);
    }
  };

  const clearCrop = () => {
    commit({ ...annotationDocument, crop: null });
  };

  const toolbarButtons: Array<{ tool: Tool; label: string; icon: ReactNode; shortcut?: string }> = [
    { tool: "select", label: copy.toolLabels.select, icon: <Eye size={16} /> },
    { tool: "rect", label: copy.toolLabels.rect, icon: <Square size={16} />, shortcut: shortcuts.rectTool },
    { tool: "number", label: copy.toolLabels.number, icon: <Minus size={16} />, shortcut: shortcuts.numberTool },
    { tool: "text", label: copy.toolLabels.text, icon: <StickyNote size={16} />, shortcut: shortcuts.textTool },
    { tool: "crop", label: copy.toolLabels.crop, icon: <PencilRuler size={16} />, shortcut: shortcuts.cropTool },
  ];

  const zoomPercent = Math.round(stageScale * 100);
  const selectionCountLabel = selectionTitle(selectedIds, copy);

  return (
    <div className="editor-overlay">
      <div className="editor-shell glass-card">
        <header className="editor-topbar">
          <div>
            <h3>GleanDex</h3>
          </div>
          <div className="toolbar-cluster">
            <button className="ghost-button" onClick={handleClose} type="button">
              <X size={16} />
              {copy.close}
            </button>
            <button className="glass-button" onClick={() => void handleSave()} type="button" disabled={saving}>
              <Save size={16} />
              {saving ? copy.saving : copy.save}
            </button>
          </div>
        </header>

        <div className="editor-body">
          <section className="editor-stage-wrap">
            <div className="editor-stage-toolbar">
              <div className="editor-tool-strip">
                {toolbarButtons.map((button) => (
                  <button
                    className={activeTool === button.tool ? "tool-button is-active" : "tool-button"}
                    key={button.tool}
                    onClick={() => setActiveTool(button.tool)}
                    type="button"
                  >
                    {button.icon}
                    {button.label}
                    {button.shortcut ? <span>{formatShortcut(button.shortcut)}</span> : null}
                  </button>
                ))}
                <button className="tool-button" onClick={undo} type="button">
                  <Undo2 size={16} />
                  <span>{formatShortcut(shortcuts.undo)}</span>
                </button>
                <button className="tool-button" onClick={redo} type="button">
                  <Redo2 size={16} />
                  <span>{formatShortcut(shortcuts.redo)}</span>
                </button>
              </div>

              <div className="editor-zoom-strip">
                <button className="tool-button" onClick={() => setZoomScale(stageScale / 1.15)} type="button">
                  <Minus size={16} />
                </button>
                <button className="tool-button" onClick={() => setZoomFactor(1)} type="button">
                  {copy.fit}
                </button>
                <button className="tool-button" onClick={() => setZoomScale(1)} type="button">
                  {zoomPercent}%
                </button>
                <button className="tool-button" onClick={() => setZoomScale(stageScale * 1.15)} type="button">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div
              className="editor-stage-scroll"
              ref={(node) => {
                stageContainerRef.current = node;
              }}
            >
              <Stage
                height={imageHeight * stageScale}
                onMouseDown={(event) => void handleMouseDown(event)}
                onMouseMove={handleMouseMove}
                onMouseUp={() => void handleMouseUp()}
                ref={(node) => {
                  stageRef.current = node;
                }}
                scaleX={stageScale}
                scaleY={stageScale}
                width={imageWidth * stageScale}
              >
                <Layer>
                  {image ? (
                    <KonvaImage
                      image={image}
                      listening={false}
                      x={0}
                      y={0}
                      width={imageWidth}
                      height={imageHeight}
                    />
                  ) : null}

                  {annotationDocument.crop ? (
                    <>
                      <Rect
                        fill="rgba(8, 10, 18, 0.55)"
                        height={annotationDocument.crop.y}
                        listening={false}
                        width={imageWidth}
                        x={0}
                        y={0}
                      />
                      <Rect
                        fill="rgba(8, 10, 18, 0.55)"
                        height={imageHeight - annotationDocument.crop.y - annotationDocument.crop.height}
                        listening={false}
                        width={imageWidth}
                        x={0}
                        y={annotationDocument.crop.y + annotationDocument.crop.height}
                      />
                      <Rect
                        fill="rgba(8, 10, 18, 0.55)"
                        height={annotationDocument.crop.height}
                        listening={false}
                        width={annotationDocument.crop.x}
                        x={0}
                        y={annotationDocument.crop.y}
                      />
                      <Rect
                        fill="rgba(8, 10, 18, 0.55)"
                        height={annotationDocument.crop.height}
                        listening={false}
                        width={imageWidth - annotationDocument.crop.x - annotationDocument.crop.width}
                        x={annotationDocument.crop.x + annotationDocument.crop.width}
                        y={annotationDocument.crop.y}
                      />
                      <Rect
                        dash={[10, 6]}
                        height={annotationDocument.crop.height}
                        listening={false}
                        stroke="#ffffff"
                        strokeWidth={2}
                        width={annotationDocument.crop.width}
                        x={annotationDocument.crop.x}
                        y={annotationDocument.crop.y}
                      />
                    </>
                  ) : null}

                  {annotationDocument.items.map((item) => {
                    const isSelected = selectedIds.includes(item.id);

                    if (item.kind === "rect") {
                      return (
                        <Group
                          draggable={activeTool === "select"}
                          key={item.id}
                          onClick={(event) => {
                            event.cancelBubble = true;
                            selectItem(item.id, event.evt.shiftKey);
                          }}
                          onDragEnd={endDrag}
                          onDragMove={(event) => continueDrag(item, event.target.x(), event.target.y())}
                          onDragStart={(event) => startDrag(item, event.target.x(), event.target.y())}
                          x={item.x}
                          y={item.y}
                        >
                          <Rect
                            height={item.height}
                            shadowBlur={isSelected ? 14 : 0}
                            stroke={item.stroke}
                            strokeWidth={isSelected ? 4 : 3}
                            width={item.width}
                          />
                          {item.label ? (
                            <>
                              <Rect
                                cornerRadius={14}
                                fill="rgba(10,16,28,0.92)"
                                height={30}
                                width={Math.max(90, item.label.length * 10 + 24)}
                                y={-38}
                              />
                              <Text
                                fill="#f7fbff"
                                fontFamily="Manrope"
                                fontSize={16}
                                fontStyle="600"
                                padding={12}
                                text={item.label}
                                y={-37}
                              />
                            </>
                          ) : null}
                          {item.number ? (
                            <>
                              <Circle fill={item.stroke} radius={16} x={14} y={14} />
                              <Text
                                align="center"
                                fill="#03101f"
                                fontFamily="Manrope"
                                fontSize={16}
                                fontStyle="700"
                                text={String(item.number)}
                                width={32}
                                x={-2}
                                y={6}
                              />
                            </>
                          ) : null}
                        </Group>
                      );
                    }

                    if (item.kind === "badge") {
                      return (
                        <Group
                          draggable={activeTool === "select"}
                          key={item.id}
                          onClick={(event) => {
                            event.cancelBubble = true;
                            selectItem(item.id, event.evt.shiftKey);
                          }}
                          onDragEnd={endDrag}
                          onDragMove={(event) => continueDrag(item, event.target.x(), event.target.y())}
                          onDragStart={(event) => startDrag(item, event.target.x(), event.target.y())}
                          x={item.x}
                          y={item.y}
                        >
                          <Circle fill={item.fill} radius={18} shadowBlur={isSelected ? 14 : 0} />
                          <Text
                            align="center"
                            fill="#04111f"
                            fontFamily="Manrope"
                            fontSize={16}
                            fontStyle="700"
                            text={String(item.value)}
                            width={36}
                            x={-18}
                            y={-8}
                          />
                        </Group>
                      );
                    }

                    const metrics = textMetrics(item);
                    return (
                      <Group
                        draggable={activeTool === "select"}
                        key={item.id}
                        onClick={(event) => {
                          event.cancelBubble = true;
                          selectItem(item.id, event.evt.shiftKey);
                        }}
                        onDragEnd={endDrag}
                        onDragMove={(event) => continueDrag(item, event.target.x(), event.target.y())}
                        onDragStart={(event) => startDrag(item, event.target.x(), event.target.y())}
                        x={item.x}
                        y={item.y}
                      >
                        <Rect
                          cornerRadius={16}
                          fill={item.fill}
                          height={metrics.height}
                          shadowBlur={isSelected ? 14 : 0}
                          width={item.width}
                        />
                        <Text
                          fill={metrics.textColor}
                          fontFamily="Manrope"
                          fontSize={metrics.fontSize}
                          fontStyle="600"
                          lineHeight={1.25}
                          padding={metrics.padding}
                          text={item.text}
                          width={item.width}
                        />
                      </Group>
                    );
                  })}

                  {draftPreview ? (
                    <Rect
                      dash={[10, 6]}
                      fill={activeTool === "crop" ? "rgba(255,255,255,0.12)" : "rgba(107,227,255,0.12)"}
                      height={draftPreview.height}
                      listening={false}
                      stroke={activeTool === "crop" ? "#ffffff" : defaultStroke}
                      strokeWidth={2}
                      width={draftPreview.width}
                      x={draftPreview.x}
                      y={draftPreview.y}
                    />
                  ) : null}
                </Layer>
              </Stage>
            </div>
          </section>

          <aside className="editor-sidebar">
            <section className="glass-card editor-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{copy.selection}</p>
                  <h4>{selectionCountLabel}</h4>
                </div>
                {selectedIds.length > 1 ? <span className="section-count">{selectedIds.length}</span> : null}
              </div>

              {selectedItem?.kind === "rect" ? (
                <div className="editor-fields">
                  <div className="editor-field-grid">
                    <label>
                      <span>{copy.x}</span>
                      <input
                        min={0}
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "rect"
                              ? { ...item, x: clampNumber(Number(event.target.value), item.x) }
                              : item,
                          )
                        }
                        type="number"
                        value={selectedItem.x}
                      />
                    </label>
                    <label>
                      <span>{copy.y}</span>
                      <input
                        min={0}
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "rect"
                              ? { ...item, y: clampNumber(Number(event.target.value), item.y) }
                              : item,
                          )
                        }
                        type="number"
                        value={selectedItem.y}
                      />
                    </label>
                    <label>
                      <span>{copy.width}</span>
                      <input
                        min={8}
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "rect"
                              ? {
                                  ...item,
                                  width: clampNumber(Number(event.target.value), item.width, 8),
                                }
                              : item,
                          )
                        }
                        type="number"
                        value={selectedItem.width}
                      />
                    </label>
                    <label>
                      <span>{copy.height}</span>
                      <input
                        min={8}
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "rect"
                              ? {
                                  ...item,
                                  height: clampNumber(Number(event.target.value), item.height, 8),
                                }
                              : item,
                          )
                        }
                        type="number"
                        value={selectedItem.height}
                      />
                    </label>
                  </div>
                  <label>
                    <span>{copy.label}</span>
                    <input
                      onChange={(event) =>
                        updateSelectedItem((item) =>
                          item.kind === "rect" ? { ...item, label: event.target.value } : item,
                        )
                      }
                      value={selectedItem.label}
                    />
                  </label>
                  <div className="editor-field-grid">
                    <label>
                      <span>{copy.number}</span>
                      <input
                        min={0}
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "rect"
                              ? {
                                  ...item,
                                  number: event.target.value ? Number(event.target.value) : undefined,
                                }
                              : item,
                          )
                        }
                        type="number"
                        value={selectedItem.number ?? ""}
                      />
                    </label>
                    <label>
                      <span>{copy.stroke}</span>
                      <input
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "rect" ? { ...item, stroke: event.target.value } : item,
                          )
                        }
                        type="color"
                        value={selectedItem.stroke}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {selectedItem?.kind === "text" ? (
                <div className="editor-fields">
                  <div className="editor-field-grid">
                    <label>
                      <span>{copy.x}</span>
                      <input
                        min={0}
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "text"
                              ? { ...item, x: clampNumber(Number(event.target.value), item.x) }
                              : item,
                          )
                        }
                        type="number"
                        value={selectedItem.x}
                      />
                    </label>
                    <label>
                      <span>{copy.y}</span>
                      <input
                        min={0}
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "text"
                              ? { ...item, y: clampNumber(Number(event.target.value), item.y) }
                              : item,
                          )
                        }
                        type="number"
                        value={selectedItem.y}
                      />
                    </label>
                    <label>
                      <span>{copy.width}</span>
                      <input
                        min={80}
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "text"
                              ? {
                                  ...item,
                                  width: clampNumber(Number(event.target.value), item.width, 80),
                                }
                              : item,
                          )
                        }
                        type="number"
                        value={selectedItem.width}
                      />
                    </label>
                    <label>
                      <span>{copy.fontSize}</span>
                      <input
                        min={12}
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "text"
                              ? {
                                  ...item,
                                  fontSize: clampNumber(Number(event.target.value), item.fontSize ?? 16, 12),
                                }
                              : item,
                          )
                        }
                        type="number"
                        value={selectedItem.fontSize ?? 16}
                      />
                    </label>
                  </div>
                  <div className="editor-field-grid">
                    <label>
                      <span>{copy.background}</span>
                      <input
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "text" ? { ...item, fill: event.target.value } : item,
                          )
                        }
                        type="color"
                        value={selectedItem.fill}
                      />
                    </label>
                    <label>
                      <span>{copy.textColor}</span>
                      <input
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "text"
                              ? { ...item, textColor: event.target.value }
                              : item,
                          )
                        }
                        type="color"
                        value={selectedItem.textColor ?? "#f8fbff"}
                      />
                    </label>
                  </div>
                  <label>
                    <span>{copy.text}</span>
                    <textarea
                      onChange={(event) =>
                        updateSelectedItem((item) =>
                          item.kind === "text" ? { ...item, text: event.target.value } : item,
                        )
                      }
                      rows={4}
                      value={selectedItem.text}
                    />
                  </label>
                </div>
              ) : null}

              {selectedItem?.kind === "badge" ? (
                <div className="editor-fields">
                  <div className="editor-field-grid">
                    <label>
                      <span>{copy.x}</span>
                      <input
                        min={0}
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "badge"
                              ? { ...item, x: clampNumber(Number(event.target.value), item.x) }
                              : item,
                          )
                        }
                        type="number"
                        value={selectedItem.x}
                      />
                    </label>
                    <label>
                      <span>{copy.y}</span>
                      <input
                        min={0}
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "badge"
                              ? { ...item, y: clampNumber(Number(event.target.value), item.y) }
                              : item,
                          )
                        }
                        type="number"
                        value={selectedItem.y}
                      />
                    </label>
                    <label>
                      <span>{copy.value}</span>
                      <input
                        min={1}
                        onChange={(event) =>
                          updateSelectedItem((item) =>
                            item.kind === "badge"
                              ? { ...item, value: Math.max(1, Number(event.target.value) || 1) }
                              : item,
                          )
                        }
                        type="number"
                        value={selectedItem.value}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {!selectedItem ? <p className="hint-copy">{copy.selectionHint}</p> : null}
            </section>

            {availableTags.length ? (
              <section className="glass-card editor-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{copy.tag}</p>
                    <h4>{copy.destination}</h4>
                  </div>
                </div>
                <div className="editor-fields">
                  <label>
                    <span>{copy.tag}</span>
                    <select onChange={(event) => setTargetTagId(event.target.value)} value={targetTagId}>
                      <option value="">{copy.keepCurrent}</option>
                      {availableTags.map((tag) => {
                        const workspace = workspaces.find((item) =>
                          item.isInbox ? tag.workspaceId === null : item.id === tag.workspaceId,
                        );
                        const workspaceLabel = workspace?.isInbox
                          ? preferences.language === "zh"
                            ? "收集箱"
                            : "Inbox"
                          : workspace?.name || (preferences.language === "zh" ? "工作区" : "Workspace");
                        return (
                          <option key={tag.id} value={tag.id}>
                            {tag.label} · {workspaceLabel}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>
              </section>
            ) : null}

            <section className="glass-card editor-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{copy.note}</p>
                  <h4>{noteSaving ? copy.saving : copy.note}</h4>
                </div>
              </div>
              <div className="editor-fields">
                <label>
                  <span>{copy.note}</span>
                  <textarea
                    onBlur={() => void handleNotePersist()}
                    onChange={(event) => setCaptureNote(event.target.value)}
                    rows={3}
                    value={captureNote}
                  />
                </label>
              </div>
            </section>

            <section className="glass-card editor-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{copy.cropHistory}</p>
                  <h4>{copy.stableOutput}</h4>
                </div>
              </div>
              <p className="hint-copy">{copy.cropHint}</p>

              {annotationDocument.crop ? (
                <div className="editor-fields">
                  <div className="editor-field-grid">
                    <label>
                      <span>{copy.x}</span>
                      <input
                        min={0}
                        onChange={(event) =>
                          commit({
                            ...annotationDocument,
                            crop: annotationDocument.crop
                              ? {
                                  ...annotationDocument.crop,
                                  x: clampNumber(Number(event.target.value), annotationDocument.crop.x),
                                }
                              : null,
                          })
                        }
                        type="number"
                        value={annotationDocument.crop.x}
                      />
                    </label>
                    <label>
                      <span>{copy.y}</span>
                      <input
                        min={0}
                        onChange={(event) =>
                          commit({
                            ...annotationDocument,
                            crop: annotationDocument.crop
                              ? {
                                  ...annotationDocument.crop,
                                  y: clampNumber(Number(event.target.value), annotationDocument.crop.y),
                                }
                              : null,
                          })
                        }
                        type="number"
                        value={annotationDocument.crop.y}
                      />
                    </label>
                    <label>
                      <span>{copy.width}</span>
                      <input
                        min={1}
                        onChange={(event) =>
                          commit({
                            ...annotationDocument,
                            crop: annotationDocument.crop
                              ? {
                                  ...annotationDocument.crop,
                                  width: clampNumber(Number(event.target.value), annotationDocument.crop.width, 1),
                                }
                              : null,
                          })
                        }
                        type="number"
                        value={annotationDocument.crop.width}
                      />
                    </label>
                    <label>
                      <span>{copy.height}</span>
                      <input
                        min={1}
                        onChange={(event) =>
                          commit({
                            ...annotationDocument,
                            crop: annotationDocument.crop
                              ? {
                                  ...annotationDocument.crop,
                                  height: clampNumber(Number(event.target.value), annotationDocument.crop.height, 1),
                                }
                              : null,
                          })
                        }
                        type="number"
                        value={annotationDocument.crop.height}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              <div className="editor-actions">
                <button className="ghost-button" disabled={!annotationDocument.crop} onClick={clearCrop} type="button">
                  <Eraser size={16} />
                  {copy.clearCrop}
                </button>
              </div>

              <div className="version-list">
                {document.versions.map((version) => (
                  <div className="version-row" key={version.id}>
                    <strong>{version.kind}</strong>
                    <span>{new Date(version.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
