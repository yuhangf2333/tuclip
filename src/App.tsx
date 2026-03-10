import { useEffect, useMemo, useState } from "react";
import {
  FolderPlus,
  MonitorPause,
  MonitorPlay,
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
  ShortcutConfig,
  Workspace,
} from "./types/app";

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
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
  const [editorDocument, setEditorDocument] = useState<EditorDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
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
      appState?.preferences?.language ?? "en",
      platform,
    );
  }, [appState?.preferences?.accentTheme, appState?.preferences?.language, platform, resolvedTheme]);

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
    const [state, nextWorkspaces, nextPending] = await Promise.all([
      api.getAppState(),
      api.listWorkspaces(),
      api.listPendingCaptures(),
    ]);

    setAppState(state);
    setWorkspaces(nextWorkspaces);
    setPendingCaptures(nextPending);

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
              </div>
            </header>

            <div className="content-grid">
              <CaptureGrid
                captures={captures}
                onOpenCapture={openCapture}
                onReorder={handleReorder}
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

        {busy ? <div className="busy-indicator">{strings.syncing}</div> : null}
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
                onChange={handleSavePreferences}
                onSaveShortcuts={handleSaveShortcuts}
                onSaveTags={handleSaveTags}
                preferences={appState.preferences}
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
          onSave={handleEditorSave}
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
