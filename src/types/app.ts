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
  remoteSettings: WorkspaceRemoteSettings;
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
  remote: CaptureRemoteState;
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
export type AccentTheme = "blue" | "graphite" | "mint" | "rose" | "custom";
export type DetectionPreset = "balanced" | "dense" | "focused";
export type CloseAction = "tray" | "quit";
export type RemoteJobKind = "workspace-sync" | "capture-publish";
export type RemoteJobStatus = "queued" | "running" | "failed";
export type RemoteSyncStatus = "idle" | "syncing" | "synced" | "failed" | "conflict";
export type RemotePublishStatus = "idle" | "publishing" | "published" | "failed";
export type RemoteProvider = "webdav" | "s3";

export interface PreferencesConfig {
  language: LanguageCode;
  themeMode: ThemeMode;
  accentTheme: AccentTheme;
  customAccentColor: string;
  popupDurationSeconds: number;
  extendPopupOnInteraction: boolean;
  showWorkspaceTags: boolean;
  detectionPreset: DetectionPreset;
  autoDetectLabels: boolean;
  autoNumberDetections: boolean;
  closeAction: CloseAction;
}

export interface WebDavConnectionConfig {
  enabled: boolean;
  baseUrl: string;
  username: string;
  rootPath: string;
  hasPassword: boolean;
  lastTestedAt: string | null;
  lastTestSuccess: boolean | null;
  lastTestMessage: string;
}

export interface S3ConnectionConfig {
  enabled: boolean;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
  hasSecretAccessKey: boolean;
  lastTestedAt: string | null;
  lastTestSuccess: boolean | null;
  lastTestMessage: string;
}

export interface RemoteConnectionConfig {
  enabled: boolean;
  webdav: WebDavConnectionConfig;
  s3: S3ConnectionConfig;
}

export interface WorkspaceRemoteSettings {
  webdavEnabled: boolean;
  webdavPath: string;
  s3Enabled: boolean;
  s3Prefix: string;
  lastSyncAt: string | null;
  lastSyncStatus: RemoteSyncStatus;
  lastSyncMessage: string;
  lastPublishAt: string | null;
  lastPublishStatus: RemotePublishStatus;
  lastPublishMessage: string;
}

export interface CaptureRemoteState {
  syncStatus: RemoteSyncStatus;
  publishStatus: RemotePublishStatus;
  remoteUrl: string | null;
  remoteObjectKey: string | null;
  lastSyncedAt: string | null;
  lastPublishedAt: string | null;
  lastError: string;
}

export interface SyncJob {
  id: string;
  kind: RemoteJobKind;
  workspaceId: string | null;
  captureId: string | null;
  status: RemoteJobStatus;
  attempts: number;
  error: string;
  scheduledAt: string;
  updatedAt: string;
}

export interface SyncConflict {
  id: string;
  workspaceId: string | null;
  relativePath: string;
  localPath: string;
  incomingPath: string;
  createdAt: string;
  status: "open" | "resolved";
  resolvedAt?: string;
  resolution?: string;
}

export interface RemoteStatePayload {
  connections: RemoteConnectionConfig;
  workspaceSettings: Record<string, WorkspaceRemoteSettings>;
  jobs: SyncJob[];
  conflicts: SyncConflict[];
  summary: {
    enabled: boolean;
    configured: boolean;
    pendingJobs: number;
    conflicts: number;
    activeWorkspaceStatus: RemoteSyncStatus;
  };
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
  remote: RemoteStatePayload["summary"];
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
