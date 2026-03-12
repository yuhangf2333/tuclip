import type {
  AnnotationDocument,
  AppStatePayload,
  CaptureItem,
  EditorDocument,
  PendingCapture,
  PreferencesConfig,
  QuickTag,
  RemoteConnectionConfig,
  RemoteProvider,
  RemoteStatePayload,
  ShortcutConfig,
  Workspace,
  WorkspaceRemoteSettings,
  SyncConflict,
} from "../types/app";

function bridge() {
  if (!window.tuclip) {
    throw new Error("TuClip desktop bridge is unavailable");
  }
  return window.tuclip;
}

export const api = {
  getAppState: () => bridge().getAppState(),
  listWorkspaces: () => bridge().listWorkspaces(),
  pickDirectory: () => bridge().pickDirectory(),
  createWorkspace: (name: string, rootPath: string, appendTimestamp: boolean) =>
    bridge().createWorkspace(name, rootPath, appendTimestamp),
  showWorkspaceContextMenu: (
    rootPath: string,
    workspaceLabel: string,
    openFolderLabel: string,
  ) => bridge().showWorkspaceContextMenu(rootPath, workspaceLabel, openFolderLabel),
  setActiveWorkspace: (workspaceId: string | null) => bridge().setActiveWorkspace(workspaceId),
  updateShortcuts: (shortcuts: ShortcutConfig) => bridge().updateShortcuts(shortcuts),
  updatePreferences: (preferences: PreferencesConfig) => bridge().updatePreferences(preferences),
  getRemoteState: () => bridge().getRemoteState(),
  updateRemoteConnections: (patch: {
    enabled?: boolean;
    webdav?: Partial<RemoteConnectionConfig["webdav"]> & { password?: string };
    s3?: Partial<RemoteConnectionConfig["s3"]> & { secretAccessKey?: string };
  }) => bridge().updateRemoteConnections(patch),
  testRemoteConnection: (
    provider: RemoteProvider,
    patch?: {
      webdav?: Partial<RemoteConnectionConfig["webdav"]> & { password?: string };
      s3?: Partial<RemoteConnectionConfig["s3"]> & { secretAccessKey?: string };
    },
  ) => bridge().testRemoteConnection(provider, patch),
  updateWorkspaceRemoteSettings: (workspaceId: string | null, patch: Partial<WorkspaceRemoteSettings>) =>
    bridge().updateWorkspaceRemoteSettings(workspaceId, patch),
  runWorkspaceSync: (workspaceId: string | null) => bridge().runWorkspaceSync(workspaceId),
  retryRemoteJobs: () => bridge().retryRemoteJobs(),
  publishCaptureNow: (captureId: string, workspaceId: string | null) =>
    bridge().publishCaptureNow(captureId, workspaceId),
  copyCaptureRemoteUrl: (captureId: string, workspaceId: string | null) =>
    bridge().copyCaptureRemoteUrl(captureId, workspaceId),
  openCaptureRemoteUrl: (captureId: string, workspaceId: string | null) =>
    bridge().openCaptureRemoteUrl(captureId, workspaceId),
  resolveSyncConflict: (conflictId: string, action?: "resolved" | "useIncoming" | "keepLocal") =>
    bridge().resolveSyncConflict(conflictId, action),
  updateTags: (tags: QuickTag[]) => bridge().updateTags(tags),
  toggleMonitoring: (paused?: boolean) => bridge().toggleMonitoring(paused),
  listPendingCaptures: () => bridge().listPendingCaptures(),
  selectPendingTag: (pendingId: string, tagId: string | null) => bridge().selectPendingTag(pendingId, tagId),
  updatePendingNote: (pendingId: string, note: string) => bridge().updatePendingNote(pendingId, note),
  extendPopupCountdown: () => bridge().extendPopupCountdown(),
  savePendingCapture: (
    pendingId: string,
    targetWorkspaceId: string | null,
    openEditor = false,
  ) => bridge().savePendingCapture(pendingId, targetWorkspaceId, openEditor),
  discardPendingCapture: (pendingId: string) => bridge().discardPendingCapture(pendingId),
  listCaptures: (workspaceId: string | null) => bridge().listCaptures(workspaceId),
  openCaptureInEditor: (captureId: string, workspaceId: string | null) =>
    bridge().openCaptureInEditor(captureId, workspaceId),
  updateCaptureNote: (captureId: string, workspaceId: string | null, note: string) =>
    bridge().updateCaptureNote(captureId, workspaceId, note),
  updateCaptureTag: (captureId: string, workspaceId: string | null, tagId: string | null) =>
    bridge().updateCaptureTag(captureId, workspaceId, tagId),
  saveCaptureEdit: (
    captureId: string,
    workspaceId: string | null,
    renderedPngBase64: string,
    annotationDocument: AnnotationDocument,
  ) => bridge().saveCaptureEdit(captureId, workspaceId, renderedPngBase64, annotationDocument),
  reorderCaptures: (workspaceId: string | null, captureIds: string[]) =>
    bridge().reorderCaptures(workspaceId, captureIds),
  moveCaptureToWorkspace: (
    captureId: string,
    sourceWorkspaceId: string | null,
    targetWorkspaceId: string | null,
  ) => bridge().moveCaptureToWorkspace(captureId, sourceWorkspaceId, targetWorkspaceId),
  takeEditorTarget: () => bridge().takeEditorTarget(),
  showMainWindow: () => bridge().showMainWindow(),
  hideCurrentWindow: () => bridge().hideCurrentWindow(),
  fileUrl: (filePath: string) => bridge().fileUrl(filePath),
};

export type TuClipBridge = {
  getAppState: () => Promise<AppStatePayload>;
  listWorkspaces: () => Promise<Workspace[]>;
  pickDirectory: () => Promise<string | null>;
  createWorkspace: (
    name: string,
    rootPath: string,
    appendTimestamp: boolean,
  ) => Promise<Workspace>;
  showWorkspaceContextMenu: (
    rootPath: string,
    workspaceLabel: string,
    openFolderLabel: string,
  ) => Promise<boolean>;
  setActiveWorkspace: (workspaceId: string | null) => Promise<AppStatePayload>;
  updateShortcuts: (shortcuts: ShortcutConfig) => Promise<ShortcutConfig>;
  updatePreferences: (preferences: PreferencesConfig) => Promise<PreferencesConfig>;
  getRemoteState: () => Promise<RemoteStatePayload>;
  updateRemoteConnections: (patch: {
    enabled?: boolean;
    webdav?: Partial<RemoteConnectionConfig["webdav"]> & { password?: string };
    s3?: Partial<RemoteConnectionConfig["s3"]> & { secretAccessKey?: string };
  }) => Promise<RemoteConnectionConfig>;
  testRemoteConnection: (
    provider: RemoteProvider,
    patch?: {
      webdav?: Partial<RemoteConnectionConfig["webdav"]> & { password?: string };
      s3?: Partial<RemoteConnectionConfig["s3"]> & { secretAccessKey?: string };
    },
  ) => Promise<{ checkedAt: string; ok: boolean; message: string }>;
  updateWorkspaceRemoteSettings: (
    workspaceId: string | null,
    patch: Partial<WorkspaceRemoteSettings>,
  ) => Promise<WorkspaceRemoteSettings>;
  runWorkspaceSync: (workspaceId: string | null) => Promise<RemoteStatePayload>;
  retryRemoteJobs: () => Promise<RemoteStatePayload>;
  publishCaptureNow: (
    captureId: string,
    workspaceId: string | null,
  ) => Promise<CaptureItem>;
  copyCaptureRemoteUrl: (captureId: string, workspaceId: string | null) => Promise<string>;
  openCaptureRemoteUrl: (captureId: string, workspaceId: string | null) => Promise<string>;
  resolveSyncConflict: (
    conflictId: string,
    action?: "resolved" | "useIncoming" | "keepLocal",
  ) => Promise<SyncConflict>;
  updateTags: (tags: QuickTag[]) => Promise<QuickTag[]>;
  toggleMonitoring: (paused?: boolean) => Promise<AppStatePayload>;
  listPendingCaptures: () => Promise<PendingCapture[]>;
  selectPendingTag: (pendingId: string, tagId: string | null) => Promise<PendingCapture>;
  updatePendingNote: (pendingId: string, note: string) => Promise<PendingCapture>;
  extendPopupCountdown: () => Promise<PendingCapture | null>;
  savePendingCapture: (
    pendingId: string,
    targetWorkspaceId: string | null,
    openEditor: boolean,
  ) => Promise<CaptureItem>;
  discardPendingCapture: (pendingId: string) => Promise<void>;
  listCaptures: (workspaceId: string | null) => Promise<CaptureItem[]>;
  openCaptureInEditor: (
    captureId: string,
    workspaceId: string | null,
  ) => Promise<EditorDocument>;
  updateCaptureNote: (
    captureId: string,
    workspaceId: string | null,
    note: string,
  ) => Promise<CaptureItem>;
  updateCaptureTag: (
    captureId: string,
    workspaceId: string | null,
    tagId: string | null,
  ) => Promise<CaptureItem>;
  saveCaptureEdit: (
    captureId: string,
    workspaceId: string | null,
    renderedPngBase64: string,
    annotationDocument: AnnotationDocument,
  ) => Promise<CaptureItem>;
  reorderCaptures: (workspaceId: string | null, captureIds: string[]) => Promise<CaptureItem[]>;
  moveCaptureToWorkspace: (
    captureId: string,
    sourceWorkspaceId: string | null,
    targetWorkspaceId: string | null,
  ) => Promise<CaptureItem>;
  takeEditorTarget: () => Promise<string | null>;
  showMainWindow: () => Promise<void>;
  hideCurrentWindow: () => Promise<void>;
  fileUrl: (filePath: string) => string;
};
