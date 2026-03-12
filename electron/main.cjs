const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
  screen,
  shell,
} = require("electron");

const {
  APP_NAME,
  INBOX_ID,
  SYSTEM_DIR,
  copyFile,
  deleteCapture,
  ensureWorkspaceLayout,
  getAnnotationDocument,
  getCapture,
  insertVersion,
  listCaptures,
  listVersions,
  listWorkspaces,
  loadConfig,
  normalizeCaptureTag,
  nextOrderIndex,
  nextPublicFilename,
  refreshTagCache,
  removeDirIfExists,
  removeFileIfExists,
  replaceAnnotationDocument,
  reorderCaptures,
  resolveWorkspace,
  saveConfig,
  upsertCapture,
  writeAggregatedTags,
} = require("./storage.cjs");
const { createRemoteServices } = require("./remote.cjs");

let liquidGlass = null;
try {
  if (process.platform === "darwin") {
    liquidGlass = require("electron-liquid-glass");
  }
} catch (error) {
  console.warn("Liquid glass is unavailable, falling back to Electron vibrancy.", error);
}

const supportsNativeGlass =
  process.platform === "darwin" && Boolean(liquidGlass?.isGlassSupported?.());

const runtime = {
  config: null,
  lastClipboardHash: null,
  popupGeneration: 0,
  popupHideTimeout: null,
  tray: null,
  clipboardInterval: null,
  syncInterval: null,
  isQuitting: false,
  remote: null,
  windows: {
    main: null,
    popup: null,
  },
};

function shouldCloseToTray() {
  return (runtime.config?.preferences?.closeAction ?? "tray") === "tray";
}

function nowIso() {
  return new Date().toISOString();
}

function resolveTuClipIconPath() {
  const candidates = [
    path.join(__dirname, "..", "public", "icons", "tuclip-icon.png"),
    path.join(__dirname, "..", "public", "tuclipicon.png"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function createTuClipIcon(size) {
  const iconPath = resolveTuClipIconPath();
  if (iconPath) {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      return icon.resize({ width: size, height: size });
    }
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f6f8fb" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#9fc2ff" stop-opacity="0.95" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="18" fill="#151922" />
      <rect x="8" y="8" width="48" height="48" rx="14" fill="rgba(255,255,255,0.06)" />
      <path d="M21 42V22h6.5l13 15.5V22H44v20h-6.2L24.5 26.2V42H21Z" fill="url(#g)" />
    </svg>
  `.trim();

  return nativeImage
    .createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`)
    .resize({ width: size, height: size });
}

function buildWindowBaseOptions() {
  const isMac = process.platform === "darwin";
  const isWindows = process.platform === "win32";
  return {
    backgroundColor: "#00000000",
    transparent: true,
    vibrancy: isMac && !supportsNativeGlass ? "under-window" : undefined,
    visualEffectState: isMac && !supportsNativeGlass ? "active" : undefined,
    backgroundMaterial: isWindows ? "acrylic" : undefined,
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    titleBarOverlay: isMac
      ? false
      : {
          color: "#00000000",
          symbolColor: "#dbe4f0",
          height: 50,
        },
    trafficLightPosition: isMac ? { x: 18, y: 20 } : undefined,
    roundedCorners: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  };
}

function applyNativeGlass(win, mode) {
  if (!supportsNativeGlass || !liquidGlass || !win || win.isDestroyed()) {
    return;
  }

  try {
    const glassId = liquidGlass.addView(win.getNativeWindowHandle(), {
      cornerRadius: mode === "popup" ? 28 : 34,
      tintColor: mode === "popup" ? "#FFF8F01A" : "#F5F0E414",
      opaque: false,
    });

    if (glassId < 0) {
      return;
    }

    if (mode === "popup") {
      liquidGlass.unstable_setVariant(
        glassId,
        liquidGlass.GlassMaterialVariant.cartouchePopover,
      );
    } else {
      liquidGlass.unstable_setVariant(glassId, liquidGlass.GlassMaterialVariant.dock);
      liquidGlass.unstable_setScrim(glassId, 0);
    }
  } catch (error) {
    console.warn("Failed to apply native liquid glass.", error);
  }
}

function loadWindow(window, popup = false) {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    const suffix = popup ? "?popup=1" : "";
    return window.loadURL(`${devUrl}${suffix}`);
  }

  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  return window.loadFile(indexPath, popup ? { query: { popup: "1" } } : undefined);
}

function showMainWindow() {
  const window = runtime.windows.main;
  if (!window) {
    return;
  }
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
}

function hidePopupWindow() {
  if (runtime.popupHideTimeout) {
    clearTimeout(runtime.popupHideTimeout);
    runtime.popupHideTimeout = null;
  }
  runtime.windows.popup?.hide();
}

function popupDurationMs() {
  const seconds = Number(runtime.config?.preferences?.popupDurationSeconds ?? 6);
  return Math.max(3, seconds) * 1000;
}

function refreshPopupExpiry() {
  const current = runtime.config?.pendingCaptures?.[0];
  if (!current) {
    return null;
  }
  current.expiresAt = new Date(Date.now() + popupDurationMs()).toISOString();
  saveConfig(app, runtime.config);
  return current;
}

function schedulePopupHide() {
  if (runtime.popupHideTimeout) {
    clearTimeout(runtime.popupHideTimeout);
  }
  runtime.popupGeneration += 1;
  const generation = runtime.popupGeneration;
  runtime.popupHideTimeout = setTimeout(() => {
    if (runtime.popupGeneration === generation) {
      hidePopupWindow();
    }
  }, popupDurationMs());
}

function showPopupWindow() {
  const popup = runtime.windows.popup;
  if (!popup) {
    return;
  }

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width } = display.workArea;
  popup.setBounds({
    x: x + width - 356,
    y: y + 18,
    width: 332,
    height: 304,
  });
  popup.showInactive();
  refreshPopupExpiry();
  schedulePopupHide();
}

function createMainWindow() {
  const win = new BrowserWindow({
    ...buildWindowBaseOptions(),
    title: APP_NAME,
    width: 920,
    height: 560,
    show: false,
    icon: createTuClipIcon(128),
    fullscreenable: false,
    resizable: false,
    movable: true,
  });

  loadWindow(win, false);
  win.setMenuBarVisibility(false);
  if (process.platform === "darwin") {
    win.setWindowButtonVisibility(true);
  }
  win.webContents.once("did-finish-load", () => applyNativeGlass(win, "main"));
  win.once("ready-to-show", () => win.show());
  win.on("close", (event) => {
    if (!runtime.isQuitting) {
      if (shouldCloseToTray()) {
        event.preventDefault();
        win.hide();
        return;
      }
      event.preventDefault();
      runtime.isQuitting = true;
      app.quit();
    }
  });
  runtime.windows.main = win;
}

function createPopupWindow() {
  const win = new BrowserWindow({
    ...buildWindowBaseOptions(),
    title: `${APP_NAME} Quick Save`,
    width: 332,
    height: 304,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
  });
  loadWindow(win, true);
  win.webContents.once("did-finish-load", () => applyNativeGlass(win, "popup"));
  win.on("close", (event) => {
    if (!runtime.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  runtime.windows.popup = win;
}

function createTray() {
  const tray = new Tray(createTuClipIcon(18));
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Open ${APP_NAME}`, click: () => showMainWindow() },
      {
        label: "Open Inbox",
        click: () => {
          runtime.config.activeWorkspaceId = null;
          saveConfig(app, runtime.config);
          showMainWindow();
        },
      },
      {
        label: "Pause / Resume Monitoring",
        click: () => {
          setMonitoringPaused(!runtime.config.monitoringPaused);
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          runtime.isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => showMainWindow());
  runtime.tray = tray;
}

function buildAppState() {
  const remoteSummary = runtime.remote?.getRemoteState(runtime.config.activeWorkspaceId ?? null)?.summary ?? {
    enabled: false,
    configured: false,
    pendingJobs: 0,
    conflicts: 0,
    activeWorkspaceStatus: "idle",
  };
  return {
    monitoringPaused: runtime.config.monitoringPaused,
    activeWorkspaceId: runtime.config.activeWorkspaceId,
    shortcuts: runtime.config.shortcuts,
    preferences: runtime.config.preferences,
    pendingCount: runtime.config.pendingCaptures.length,
    editorTargetCaptureId: runtime.config.editorTargetCaptureId,
    inboxRoot: resolveWorkspace(app, runtime.config, INBOX_ID).rootPath,
    tags: runtime.config.tags,
    remote: remoteSummary,
  };
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function primeClipboardBaseline() {
  const image = clipboard.readImage();
  if (image.isEmpty()) {
    runtime.lastClipboardHash = null;
    return null;
  }
  const pngBuffer = image.toPNG();
  runtime.lastClipboardHash = pngBuffer.length ? hashBuffer(pngBuffer) : null;
  return runtime.lastClipboardHash;
}

function setMonitoringPaused(nextPaused) {
  const paused =
    typeof nextPaused === "boolean" ? nextPaused : !runtime.config.monitoringPaused;

  if (runtime.config.monitoringPaused && !paused) {
    primeClipboardBaseline();
  }

  runtime.config.monitoringPaused = paused;
  saveConfig(app, runtime.config);
  return buildAppState();
}

function stagePendingCapture(pngBuffer, sourceHash) {
  const workspace = resolveWorkspace(app, runtime.config, null);
  const defaultTag =
    runtime.config.tags.find((tag) => (tag.workspaceId ?? null) === (workspace.id === INBOX_ID ? null : workspace.id)) ??
    null;
  const pendingId = crypto.randomUUID();
  const pendingPath = path.join(
    workspace.rootPath,
    SYSTEM_DIR,
    "pending",
    `${pendingId}.png`,
  );
  fs.writeFileSync(pendingPath, pngBuffer);

  runtime.config.pendingCaptures.unshift({
    id: pendingId,
    tempPath: pendingPath,
    detectedAt: nowIso(),
    expiresAt: new Date(Date.now() + popupDurationMs()).toISOString(),
    sourceHash,
    workspaceHintId: workspace.id === INBOX_ID ? null : workspace.id,
    selectedTagId: defaultTag?.id ?? null,
    note: "",
  });
  saveConfig(app, runtime.config);
}

function selectPendingTag(pendingId, tagId) {
  const pending = runtime.config.pendingCaptures.find((item) => item.id === pendingId);
  if (!pending) {
    throw new Error(`Pending capture ${pendingId} not found`);
  }

  const tag = tagId ? runtime.config.tags.find((item) => item.id === tagId) : null;
  pending.selectedTagId = tag?.id ?? null;
  pending.workspaceHintId = tag ? (tag.workspaceId ?? null) : runtime.config.activeWorkspaceId ?? null;
  saveConfig(app, runtime.config);
  return pending;
}

function updatePendingNote(pendingId, note) {
  const pending = runtime.config.pendingCaptures.find((item) => item.id === pendingId);
  if (!pending) {
    throw new Error(`Pending capture ${pendingId} not found`);
  }
  pending.note = String(note || "").trim();
  saveConfig(app, runtime.config);
  return pending;
}

function startClipboardPolling() {
  runtime.clipboardInterval = setInterval(() => {
    if (runtime.config.monitoringPaused) {
      return;
    }
    const image = clipboard.readImage();
    if (image.isEmpty()) {
      runtime.lastClipboardHash = null;
      return;
    }
    const pngBuffer = image.toPNG();
    if (!pngBuffer.length) {
      runtime.lastClipboardHash = null;
      return;
    }
    const sourceHash = hashBuffer(pngBuffer);
    const duplicatePending = runtime.config.pendingCaptures.some(
      (pending) => pending.sourceHash === sourceHash,
    );
    if (duplicatePending || runtime.lastClipboardHash === sourceHash) {
      return;
    }

    runtime.lastClipboardHash = sourceHash;
    stagePendingCapture(pngBuffer, sourceHash);
    showPopupWindow();
  }, 400);
}

function removePendingCapture(pendingId) {
  const index = runtime.config.pendingCaptures.findIndex((pending) => pending.id === pendingId);
  if (index < 0) {
    throw new Error(`Pending capture ${pendingId} not found`);
  }
  const [pending] = runtime.config.pendingCaptures.splice(index, 1);
  saveConfig(app, runtime.config);
  return pending;
}

function savePendingCapture(pendingId, targetWorkspaceId, openEditor) {
  const currentPending = runtime.config.pendingCaptures.find((item) => item.id === pendingId);
  const effectiveWorkspaceId =
    targetWorkspaceId ?? currentPending?.workspaceHintId ?? runtime.config.activeWorkspaceId ?? null;
  const pending = removePendingCapture(pendingId);
  const workspace = resolveWorkspace(app, runtime.config, effectiveWorkspaceId);
  ensureWorkspaceLayout(workspace.rootPath);

  const captureId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const publicName = nextPublicFilename(workspace.rootPath, workspace.appendTimestamp);
  const publicPath = path.join(workspace.rootPath, publicName);
  const originalPath = path.join(
    workspace.rootPath,
    SYSTEM_DIR,
    "originals",
    captureId,
    "original.png",
  );

  copyFile(pending.tempPath, originalPath);
  copyFile(pending.tempPath, publicPath);
  removeFileIfExists(pending.tempPath);

  const capture = {
    id: captureId,
    workspaceId: workspace.id,
    status: "saved",
    publicPath,
    orderIndex: nextOrderIndex(workspace.rootPath),
    createdAt: nowIso(),
    currentVersionId: versionId,
    sourceHash: pending.sourceHash,
    tagId: normalizeCaptureTag(runtime.config, workspace.id, pending.selectedTagId),
    note: pending.note || "",
  };
  const version = {
    id: versionId,
    captureId,
    kind: "original",
    archivedPath: originalPath,
    annotationPath: null,
    createdAt: nowIso(),
  };

  upsertCapture(workspace.rootPath, capture);
  insertVersion(workspace.rootPath, version);
  runtime.remote?.queueWorkspaceSync(workspace.id === INBOX_ID ? null : workspace.id);
  runtime.remote?.queueCapturePublish(capture.id, workspace.id === INBOX_ID ? null : workspace.id);

  if (openEditor) {
    runtime.config.editorTargetCaptureId = capture.id;
    saveConfig(app, runtime.config);
    showMainWindow();
  }
  hidePopupWindow();
  return capture;
}

function saveCaptureEdit(captureId, workspaceId, renderedPngBase64, annotationDocument) {
  const workspace = resolveWorkspace(app, runtime.config, workspaceId);
  const capture = getCapture(workspace.rootPath, captureId);
  const versionId = crypto.randomUUID();
  const archivedPath = path.join(
    workspace.rootPath,
    SYSTEM_DIR,
    "versions",
    capture.id,
    `${versionId}.png`,
  );
  const base64Payload = renderedPngBase64.includes(",")
    ? renderedPngBase64.split(",")[1]
    : renderedPngBase64;
  const buffer = Buffer.from(base64Payload, "base64");

  copyFile(capture.publicPath, archivedPath);
  fs.writeFileSync(capture.publicPath, buffer);
  const annotationPath = replaceAnnotationDocument(
    workspace.rootPath,
    versionId,
    capture.id,
    annotationDocument,
  );

  insertVersion(workspace.rootPath, {
    id: versionId,
    captureId: capture.id,
    kind: "edited",
    archivedPath,
    annotationPath,
    createdAt: nowIso(),
  });

  const updated = {
    ...capture,
    status: "edited",
    currentVersionId: versionId,
  };
  upsertCapture(workspace.rootPath, updated);
  runtime.remote?.queueWorkspaceSync(workspace.id === INBOX_ID ? null : workspace.id);
  runtime.remote?.queueCapturePublish(updated.id, workspace.id === INBOX_ID ? null : workspace.id);
  return updated;
}

function updateCaptureNote(captureId, workspaceId, note) {
  const workspace = resolveWorkspace(app, runtime.config, workspaceId);
  const capture = getCapture(workspace.rootPath, captureId);
  const updated = {
    ...capture,
    note: String(note || "").trim(),
  };
  upsertCapture(workspace.rootPath, updated);
  runtime.remote?.queueWorkspaceSync(workspace.id === INBOX_ID ? null : workspace.id);
  return updated;
}

function updateCaptureTag(captureId, workspaceId, tagId) {
  const workspace = resolveWorkspace(app, runtime.config, workspaceId);
  const capture = getCapture(workspace.rootPath, captureId);
  const updated = {
    ...capture,
    tagId: normalizeCaptureTag(runtime.config, workspace.id, tagId),
  };
  upsertCapture(workspace.rootPath, updated);
  runtime.remote?.queueWorkspaceSync(workspace.id === INBOX_ID ? null : workspace.id);
  return updated;
}

function copyCaptureAssets(sourceRoot, targetRoot, captureId, versions) {
  return versions.map((version) => {
    const archivedPath =
      version.kind === "original"
        ? path.join(targetRoot, SYSTEM_DIR, "originals", captureId, "original.png")
        : path.join(targetRoot, SYSTEM_DIR, "versions", captureId, `${version.id}.png`);
    copyFile(version.archivedPath, archivedPath);

    let annotationPath = null;
    if (version.annotationPath) {
      annotationPath = path.join(
        targetRoot,
        SYSTEM_DIR,
        "annotations",
        captureId,
        path.basename(version.annotationPath),
      );
      copyFile(version.annotationPath, annotationPath);
    }

    return {
      ...version,
      archivedPath,
      annotationPath,
    };
  });
}

function moveCaptureToWorkspace(captureId, sourceWorkspaceId, targetWorkspaceId) {
  const source = resolveWorkspace(app, runtime.config, sourceWorkspaceId);
  const target = resolveWorkspace(app, runtime.config, targetWorkspaceId);
  if (source.id === target.id) {
    return getCapture(source.rootPath, captureId);
  }

  const capture = getCapture(source.rootPath, captureId);
  const versions = listVersions(source.rootPath, captureId);
  const publicName = nextPublicFilename(target.rootPath, target.appendTimestamp);
  const publicPath = path.join(target.rootPath, publicName);

  copyFile(capture.publicPath, publicPath);
  const copiedVersions = copyCaptureAssets(source.rootPath, target.rootPath, capture.id, versions);

  const moved = {
    ...capture,
    workspaceId: target.id,
    publicPath,
    orderIndex: nextOrderIndex(target.rootPath),
    tagId: normalizeCaptureTag(runtime.config, target.id, capture.tagId),
  };
  upsertCapture(target.rootPath, moved);
  copiedVersions.forEach((version) => insertVersion(target.rootPath, version));

  deleteCapture(source.rootPath, captureId);
  removeFileIfExists(capture.publicPath);
  removeDirIfExists(path.join(source.rootPath, SYSTEM_DIR, "originals", capture.id));
  removeDirIfExists(path.join(source.rootPath, SYSTEM_DIR, "versions", capture.id));
  removeDirIfExists(path.join(source.rootPath, SYSTEM_DIR, "annotations", capture.id));
  runtime.remote?.queueWorkspaceSync(source.id === INBOX_ID ? null : source.id);
  runtime.remote?.queueWorkspaceSync(target.id === INBOX_ID ? null : target.id);
  runtime.remote?.queueCapturePublish(moved.id, target.id === INBOX_ID ? null : target.id);
  return moved;
}

function registerIpc() {
  ipcMain.handle("tuclip:getAppState", () => buildAppState());
  ipcMain.handle("tuclip:listWorkspaces", () => listWorkspaces(app, runtime.config));
  ipcMain.handle("tuclip:pickDirectory", async () => {
    const result = await dialog.showOpenDialog(runtime.windows.main, {
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("tuclip:createWorkspace", (_event, name, rootPath, appendTimestamp) => {
    ensureWorkspaceLayout(rootPath);
    const workspace = {
      id: crypto.randomUUID(),
      name,
      rootPath,
      appendTimestamp: Boolean(appendTimestamp),
      monitoringPaused: runtime.config.monitoringPaused,
      createdAt: nowIso(),
      isInbox: false,
      tags: [],
    };
    runtime.config.workspaces.push(workspace);
    runtime.config.activeWorkspaceId = workspace.id;
    saveConfig(app, runtime.config);
    return listWorkspaces(app, runtime.config).find((item) => item.id === workspace.id);
  });
  ipcMain.handle(
    "tuclip:showWorkspaceContextMenu",
    (event, rootPath, workspaceLabel, openFolderLabel) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const menu = Menu.buildFromTemplate([
        {
          label: openFolderLabel || `Open ${workspaceLabel || "Folder"}`,
          click: () => {
            void shell.openPath(rootPath);
          },
        },
      ]);
      menu.popup({ window: win ?? undefined });
      return true;
    },
  );
  ipcMain.handle("tuclip:setActiveWorkspace", (_event, workspaceId) => {
    runtime.config.activeWorkspaceId = workspaceId === INBOX_ID ? null : workspaceId;
    saveConfig(app, runtime.config);
    return buildAppState();
  });
  ipcMain.handle("tuclip:updateShortcuts", (_event, shortcuts) => {
    runtime.config.shortcuts = { ...runtime.config.shortcuts, ...shortcuts };
    saveConfig(app, runtime.config);
    return runtime.config.shortcuts;
  });
  ipcMain.handle("tuclip:updatePreferences", (_event, preferences) => {
    const nextCloseAction =
      preferences?.closeAction === "quit" ? "quit" : "tray";
    runtime.config.preferences = {
      ...runtime.config.preferences,
      ...preferences,
      popupDurationSeconds: Math.max(
        3,
        Math.min(12, Math.round(Number(preferences?.popupDurationSeconds ?? runtime.config.preferences.popupDurationSeconds))),
      ),
      closeAction: nextCloseAction,
    };
    saveConfig(app, runtime.config);
    return runtime.config.preferences;
  });
  ipcMain.handle("tuclip:updateTags", (_event, tags) => {
    const nextTags = (tags || []).map((tag) => ({
      id: tag.id || crypto.randomUUID(),
      label: String(tag.label || "").trim() || "Tag",
      color: tag.color || "#0f6cbd",
      workspaceId: tag.workspaceId ?? null,
      visible: tag.visible !== false,
    }));
    writeAggregatedTags(app, runtime.config, nextTags);
    runtime.config.tags = refreshTagCache(app, runtime.config);
    saveConfig(app, runtime.config);
    const workspaceIds = new Set([null, ...runtime.config.workspaces.map((workspace) => workspace.id)]);
    workspaceIds.forEach((workspaceId) => runtime.remote?.queueWorkspaceSync(workspaceId));
    return runtime.config.tags;
  });
  ipcMain.handle("tuclip:toggleMonitoring", (_event, paused) => {
    return setMonitoringPaused(paused);
  });
  ipcMain.handle("tuclip:listPendingCaptures", () => runtime.config.pendingCaptures);
  ipcMain.handle("tuclip:selectPendingTag", (_event, pendingId, tagId) =>
    selectPendingTag(pendingId, tagId),
  );
  ipcMain.handle("tuclip:updatePendingNote", (_event, pendingId, note) =>
    updatePendingNote(pendingId, note),
  );
  ipcMain.handle("tuclip:extendPopupCountdown", () => {
    const pending = refreshPopupExpiry();
    if (pending) {
      schedulePopupHide();
    }
    return pending;
  });
  ipcMain.handle("tuclip:savePendingCapture", (_event, pendingId, targetWorkspaceId, openEditor) =>
    savePendingCapture(pendingId, targetWorkspaceId, openEditor),
  );
  ipcMain.handle("tuclip:discardPendingCapture", (_event, pendingId) => {
    const pending = removePendingCapture(pendingId);
    removeFileIfExists(pending.tempPath);
    hidePopupWindow();
  });
  ipcMain.handle("tuclip:listCaptures", (_event, workspaceId) => {
    const workspace = resolveWorkspace(app, runtime.config, workspaceId);
    return listCaptures(workspace.rootPath);
  });
  ipcMain.handle("tuclip:getRemoteState", () =>
    runtime.remote.getRemoteState(runtime.config.activeWorkspaceId ?? null),
  );
  ipcMain.handle("tuclip:updateRemoteConnections", (_event, patch) =>
    runtime.remote.updateRemoteConnections(patch),
  );
  ipcMain.handle("tuclip:testRemoteConnection", (_event, provider, patch) =>
    runtime.remote.testRemoteConnection(provider, patch),
  );
  ipcMain.handle("tuclip:updateWorkspaceRemoteSettings", (_event, workspaceId, patch) =>
    runtime.remote.updateWorkspaceRemoteBinding(workspaceId, patch),
  );
  ipcMain.handle("tuclip:runWorkspaceSync", (_event, workspaceId) =>
    runtime.remote.runWorkspaceSync(workspaceId),
  );
  ipcMain.handle("tuclip:retryRemoteJobs", () => runtime.remote.retryRemoteJobs());
  ipcMain.handle("tuclip:publishCaptureNow", (_event, captureId, workspaceId) =>
    runtime.remote.publishCaptureNow(captureId, workspaceId),
  );
  ipcMain.handle("tuclip:copyCaptureRemoteUrl", (_event, captureId, workspaceId) =>
    runtime.remote.copyCaptureRemoteUrl(captureId, workspaceId),
  );
  ipcMain.handle("tuclip:openCaptureRemoteUrl", (_event, captureId, workspaceId) =>
    runtime.remote.openCaptureRemoteUrl(captureId, workspaceId),
  );
  ipcMain.handle("tuclip:resolveSyncConflict", (_event, conflictId, action) =>
    runtime.remote.resolveSyncConflict(conflictId, action),
  );
  ipcMain.handle("tuclip:openCaptureInEditor", (_event, captureId, workspaceId) => {
    const workspace = resolveWorkspace(app, runtime.config, workspaceId);
    const capture = getCapture(workspace.rootPath, captureId);
    return {
      capture,
      versions: listVersions(workspace.rootPath, captureId),
      annotationDocument: getAnnotationDocument(workspace.rootPath, capture),
    };
  });
  ipcMain.handle("tuclip:updateCaptureNote", (_event, captureId, workspaceId, note) =>
    updateCaptureNote(captureId, workspaceId, note),
  );
  ipcMain.handle("tuclip:updateCaptureTag", (_event, captureId, workspaceId, tagId) =>
    updateCaptureTag(captureId, workspaceId, tagId),
  );
  ipcMain.handle(
    "tuclip:saveCaptureEdit",
    (_event, captureId, workspaceId, renderedPngBase64, annotationDocument) =>
      saveCaptureEdit(captureId, workspaceId, renderedPngBase64, annotationDocument),
  );
  ipcMain.handle("tuclip:reorderCaptures", (_event, workspaceId, captureIds) => {
    const workspace = resolveWorkspace(app, runtime.config, workspaceId);
    const reordered = reorderCaptures(workspace.rootPath, captureIds);
    runtime.remote?.queueWorkspaceSync(workspace.id === INBOX_ID ? null : workspace.id);
    return reordered;
  });
  ipcMain.handle(
    "tuclip:moveCaptureToWorkspace",
    (_event, captureId, sourceWorkspaceId, targetWorkspaceId) =>
      moveCaptureToWorkspace(captureId, sourceWorkspaceId, targetWorkspaceId),
  );
  ipcMain.handle("tuclip:takeEditorTarget", () => {
    const current = runtime.config.editorTargetCaptureId;
    runtime.config.editorTargetCaptureId = null;
    saveConfig(app, runtime.config);
    return current;
  });
  ipcMain.handle("tuclip:showMainWindow", () => showMainWindow());
  ipcMain.handle("tuclip:hideCurrentWindow", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.hide();
  });
}

app.whenReady().then(() => {
  runtime.config = loadConfig(app);
  runtime.remote = createRemoteServices({ app, runtime });
  createMainWindow();
  createPopupWindow();
  createTray();
  registerIpc();
  startClipboardPolling();
  runtime.remote.scheduleEnabledWorkspaceSync();
  runtime.syncInterval = setInterval(() => {
    runtime.remote?.scheduleEnabledWorkspaceSync();
  }, 120000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createPopupWindow();
    } else {
      showMainWindow();
    }
  });
});

app.on("before-quit", () => {
  runtime.isQuitting = true;
  if (runtime.clipboardInterval) {
    clearInterval(runtime.clipboardInterval);
  }
  if (runtime.syncInterval) {
    clearInterval(runtime.syncInterval);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
