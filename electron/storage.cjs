const fs = require("fs");
const path = require("path");

const INBOX_ID = "inbox";
const APP_NAME = "GleanDex";
const SYSTEM_DIR = ".gleandex";
const LEGACY_SYSTEM_DIR = ".noteshot";

const DEFAULT_SHORTCUTS = {
  rectTool: "R",
  numberTool: "N",
  textTool: "T",
  cropTool: "C",
  save: "Mod+S",
  cancel: "Escape",
  deleteSelection: "Delete",
  undo: "Mod+Z",
  redo: "Mod+Shift+Z",
  quickSavePending: "Enter",
  quickAnnotatePending: "Mod+Enter",
  dismissPopup: "Escape",
  toggleMonitoring: "Mod+Shift+M",
};

const DEFAULT_PREFERENCES = {
  language: "en",
  themeMode: "system",
  accentTheme: "blue",
  popupDurationSeconds: 6,
  extendPopupOnInteraction: true,
  showWorkspaceTags: true,
  detectionPreset: "balanced",
  autoDetectLabels: true,
  autoNumberDetections: true,
  closeAction: "tray",
};

function normalizeCaptureTag(config, workspaceId, tagId) {
  if (!tagId) {
    return null;
  }
  const workspaceKey = workspaceId === INBOX_ID ? null : workspaceId ?? null;
  const tag = (config.tags || []).find((item) => item.id === tagId);
  if (!tag) {
    return null;
  }
  return (tag.workspaceId ?? null) === workspaceKey ? tag.id : null;
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDirSync(target) {
  fs.mkdirSync(target, { recursive: true });
}

function appSupportDir(app) {
  const dir = path.join(app.getPath("userData"), "state");
  ensureDirSync(dir);
  return dir;
}

function configPath(app) {
  return path.join(appSupportDir(app), "config.json");
}

function inboxRoot(app) {
  const root = path.join(app.getPath("pictures"), APP_NAME, "Inbox");
  ensureWorkspaceLayout(root);
  return root;
}

function workspaceMetaPath(root) {
  return path.join(workspaceSystemDir(root), "workspace.json");
}

function legacyWorkspaceSystemDir(root) {
  return path.join(root, LEGACY_SYSTEM_DIR);
}

function workspaceSystemDir(root) {
  const current = path.join(root, SYSTEM_DIR);
  const legacy = legacyWorkspaceSystemDir(root);
  if (!fs.existsSync(current) && fs.existsSync(legacy)) {
    fs.renameSync(legacy, current);
  }
  return current;
}

function ensureWorkspaceLayout(root) {
  ensureDirSync(root);
  ensureDirSync(path.join(workspaceSystemDir(root), "pending"));
  ensureDirSync(path.join(workspaceSystemDir(root), "originals"));
  ensureDirSync(path.join(workspaceSystemDir(root), "versions"));
  ensureDirSync(path.join(workspaceSystemDir(root), "annotations"));
  const metaPath = workspaceMetaPath(root);
  if (!fs.existsSync(metaPath)) {
    writeJson(metaPath, { captures: [], versions: [] });
  }
}

function writeJson(filePath, value) {
  ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function defaultConfig() {
  return {
    workspaces: [],
    activeWorkspaceId: null,
    monitoringPaused: true,
    shortcuts: { ...DEFAULT_SHORTCUTS },
    preferences: { ...DEFAULT_PREFERENCES },
    pendingCaptures: [],
    tags: [],
    editorTargetCaptureId: null,
    inboxCreatedAt: nowIso(),
  };
}

function loadConfig(app) {
  const config = {
    ...defaultConfig(),
    ...readJson(configPath(app), defaultConfig()),
  };
  config.shortcuts = { ...DEFAULT_SHORTCUTS, ...(config.shortcuts || {}) };
  config.preferences = {
    ...DEFAULT_PREFERENCES,
    ...(config.preferences || {}),
  };
  config.pendingCaptures = (config.pendingCaptures || []).filter((pending) =>
    fs.existsSync(pending.tempPath),
  );
  config.pendingCaptures = config.pendingCaptures.map((pending) => ({
    ...pending,
    note: pending.note || "",
  }));
  config.monitoringPaused = true;
  config.tags = (config.tags || []).map((tag) => ({
    id: tag.id,
    label: String(tag.label || "").trim() || "Tag",
    color: tag.color || "#0f6cbd",
    workspaceId: tag.workspaceId ?? null,
    visible: tag.visible !== false,
  }));
  config.workspaces = (config.workspaces || []).map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    rootPath: workspace.rootPath,
    appendTimestamp: Boolean(workspace.appendTimestamp),
    monitoringPaused: config.monitoringPaused,
    createdAt: workspace.createdAt || nowIso(),
    isInbox: false,
  }));
  saveConfig(app, config);
  return config;
}

function saveConfig(app, config) {
  writeJson(configPath(app), config);
}

function defaultWorkspaceIndex() {
  return { captures: [], versions: [] };
}

function readWorkspaceIndex(root) {
  ensureWorkspaceLayout(root);
  const meta = readJson(workspaceMetaPath(root), defaultWorkspaceIndex());
  meta.captures = meta.captures || [];
  meta.versions = meta.versions || [];
  return meta;
}

function writeWorkspaceIndex(root, index) {
  writeJson(workspaceMetaPath(root), index);
}

function buildInboxWorkspace(app, config) {
  return {
    id: INBOX_ID,
    name: "Inbox",
    rootPath: inboxRoot(app),
    appendTimestamp: false,
    monitoringPaused: config.monitoringPaused,
    createdAt: config.inboxCreatedAt,
    isInbox: true,
    tags: tagsForWorkspace(config, null),
  };
}

function tagsForWorkspace(config, workspaceId) {
  const workspaceKey = workspaceId ?? null;
  return (config.tags || [])
    .filter((tag) => tag.visible !== false && (tag.workspaceId ?? null) === workspaceKey)
    .map((tag) => ({
      id: tag.id,
      label: tag.label,
      color: tag.color,
    }));
}

function listWorkspaces(app, config) {
  return [
    buildInboxWorkspace(app, config),
    ...config.workspaces.map((workspace) => ({
      ...workspace,
      monitoringPaused: config.monitoringPaused,
      isInbox: false,
      tags: tagsForWorkspace(config, workspace.id),
    })),
  ];
}

function resolveWorkspace(app, config, requestedWorkspaceId) {
  const workspaceId = requestedWorkspaceId ?? config.activeWorkspaceId ?? INBOX_ID;
  if (workspaceId === INBOX_ID) {
    return {
      id: INBOX_ID,
      rootPath: inboxRoot(app),
      appendTimestamp: false,
    };
  }

  const workspace = config.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }
  return {
    id: workspace.id,
    rootPath: workspace.rootPath,
    appendTimestamp: Boolean(workspace.appendTimestamp),
  };
}

function nextOrderIndex(root) {
  const index = readWorkspaceIndex(root);
  const max = index.captures.reduce(
    (value, capture) => Math.max(value, capture.orderIndex || 0),
    0,
  );
  return max + 1;
}

function nextPublicFilename(root, appendTimestamp) {
  const prefix = String(nextOrderIndex(root)).padStart(3, "0");
  if (!appendTimestamp) {
    return `${prefix}.png`;
  }
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .slice(0, 15);
  return `${prefix}_${stamp}.png`;
}

function listCaptures(root) {
  return readWorkspaceIndex(root).captures
    .slice()
    .map((capture) => ({
      ...capture,
      tagId: capture.tagId ?? null,
      note: capture.note || "",
    }))
    .sort((left, right) => left.orderIndex - right.orderIndex);
}

function getCapture(root, captureId) {
  const capture = readWorkspaceIndex(root).captures.find((item) => item.id === captureId);
  if (!capture) {
    throw new Error(`Capture ${captureId} not found`);
  }
  return {
    ...capture,
    tagId: capture.tagId ?? null,
    note: capture.note || "",
  };
}

function upsertCapture(root, capture) {
  const index = readWorkspaceIndex(root);
  const position = index.captures.findIndex((item) => item.id === capture.id);
  if (position >= 0) {
    index.captures[position] = capture;
  } else {
    index.captures.push(capture);
  }
  writeWorkspaceIndex(root, index);
}

function deleteCapture(root, captureId) {
  const index = readWorkspaceIndex(root);
  index.captures = index.captures.filter((capture) => capture.id !== captureId);
  index.versions = index.versions.filter((version) => version.captureId !== captureId);
  writeWorkspaceIndex(root, index);
}

function listVersions(root, captureId) {
  return readWorkspaceIndex(root).versions
    .filter((version) => version.captureId === captureId)
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
}

function insertVersion(root, version) {
  const index = readWorkspaceIndex(root);
  index.versions.push(version);
  writeWorkspaceIndex(root, index);
}

function reorderCaptures(root, captureIds) {
  const index = readWorkspaceIndex(root);
  index.captures = captureIds.map((captureId, listIndex) => {
    const capture = index.captures.find((item) => item.id === captureId);
    if (!capture) {
      throw new Error(`Capture ${captureId} not found for reorder`);
    }
    return {
      ...capture,
      orderIndex: listIndex + 1,
    };
  });
  writeWorkspaceIndex(root, index);
  return index.captures;
}

function defaultAnnotationDocument() {
  return {
    items: [],
    crop: null,
    savedAt: nowIso(),
  };
}

function getAnnotationDocument(root, capture) {
  const version = readWorkspaceIndex(root).versions.find(
    (item) => item.id === capture.currentVersionId,
  );
  if (!version?.annotationPath || !fs.existsSync(version.annotationPath)) {
    return defaultAnnotationDocument();
  }
  return readJson(version.annotationPath, defaultAnnotationDocument());
}

function replaceAnnotationDocument(root, versionId, captureId, documentValue) {
  const targetDir = path.join(workspaceSystemDir(root), "annotations", captureId);
  ensureDirSync(targetDir);
  const filePath = path.join(targetDir, `${versionId}.json`);
  writeJson(filePath, documentValue);
  return filePath;
}

function copyFile(source, target) {
  ensureDirSync(path.dirname(target));
  fs.copyFileSync(source, target);
}

function removeFileIfExists(target) {
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
}

function removeDirIfExists(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

module.exports = {
  APP_NAME,
  DEFAULT_PREFERENCES,
  DEFAULT_SHORTCUTS,
  INBOX_ID,
  SYSTEM_DIR,
  appSupportDir,
  copyFile,
  defaultAnnotationDocument,
  deleteCapture,
  ensureWorkspaceLayout,
  getAnnotationDocument,
  getCapture,
  inboxRoot,
  insertVersion,
  listCaptures,
  listVersions,
  listWorkspaces,
  loadConfig,
  nextOrderIndex,
  nextPublicFilename,
  normalizeCaptureTag,
  readWorkspaceIndex,
  removeDirIfExists,
  removeFileIfExists,
  replaceAnnotationDocument,
  reorderCaptures,
  resolveWorkspace,
  saveConfig,
  upsertCapture,
  writeWorkspaceIndex,
};
