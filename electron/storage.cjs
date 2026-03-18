const fs = require("fs");
const path = require("path");

const INBOX_ID = "inbox";
const APP_NAME = "TuClip";
const SYSTEM_DIR = ".tuclip";

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
  customAccentColor: "#0f6cbd",
  popupDurationSeconds: 6,
  extendPopupOnInteraction: true,
  showWorkspaceTags: true,
  detectionPreset: "balanced",
  autoDetectLabels: true,
  autoNumberDetections: true,
  closeAction: "tray",
};

const DEFAULT_REMOTE_CONNECTIONS = {
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
};

function defaultWorkspaceRemoteSettings() {
  return {
    webdavEnabled: false,
    webdavPath: "",
    s3Enabled: false,
    s3Prefix: "",
    lastSyncAt: null,
    lastSyncStatus: "idle",
    lastSyncMessage: "",
    lastPublishAt: null,
    lastPublishStatus: "idle",
    lastPublishMessage: "",
  };
}

function defaultCaptureRemoteState() {
  return {
    syncStatus: "idle",
    publishStatus: "idle",
    remoteUrl: null,
    remoteObjectKey: null,
    lastSyncedAt: null,
    lastPublishedAt: null,
    lastError: "",
  };
}

function normalizeWorkspaceRemoteSettings(value) {
  return {
    ...defaultWorkspaceRemoteSettings(),
    ...(value || {}),
  };
}

function normalizeRemoteConnections(remote) {
  return {
    enabled: remote?.enabled === undefined ? false : Boolean(remote.enabled),
    webdav: {
      ...DEFAULT_REMOTE_CONNECTIONS.webdav,
      ...(remote?.webdav || {}),
      hasPassword: Boolean(remote?.webdav?.hasPassword),
    },
    s3: {
      ...DEFAULT_REMOTE_CONNECTIONS.s3,
      ...(remote?.s3 || {}),
      hasSecretAccessKey: Boolean(remote?.s3?.hasSecretAccessKey),
      forcePathStyle:
        remote?.s3?.forcePathStyle === undefined ? true : Boolean(remote?.s3?.forcePathStyle),
    },
  };
}

function normalizeRemoteConfig(remote) {
  const workspaceSettings = {};
  const source = remote?.workspaceSettings || {};
  Object.entries(source).forEach(([key, value]) => {
    workspaceSettings[key] = normalizeWorkspaceRemoteSettings(value);
  });

  return {
    connections: normalizeRemoteConnections(remote?.connections),
    workspaceSettings,
  };
}

function workspaceRemoteKey(workspaceId) {
  return workspaceId ?? INBOX_ID;
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDirSync(target) {
  fs.mkdirSync(target, { recursive: true });
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

function workspaceSystemDir(root) {
  return path.join(root, SYSTEM_DIR);
}

function metaDir(root) {
  return path.join(workspaceSystemDir(root), "meta");
}

function capturesMetaDir(root) {
  return path.join(metaDir(root), "captures");
}

function versionsMetaDir(root) {
  return path.join(metaDir(root), "versions");
}

function tagsMetaPath(root) {
  return path.join(metaDir(root), "tags.json");
}

function workspaceStatePath(root) {
  return path.join(metaDir(root), "workspace.json");
}

function legacyWorkspaceIndexPath(root) {
  return path.join(workspaceSystemDir(root), "workspace.json");
}

function defaultWorkspaceState() {
  return {
    schemaVersion: 2,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function defaultWorkspaceIndex() {
  return { captures: [], versions: [] };
}

function normalizeTagRecord(tag, workspaceId) {
  return {
    id: tag.id,
    label: String(tag.label || "").trim() || "Tag",
    color: tag.color || "#0f6cbd",
    workspaceId: workspaceId ?? null,
    visible: tag.visible !== false,
  };
}

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

function normalizeCapture(capture) {
  return {
    ...capture,
    tagId: capture.tagId ?? null,
    note: capture.note || "",
    remote: {
      ...defaultCaptureRemoteState(),
      ...(capture.remote || {}),
    },
  };
}

function listJsonRecords(dir) {
  ensureDirSync(dir);
  return fs
    .readdirSync(dir)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => readJson(path.join(dir, entry), null))
    .filter(Boolean);
}

function writeRecordCollection(dir, records, keyName = "id") {
  ensureDirSync(dir);
  const expected = new Set();

  records.forEach((record) => {
    const key = record[keyName];
    if (!key) {
      return;
    }
    const filePath = path.join(dir, `${key}.json`);
    expected.add(path.basename(filePath));
    writeJson(filePath, record);
  });

  fs.readdirSync(dir)
    .filter((entry) => entry.endsWith(".json"))
    .forEach((entry) => {
      if (!expected.has(entry)) {
        fs.unlinkSync(path.join(dir, entry));
      }
    });
}

function migrateWorkspaceLayout(root) {
  const legacyPath = legacyWorkspaceIndexPath(root);
  const nextStatePath = workspaceStatePath(root);
  const captureDir = capturesMetaDir(root);
  const versionDir = versionsMetaDir(root);

  if (fs.existsSync(nextStatePath)) {
    return;
  }

  const legacyIndex = readJson(legacyPath, null);
  if (legacyIndex?.captures || legacyIndex?.versions) {
    const captures = (legacyIndex.captures || []).map((capture) => normalizeCapture(capture));
    const versions = legacyIndex.versions || [];
    writeRecordCollection(captureDir, captures);
    writeRecordCollection(versionDir, versions);
    writeJson(nextStatePath, {
      ...defaultWorkspaceState(),
      migratedAt: nowIso(),
      legacyPath,
    });
    fs.renameSync(legacyPath, `${legacyPath}.legacy`);
    return;
  }

  writeJson(nextStatePath, defaultWorkspaceState());
}

function ensureWorkspaceLayout(root) {
  ensureDirSync(root);
  ensureDirSync(path.join(workspaceSystemDir(root), "pending"));
  ensureDirSync(path.join(workspaceSystemDir(root), "originals"));
  ensureDirSync(path.join(workspaceSystemDir(root), "versions"));
  ensureDirSync(path.join(workspaceSystemDir(root), "annotations"));
  ensureDirSync(path.join(workspaceSystemDir(root), "conflicts"));
  ensureDirSync(metaDir(root));
  ensureDirSync(capturesMetaDir(root));
  ensureDirSync(versionsMetaDir(root));
  if (!fs.existsSync(tagsMetaPath(root))) {
    writeJson(tagsMetaPath(root), []);
  }
  migrateWorkspaceLayout(root);
}

function readWorkspaceState(root) {
  ensureWorkspaceLayout(root);
  return {
    ...defaultWorkspaceState(),
    ...readJson(workspaceStatePath(root), defaultWorkspaceState()),
  };
}

function writeWorkspaceState(root, state) {
  writeJson(workspaceStatePath(root), {
    ...defaultWorkspaceState(),
    ...state,
    updatedAt: nowIso(),
  });
}

function readWorkspaceTags(root, workspaceId) {
  ensureWorkspaceLayout(root);
  return readJson(tagsMetaPath(root), []).map((tag) => normalizeTagRecord(tag, workspaceId));
}

function writeWorkspaceTags(root, tags, workspaceId) {
  ensureWorkspaceLayout(root);
  writeJson(
    tagsMetaPath(root),
    tags.map((tag) => normalizeTagRecord(tag, workspaceId)),
  );
}

function hasWorkspaceTagFiles(app, config) {
  const roots = [inboxRoot(app), ...config.workspaces.map((workspace) => workspace.rootPath)];
  return roots.some((root) => readWorkspaceTags(root, null).length > 0);
}

function writeAggregatedTags(app, config, tags) {
  const grouped = new Map();
  tags.forEach((tag) => {
    const key = workspaceRemoteKey(tag.workspaceId ?? null);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(tag);
  });

  writeWorkspaceTags(inboxRoot(app), grouped.get(INBOX_ID) || [], null);
  config.workspaces.forEach((workspace) => {
    writeWorkspaceTags(
      workspace.rootPath,
      grouped.get(workspace.id) || [],
      workspace.id,
    );
  });
}

function collectAllTags(app, config) {
  const next = [...readWorkspaceTags(inboxRoot(app), null)];
  config.workspaces.forEach((workspace) => {
    next.push(...readWorkspaceTags(workspace.rootPath, workspace.id));
  });
  return next;
}

function refreshTagCache(app, config) {
  config.tags = collectAllTags(app, config);
  return config.tags;
}

function defaultConfig() {
  return {
    workspaces: [],
    activeWorkspaceId: null,
    monitoringPaused: true,
    shortcuts: { ...DEFAULT_SHORTCUTS },
    preferences: { ...DEFAULT_PREFERENCES },
    remote: normalizeRemoteConfig(null),
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
  config.remote = normalizeRemoteConfig(config.remote);
  config.pendingCaptures = (config.pendingCaptures || []).filter((pending) =>
    fs.existsSync(pending.tempPath),
  );
  config.pendingCaptures = config.pendingCaptures.map((pending) => ({
    ...pending,
    note: pending.note || "",
  }));
  config.monitoringPaused = true;
  config.workspaces = (config.workspaces || []).map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    rootPath: workspace.rootPath,
    appendTimestamp: Boolean(workspace.appendTimestamp),
    monitoringPaused: config.monitoringPaused,
    createdAt: workspace.createdAt || nowIso(),
    isInbox: false,
  }));

  if ((config.tags || []).length > 0 && !hasWorkspaceTagFiles(app, config)) {
    writeAggregatedTags(app, config, config.tags);
  }
  refreshTagCache(app, config);
  saveConfig(app, config);
  return config;
}

function saveConfig(app, config) {
  writeJson(configPath(app), config);
}

function readWorkspaceIndex(root) {
  ensureWorkspaceLayout(root);
  const captures = listJsonRecords(capturesMetaDir(root)).map((capture) => normalizeCapture(capture));
  const versions = listJsonRecords(versionsMetaDir(root));
  return { captures, versions };
}

function writeWorkspaceIndex(root, index) {
  ensureWorkspaceLayout(root);
  writeRecordCollection(
    capturesMetaDir(root),
    (index.captures || []).map((capture) => normalizeCapture(capture)),
  );
  writeRecordCollection(versionsMetaDir(root), index.versions || []);
  writeWorkspaceState(root, readWorkspaceState(root));
}

function getWorkspaceRemoteSettings(config, workspaceId) {
  return normalizeWorkspaceRemoteSettings(
    config.remote?.workspaceSettings?.[workspaceRemoteKey(workspaceId)],
  );
}

function setWorkspaceRemoteSettings(config, workspaceId, patch) {
  const key = workspaceRemoteKey(workspaceId);
  config.remote.workspaceSettings[key] = {
    ...getWorkspaceRemoteSettings(config, workspaceId),
    ...(patch || {}),
  };
  return config.remote.workspaceSettings[key];
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
    remoteSettings: getWorkspaceRemoteSettings(config, null),
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
  refreshTagCache(app, config);
  return [
    buildInboxWorkspace(app, config),
    ...config.workspaces.map((workspace) => ({
      ...workspace,
      monitoringPaused: config.monitoringPaused,
      isInbox: false,
      tags: tagsForWorkspace(config, workspace.id),
      remoteSettings: getWorkspaceRemoteSettings(config, workspace.id),
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
      remoteSettings: getWorkspaceRemoteSettings(config, null),
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
    remoteSettings: getWorkspaceRemoteSettings(config, workspace.id),
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
    .map((capture) => normalizeCapture(capture))
    .sort((left, right) => left.orderIndex - right.orderIndex);
}

function getCapture(root, captureId) {
  const capture = readWorkspaceIndex(root).captures.find((item) => item.id === captureId);
  if (!capture) {
    throw new Error(`Capture ${captureId} not found`);
  }
  return normalizeCapture(capture);
}

function upsertCapture(root, capture) {
  const index = readWorkspaceIndex(root);
  const position = index.captures.findIndex((item) => item.id === capture.id);
  const nextCapture = normalizeCapture(capture);
  if (position >= 0) {
    index.captures[position] = nextCapture;
  } else {
    index.captures.push(nextCapture);
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
    return normalizeCapture({
      ...capture,
      orderIndex: listIndex + 1,
    });
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
  DEFAULT_REMOTE_CONNECTIONS,
  DEFAULT_SHORTCUTS,
  INBOX_ID,
  SYSTEM_DIR,
  appSupportDir,
  collectAllTags,
  copyFile,
  defaultAnnotationDocument,
  defaultCaptureRemoteState,
  defaultWorkspaceRemoteSettings,
  deleteCapture,
  ensureWorkspaceLayout,
  getAnnotationDocument,
  getCapture,
  getWorkspaceRemoteSettings,
  inboxRoot,
  insertVersion,
  listCaptures,
  listVersions,
  listWorkspaces,
  loadConfig,
  nextOrderIndex,
  nextPublicFilename,
  normalizeCapture,
  normalizeCaptureTag,
  normalizeRemoteConfig,
  readWorkspaceIndex,
  readWorkspaceTags,
  refreshTagCache,
  removeDirIfExists,
  removeFileIfExists,
  replaceAnnotationDocument,
  reorderCaptures,
  resolveWorkspace,
  saveConfig,
  setWorkspaceRemoteSettings,
  upsertCapture,
  workspaceRemoteKey,
  workspaceSystemDir,
  writeAggregatedTags,
  writeWorkspaceIndex,
  writeWorkspaceTags,
};
