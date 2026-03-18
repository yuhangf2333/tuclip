import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Cloud,
  FolderPlus,
  MonitorPause,
  MonitorPlay,
  RefreshCcw,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";

import "./App.css";
import { CaptureEditor } from "./components/CaptureEditor";
import { CaptureGrid } from "./components/CaptureGrid";
import { PendingPanel } from "./components/PendingPanel";
import { PreferencesPanel } from "./components/PreferencesPanel";
import { PopupShell } from "./components/PopupShell";
import { Sidebar } from "./components/Sidebar";
import { api } from "./lib/api";
import { getStrings } from "./lib/i18n";
import { matchesShortcut } from "./lib/shortcuts";
import { applyAppearance, detectPlatform, resolveTheme } from "./lib/theme";
import type {
  AnnotationDocument,
  AppStatePayload,
  CaptureItem,
  EditorDocument,
  PendingCapture,
  PreferencesConfig,
  QuickTag,
  RemoteProvider,
  RemoteStatePayload,
  ShortcutConfig,
  Workspace,
} from "./types/app";

type FeedbackTone = "success" | "info" | "warning" | "error";

interface AppFeedback {
  id: number;
  tone: FeedbackTone;
  text: string;
}

function baseNameFromPath(filePath: string) {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? "Workspace";
}

function App() {
  const isPopup = useMemo(
    () => new URLSearchParams(window.location.search).get("popup") === "1",
    [],
  );
  const platform = useMemo(() => detectPlatform(), []);

  const [appState, setAppState] = useState<AppStatePayload | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [pendingCaptures, setPendingCaptures] = useState<PendingCapture[]>([]);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [remoteState, setRemoteState] = useState<RemoteStatePayload | null>(null);
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
  const [editorDocument, setEditorDocument] = useState<EditorDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [feedback, setFeedback] = useState<AppFeedback | null>(null);
  const [prefersDark, setPrefersDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  const activeWorkspaceId = appState?.activeWorkspaceId ?? null;
  const strings = useMemo(() => getStrings(appState?.preferences?.language), [appState?.preferences?.language]);
  const resolvedTheme = useMemo(
    () => resolveTheme(appState?.preferences?.themeMode ?? "system", prefersDark),
    [appState?.preferences?.themeMode, prefersDark],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setPrefersDark(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    applyAppearance(
      resolvedTheme,
      appState?.preferences?.accentTheme ?? "blue",
      appState?.preferences?.customAccentColor ?? "#0f6cbd",
      appState?.preferences?.language ?? "en",
      platform,
    );
  }, [
    appState?.preferences?.accentTheme,
    appState?.preferences?.customAccentColor,
    appState?.preferences?.language,
    platform,
    resolvedTheme,
  ]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFeedback(null);
    }, 2600);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const refreshCaptures = async (workspaceId = activeWorkspaceId) => {
    if (isPopup) {
      return;
    }

    const nextCaptures = await api.listCaptures(workspaceId);
    setCaptures(nextCaptures);
    if (selectedCaptureId && !nextCaptures.some((capture) => capture.id === selectedCaptureId)) {
      setSelectedCaptureId(null);
    }
  };

  const refresh = async () => {
    const [state, nextWorkspaces, nextPending, nextRemoteState] = await Promise.all([
      api.getAppState(),
      api.listWorkspaces(),
      api.listPendingCaptures(),
      api.getRemoteState(),
    ]);

    setAppState(state);
    setWorkspaces(nextWorkspaces);
    setPendingCaptures(nextPending);
    setRemoteState(nextRemoteState);

    if (!isPopup) {
      const nextCaptures = await api.listCaptures(state.activeWorkspaceId);
      setCaptures(nextCaptures);
    }
  };

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
    const interval = window.setInterval(() => {
      void refresh();
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPopup]);

  useEffect(() => {
    if (isPopup || !appState?.editorTargetCaptureId) {
      return;
    }

    const captureId = appState.editorTargetCaptureId;
    void (async () => {
      await api.takeEditorTarget();
      const doc = await api.openCaptureInEditor(captureId, appState.activeWorkspaceId);
      setEditorDocument(doc);
      setSelectedCaptureId(doc.capture.id);
    })();
  }, [appState?.activeWorkspaceId, appState?.editorTargetCaptureId, isPopup]);

  useEffect(() => {
    if (isPopup || !appState?.shortcuts) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (matchesShortcut(event, appState.shortcuts.toggleMonitoring)) {
        event.preventDefault();
        void handleToggleMonitoring();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appState, isPopup]);

  const currentWorkspace = workspaces.find((workspace) =>
    workspace.isInbox ? activeWorkspaceId === null : workspace.id === activeWorkspaceId,
  );
  const currentWorkspaceLabel = currentWorkspace?.isInbox
    ? strings.workspace.inbox
    : currentWorkspace?.name ?? strings.workspace.inbox;
  const activeRemoteWorkspace = useMemo(
    () => remoteState?.workspaceSettings[activeWorkspaceId ?? "inbox"] ?? null,
    [activeWorkspaceId, remoteState],
  );
  const remoteEnabled = appState?.remote.enabled ?? false;
  const remoteConfigured = remoteState?.summary.configured ?? appState?.remote.configured ?? false;
  const remoteJobs = remoteState?.summary.pendingJobs ?? appState?.remote.pendingJobs ?? 0;
  const remoteConflicts = remoteState?.summary.conflicts ?? appState?.remote.conflicts ?? 0;
  const remoteFailureMessage =
    activeRemoteWorkspace?.lastSyncStatus === "failed"
      ? activeRemoteWorkspace.lastSyncMessage
      : activeRemoteWorkspace?.lastPublishStatus === "failed"
        ? activeRemoteWorkspace.lastPublishMessage
        : remoteState?.connections.webdav.lastTestSuccess === false
          ? remoteState.connections.webdav.lastTestMessage
          : remoteState?.connections.s3.lastTestSuccess === false
            ? remoteState.connections.s3.lastTestMessage
            : "";
  const remoteHasFailure = Boolean(
    remoteEnabled &&
      (
        activeRemoteWorkspace?.lastSyncStatus === "failed" ||
        activeRemoteWorkspace?.lastPublishStatus === "failed" ||
        remoteState?.connections.webdav.lastTestSuccess === false ||
        remoteState?.connections.s3.lastTestSuccess === false
      ),
  );
  const remoteHasConflict = Boolean(
    remoteEnabled &&
      (remoteConflicts > 0 || activeRemoteWorkspace?.lastSyncStatus === "conflict"),
  );
  const remoteIsSyncing = Boolean(
    remoteEnabled &&
      (
        remoteJobs > 0 ||
        activeRemoteWorkspace?.lastSyncStatus === "syncing" ||
        activeRemoteWorkspace?.lastPublishStatus === "publishing"
      ),
  );
  const remoteActionsDisabled = !remoteEnabled || !remoteConfigured;
  const s3ConnectionReady = Boolean(
    remoteEnabled &&
      remoteState?.connections.s3.enabled &&
      remoteState.connections.s3.bucket &&
      remoteState.connections.s3.accessKeyId &&
      remoteState.connections.s3.hasSecretAccessKey,
  );
  const workspacePublishEnabled = Boolean(activeRemoteWorkspace?.s3Enabled);
  const publishDisabledReason = !remoteEnabled
    ? strings.captures.publishCloudOff
    : !s3ConnectionReady
      ? strings.captures.publishSetupNeeded
      : !workspacePublishEnabled
        ? strings.captures.publishWorkspaceOff
        : "";
  const remoteTone = remoteHasFailure ? "error" : remoteHasConflict ? "warning" : remoteIsSyncing ? "active" : "normal";
  const remoteTooltip = !remoteEnabled
    ? strings.remote.tooltipOff
    : !remoteConfigured
      ? strings.remote.tooltipNotConfigured
      : remoteHasFailure
        ? `${strings.remote.tooltipFailed}${remoteFailureMessage ? `: ${remoteFailureMessage}` : ""}`
        : remoteHasConflict
          ? strings.remote.tooltipConflict
          : remoteIsSyncing
            ? strings.remote.tooltipSyncing
            : strings.remote.tooltipReady;

  const pushFeedback = (tone: FeedbackTone, text: string) => {
    setFeedback({
      id: Date.now(),
      tone,
      text,
    });
  };

  const handleCreateWorkspace = async () => {
    const folder = await api.pickDirectory();
    if (!folder) {
      return;
    }

    setBusy(true);
    try {
      await api.createWorkspace(baseNameFromPath(folder), folder, false);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleSelectWorkspace = async (workspaceId: string | null) => {
    setBusy(true);
    try {
      const nextState = await api.setActiveWorkspace(workspaceId);
      setAppState(nextState);
      await refreshCaptures(nextState.activeWorkspaceId);
    } finally {
      setBusy(false);
    }
  };

  const handleOpenWorkspaceMenu = async (workspace: Workspace) => {
    await api.showWorkspaceContextMenu(
      workspace.rootPath,
      workspace.isInbox ? strings.workspace.inbox : workspace.name,
      strings.workspace.openFolder,
    );
  };

  const handleToggleMonitoring = async () => {
    const nextState = await api.toggleMonitoring();
    setAppState(nextState);
  };

  const handleSavePending = async (pendingId: string, annotate: boolean) => {
    setBusy(true);
    try {
      const capture = await api.savePendingCapture(pendingId, null, annotate);
      await refresh();

      if (!isPopup && annotate) {
        const nextWorkspaceId = capture.workspaceId === "inbox" ? null : capture.workspaceId;
        const doc = await api.openCaptureInEditor(capture.id, nextWorkspaceId);
        setEditorDocument(doc);
        setSelectedCaptureId(capture.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDiscardPending = async (pendingId: string) => {
    setBusy(true);
    try {
      await api.discardPendingCapture(pendingId);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const openCapture = async (captureId: string) => {
    const doc = await api.openCaptureInEditor(captureId, activeWorkspaceId);
    setEditorDocument(doc);
    setSelectedCaptureId(captureId);
  };

  const handleReorder = async (captureId: string, direction: -1 | 1) => {
    const index = captures.findIndex((capture) => capture.id === captureId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= captures.length) {
      return;
    }

    const nextOrder = captures.map((capture) => capture.id);
    [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
    const reordered = await api.reorderCaptures(activeWorkspaceId, nextOrder);
    setCaptures(reordered);
  };

  const handleSaveShortcuts = async (shortcuts: ShortcutConfig) => {
    const saved = await api.updateShortcuts(shortcuts);
    setAppState((current) =>
      current
        ? {
            ...current,
            shortcuts: saved,
          }
        : current,
    );
  };

  const handleSavePreferences = async (preferences: PreferencesConfig) => {
    const saved = await api.updatePreferences(preferences);
    setAppState((current) =>
      current
        ? {
            ...current,
            preferences: saved,
          }
        : current,
    );
  };

  const handleSaveRemoteConnections = async (patch: Parameters<typeof api.updateRemoteConnections>[0]) => {
    await api.updateRemoteConnections(patch);
    setRemoteState(await api.getRemoteState());
    await refresh();
  };

  const handleTestRemoteConnection = async (
    provider: RemoteProvider,
    patch?: Parameters<typeof api.testRemoteConnection>[1],
  ) => {
    await api.testRemoteConnection(provider, patch);
    setRemoteState(await api.getRemoteState());
    await refresh();
  };

  const handleSaveWorkspaceRemoteSettings = async (
    workspaceId: string | null,
    patch: Parameters<typeof api.updateWorkspaceRemoteSettings>[1],
  ) => {
    await api.updateWorkspaceRemoteSettings(workspaceId, patch);
    setRemoteState(await api.getRemoteState());
    setWorkspaces(await api.listWorkspaces());
  };

  const handleRunWorkspaceSync = async (workspaceId: string | null) => {
    setRemoteState(await api.runWorkspaceSync(workspaceId));
    await refresh();
  };

  const handleRetryRemoteJobs = async () => {
    setRemoteState(await api.retryRemoteJobs());
    await refresh();
  };

  const handleResolveSyncConflict = async (
    conflictId: string,
    action: "resolved" | "useIncoming" | "keepLocal",
  ) => {
    await api.resolveSyncConflict(conflictId, action);
    setRemoteState(await api.getRemoteState());
    await refresh();
  };

  const handlePublishCapture = async (captureId: string, workspaceId: string | null) => {
    if (publishDisabledReason) {
      pushFeedback("warning", publishDisabledReason);
      return;
    }

    const previous = captures.find((capture) => capture.id === captureId);

    try {
      setBusy(true);
      const updated = await api.publishCaptureNow(captureId, workspaceId);
      if (editorDocument?.capture.id === updated.id) {
        setEditorDocument(await api.openCaptureInEditor(updated.id, workspaceId));
      }
      await refresh();

      if (updated.remote.publishStatus === "failed") {
        pushFeedback("error", updated.remote.lastError || strings.captures.publishFailed);
        return;
      }

      if (updated.remote.remoteUrl) {
        pushFeedback(
          "success",
          previous?.remote.remoteUrl ? strings.captures.republishSuccess : strings.captures.publishSuccess,
        );
        return;
      }

      pushFeedback("info", strings.captures.publishing);
    } catch (error) {
      pushFeedback("error", error instanceof Error ? error.message : strings.captures.publishFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCaptureRemoteUrl = async (captureId: string, workspaceId: string | null) => {
    try {
      await api.copyCaptureRemoteUrl(captureId, workspaceId);
      pushFeedback("success", strings.captures.copyLinkSuccess);
    } catch (error) {
      pushFeedback("error", error instanceof Error ? error.message : strings.captures.publishFailed);
    }
  };

  const handleOpenCaptureRemoteUrl = async (captureId: string, workspaceId: string | null) => {
    try {
      await api.openCaptureRemoteUrl(captureId, workspaceId);
    } catch (error) {
      pushFeedback("error", error instanceof Error ? error.message : strings.captures.publishFailed);
    }
  };

  const handleSaveTags = async (tags: QuickTag[]) => {
    const saved = await api.updateTags(tags);
    const nextWorkspaces = await api.listWorkspaces();
    setWorkspaces(nextWorkspaces);
    setAppState((current) =>
      current
        ? {
            ...current,
            tags: saved,
          }
        : current,
    );
  };

  const handleEditorSave = async (
    renderedPngBase64: string,
    annotationDocument: AnnotationDocument,
    options?: { targetWorkspaceId?: string | null; tagId?: string | null },
  ) => {
    if (!editorDocument) {
      throw new Error("No editor document is open");
    }

    const savedCapture = await api.saveCaptureEdit(
      editorDocument.capture.id,
      activeWorkspaceId,
      renderedPngBase64,
      annotationDocument,
    );
    let finalCapture = savedCapture;
    let nextWorkspaceId = activeWorkspaceId;

    const targetWorkspaceId = options?.targetWorkspaceId;
    if (targetWorkspaceId !== undefined && targetWorkspaceId !== activeWorkspaceId) {
      finalCapture = await api.moveCaptureToWorkspace(
        savedCapture.id,
        activeWorkspaceId,
        targetWorkspaceId,
      );
      nextWorkspaceId = finalCapture.workspaceId === "inbox" ? null : finalCapture.workspaceId;
      const nextState = await api.setActiveWorkspace(nextWorkspaceId);
      setAppState(nextState);
    }

    if ((options?.tagId ?? finalCapture.tagId ?? null) !== (finalCapture.tagId ?? null)) {
      finalCapture = await api.updateCaptureTag(
        finalCapture.id,
        nextWorkspaceId,
        options?.tagId ?? null,
      );
    }

    const refreshed = await api.openCaptureInEditor(finalCapture.id, nextWorkspaceId);
    setEditorDocument(refreshed);
    await refresh();
    return finalCapture;
  };

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="glass-card loading-card">
          <Sparkles size={18} />
          <p>{strings.loading}</p>
        </div>
      </main>
    );
  }

  if (isPopup) {
    return (
      <PopupShell
        appState={appState}
        onDiscard={handleDiscardPending}
        onSave={handleSavePending}
        pendingCaptures={pendingCaptures}
        workspaces={workspaces}
        strings={strings}
      />
    );
  }

  return (
    <main className="app-shell">
      <section className="app-frame glass-card">
        <header className="window-chrome">
          <div className="window-copy">
            <h1>{strings.appName}</h1>
          </div>

          <div className="command-bar">
            <button className="command-button" onClick={() => void handleToggleMonitoring()} type="button">
              {appState?.monitoringPaused ? <MonitorPlay size={15} /> : <MonitorPause size={15} />}
              {appState?.monitoringPaused ? strings.commands.start : strings.commands.pause}
            </button>
            <button
              className={showPreferences ? "command-button is-active" : "command-button"}
              onClick={() => setShowPreferences((current) => !current)}
              type="button"
            >
              <Settings2 size={15} />
              {strings.commands.settings}
            </button>
            <button className="command-button is-primary" onClick={() => void handleCreateWorkspace()} type="button">
              <FolderPlus size={15} />
              {strings.commands.newSpace}
            </button>
          </div>
        </header>

        <section className="workspace-shell">
          <Sidebar
            activeWorkspaceId={activeWorkspaceId}
            onCreateWorkspace={() => void handleCreateWorkspace()}
            onOpenWorkspaceMenu={(workspace) => void handleOpenWorkspaceMenu(workspace)}
            onSelectWorkspace={(workspaceId) => void handleSelectWorkspace(workspaceId)}
            showTags={appState?.preferences.showWorkspaceTags ?? true}
            workspaces={workspaces}
            strings={strings}
          />

          <section className="content-area">
            <header className="content-header glass-card">
              <div>
                <p className="eyebrow">
                  {currentWorkspace?.isInbox ? strings.workspace.global : strings.workspace.active}
                </p>
                <h2>{currentWorkspaceLabel}</h2>
                <p className="content-subtitle">
                  {currentWorkspace?.rootPath ?? appState?.inboxRoot ?? "Loading path…"}
                </p>
              </div>

              <div className="header-meta">
                <span className="inline-stat">
                  <strong>{appState?.pendingCount ?? 0}</strong>
                  {strings.stats.pending}
                </span>
                <span className="inline-stat">
                  <strong>{captures.length}</strong>
                  {strings.stats.saved}
                </span>
                <span className="inline-stat">
                  <strong>{appState?.monitoringPaused ? strings.stats.off : strings.stats.on}</strong>
                  {strings.stats.monitor}
                </span>
                <div className={remoteEnabled ? `cloud-status cloud-status--${remoteTone} is-open` : `cloud-status cloud-status--${remoteTone}`}>
                  <div className="cloud-status__shell">
                    <div className="cloud-status__expanded">
                      <button
                        className="cloud-status__action"
                        disabled={remoteActionsDisabled}
                        onClick={() => void handleRunWorkspaceSync(activeWorkspaceId)}
                        title={
                          !remoteEnabled
                            ? strings.remote.tooltipOff
                            : remoteActionsDisabled
                              ? strings.remote.tooltipNotConfigured
                              : strings.commands.sync
                        }
                        type="button"
                      >
                        <RefreshCcw size={12} />
                        {strings.commands.sync}
                      </button>
                      <span className={remoteActionsDisabled ? "cloud-status__mini is-muted" : "cloud-status__mini"}>
                        <strong>{remoteJobs}</strong>
                        {strings.remote.jobs}
                      </span>
                      <span className={remoteActionsDisabled ? "cloud-status__mini is-muted" : "cloud-status__mini"}>
                        <strong>{remoteConflicts}</strong>
                        {strings.remote.conflicts}
                      </span>
                    </div>
                    <button
                      aria-label={remoteTooltip}
                      aria-expanded={remoteEnabled}
                      className="cloud-status__trigger"
                      onClick={() => void handleSaveRemoteConnections({ enabled: !remoteEnabled })}
                      type="button"
                    >
                      <span className="inline-stat__icon">
                        <Cloud size={14} />
                        {remoteEnabled && (!remoteConfigured || remoteHasConflict || remoteHasFailure) ? (
                          <AlertTriangle
                            className={
                              remoteHasFailure ? "inline-stat__warning inline-stat__warning--error" : "inline-stat__warning"
                            }
                            size={11}
                          />
                        ) : null}
                      </span>
                      <span className="inline-stat__copy cloud-status__copy">
                        <strong>{remoteEnabled ? strings.settings.yes : strings.settings.no}</strong>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </header>

            <div className="content-grid">
              <CaptureGrid
                captures={captures}
                onOpenCapture={openCapture}
                onCopyRemoteUrl={handleCopyCaptureRemoteUrl}
                onOpenRemoteUrl={handleOpenCaptureRemoteUrl}
                onPublishCapture={handlePublishCapture}
                onReorder={handleReorder}
                publishDisabledReason={publishDisabledReason}
                publishEnabled={!publishDisabledReason}
                selectedCaptureId={selectedCaptureId}
                showTags={appState?.preferences.showWorkspaceTags ?? true}
                strings={strings}
                tags={currentWorkspace?.tags ?? []}
              />

              <aside className="utility-rail">
                <PendingPanel
                  activeWorkspaceId={activeWorkspaceId}
                  onDiscard={handleDiscardPending}
                  onSave={handleSavePending}
                  tags={appState?.tags ?? []}
                  pendingCaptures={pendingCaptures}
                  workspaces={workspaces}
                  strings={strings}
                />
              </aside>
            </div>
          </section>
        </section>

        <div className="status-stack">
          {feedback ? <div className={`feedback-toast is-${feedback.tone}`}>{feedback.text}</div> : null}
          {busy ? <div className="busy-indicator">{strings.syncing}</div> : null}
        </div>
      </section>

      {showPreferences && appState ? (
        <div className="preferences-overlay">
          <div className="preferences-sheet">
            <div className="preferences-sheet__header">
              <div>
                <p className="eyebrow">{strings.settings.eyebrow}</p>
                <h3>{strings.settings.title}</h3>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowPreferences(false)}
                title={strings.settings.close}
                type="button"
              >
                <X size={15} />
              </button>
            </div>
            <div className="preferences-layout">
              <PreferencesPanel
                activeWorkspaceId={activeWorkspaceId}
                onChange={handleSavePreferences}
                onResolveSyncConflict={handleResolveSyncConflict}
                onRetryRemoteJobs={handleRetryRemoteJobs}
                onRunWorkspaceSync={handleRunWorkspaceSync}
                onSaveShortcuts={handleSaveShortcuts}
                onSaveRemoteConnections={handleSaveRemoteConnections}
                onSaveTags={handleSaveTags}
                onSaveWorkspaceRemoteSettings={handleSaveWorkspaceRemoteSettings}
                onTestRemoteConnection={handleTestRemoteConnection}
                preferences={appState.preferences}
                remoteState={remoteState ?? {
                  connections: {
                    enabled: false,
                    webdav: {
                      enabled: false,
                      baseUrl: "",
                      username: "",
                      rootPath: "/TuClip",
                      hasPassword: false,
                      lastTestedAt: null,
                      lastTestSuccess: null,
                      lastTestMessage: "",
                    },
                    s3: {
                      enabled: false,
                      endpoint: "",
                      region: "auto",
                      bucket: "",
                      accessKeyId: "",
                      publicBaseUrl: "",
                      forcePathStyle: true,
                      hasSecretAccessKey: false,
                      lastTestedAt: null,
                      lastTestSuccess: null,
                      lastTestMessage: "",
                    },
                  },
                  workspaceSettings: {},
                  jobs: [],
                  conflicts: [],
                  summary: {
                    enabled: false,
                    configured: false,
                    pendingJobs: 0,
                    conflicts: 0,
                    activeWorkspaceStatus: "idle",
                  },
                }}
                shortcuts={appState.shortcuts}
                strings={strings}
                tags={appState.tags}
                workspaces={workspaces}
              />
            </div>
          </div>
        </div>
      ) : null}

      {editorDocument && appState ? (
        <CaptureEditor
          activeWorkspaceId={activeWorkspaceId}
          document={editorDocument}
          onClose={() => setEditorDocument(null)}
          onCopyRemoteUrl={handleCopyCaptureRemoteUrl}
          onOpenRemoteUrl={handleOpenCaptureRemoteUrl}
          onPublishCapture={handlePublishCapture}
          onSave={handleEditorSave}
          onSyncWorkspace={handleRunWorkspaceSync}
          preferences={appState.preferences}
          shortcuts={appState.shortcuts}
          tags={appState.tags}
          workspaces={workspaces}
        />
      ) : null}
    </main>
  );
}

export default App;
