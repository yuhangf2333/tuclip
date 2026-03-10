export interface WorkspaceTag {
  id: string;
  label: string;
  color: string;
}

export interface QuickTag extends WorkspaceTag {
  workspaceId: string | null;
  visible: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  appendTimestamp: boolean;
  monitoringPaused: boolean;
  createdAt: string;
  isInbox: boolean;
  tags: WorkspaceTag[];
}

export interface CaptureItem {
  id: string;
  workspaceId: string;
  status: string;
  publicPath: string;
  orderIndex: number;
  createdAt: string;
  currentVersionId: string;
  sourceHash: string;
  tagId: string | null;
  note: string;
}

export interface CaptureVersion {
  id: string;
  captureId: string;
  kind: string;
  archivedPath: string;
  annotationPath: string | null;
  createdAt: string;
}

export interface PendingCapture {
  id: string;
  tempPath: string;
  detectedAt: string;
  expiresAt: string;
  sourceHash: string;
  workspaceHintId: string | null;
  selectedTagId: string | null;
  note: string;
}

export interface ShortcutConfig {
  rectTool: string;
  numberTool: string;
  textTool: string;
  cropTool: string;
  save: string;
  cancel: string;
  deleteSelection: string;
  undo: string;
  redo: string;
  quickSavePending: string;
  quickAnnotatePending: string;
  dismissPopup: string;
  toggleMonitoring: string;
}

export type LanguageCode = "en" | "zh";
export type ThemeMode = "system" | "light" | "dark";
export type AccentTheme = "blue" | "graphite" | "mint" | "rose";
export type DetectionPreset = "balanced" | "dense" | "focused";
export type CloseAction = "tray" | "quit";

export interface PreferencesConfig {
  language: LanguageCode;
  themeMode: ThemeMode;
  accentTheme: AccentTheme;
  popupDurationSeconds: number;
  extendPopupOnInteraction: boolean;
  showWorkspaceTags: boolean;
  detectionPreset: DetectionPreset;
  autoDetectLabels: boolean;
  autoNumberDetections: boolean;
  closeAction: CloseAction;
}

export interface AppStatePayload {
  monitoringPaused: boolean;
  activeWorkspaceId: string | null;
  shortcuts: ShortcutConfig;
  preferences: PreferencesConfig;
  pendingCount: number;
  editorTargetCaptureId: string | null;
  inboxRoot: string;
  tags: QuickTag[];
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RectAnnotation {
  id: string;
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  number?: number;
  stroke: string;
}

export interface BadgeAnnotation {
  id: string;
  kind: "badge";
  x: number;
  y: number;
  value: number;
  fill: string;
}

export interface TextAnnotation {
  id: string;
  kind: "text";
  x: number;
  y: number;
  width: number;
  text: string;
  fill: string;
  textColor?: string;
  fontSize?: number;
  padding?: number;
}

export type AnnotationItem = RectAnnotation | BadgeAnnotation | TextAnnotation;

export interface AnnotationDocument {
  items: AnnotationItem[];
  crop: CropArea | null;
  savedAt?: string;
}

export interface EditorDocument {
  capture: CaptureItem;
  versions: CaptureVersion[];
  annotationDocument: AnnotationDocument;
}
