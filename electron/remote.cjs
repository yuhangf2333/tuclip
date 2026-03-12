const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { clipboard, safeStorage, shell } = require("electron");
const { createClient } = require("webdav");
const {
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");

const {
  APP_NAME,
  INBOX_ID,
  appSupportDir,
  copyFile,
  defaultCaptureRemoteState,
  defaultWorkspaceRemoteSettings,
  ensureWorkspaceLayout,
  getCapture,
  getWorkspaceRemoteSettings,
  inboxRoot,
  listCaptures,
  normalizeCapture,
  refreshTagCache,
  resolveWorkspace,
  saveConfig,
  setWorkspaceRemoteSettings,
  upsertCapture,
  workspaceRemoteKey,
} = require("./storage.cjs");

function nowIso() {
  return new Date().toISOString();
}

function normalizePosixPath(value) {
  const next = `/${String(value || "").replace(/\\/g, "/").replace(/^\/+/, "")}`;
  return next.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

function joinRemotePath(...parts) {
  return normalizePosixPath(parts.filter(Boolean).join("/"));
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function credentialsPath(app) {
  return path.join(appSupportDir(app), "remote-credentials.json");
}

function syncStatePath(app) {
  return path.join(appSupportDir(app), "remote-sync.json");
}

function defaultRemoteSyncState() {
  return {
    workspaces: {},
    jobs: [],
    conflicts: [],
  };
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function readCredentials(app) {
  const filePath = credentialsPath(app);
  if (!fs.existsSync(filePath)) {
    return { webdav: {}, s3: {} };
  }

  const raw = fs.readFileSync(filePath);
  try {
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : raw.toString("utf8");
    return JSON.parse(json);
  } catch {
    return { webdav: {}, s3: {} };
  }
}

function writeCredentials(app, credentials) {
  const json = JSON.stringify(credentials, null, 2);
  const payload = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, "utf8");
  fs.writeFileSync(credentialsPath(app), payload);
}

function loadSyncState(app) {
  return {
    ...defaultRemoteSyncState(),
    ...readJson(syncStatePath(app), defaultRemoteSyncState()),
  };
}

function saveSyncState(app, state) {
  writeJson(syncStatePath(app), state);
}

function listWorkspaceFiles(root) {
  ensureWorkspaceLayout(root);
  const files = [];
  const stack = [root];
  const excluded = new Set([
    path.join(root, ".tuclip", "pending"),
    path.join(root, ".tuclip", "conflicts"),
  ]);

  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      if (excluded.has(current)) {
        continue;
      }
      fs.readdirSync(current).forEach((entry) => stack.push(path.join(current, entry)));
      continue;
    }

    const relative = path.relative(root, current).split(path.sep).join("/");
    files.push({
      absolutePath: current,
      relativePath: relative,
      hash: hashBuffer(fs.readFileSync(current)),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function ensureRemoteStateWorkspace(state, workspaceId) {
  const key = workspaceRemoteKey(workspaceId);
  if (!state.workspaces[key]) {
    state.workspaces[key] = { files: {} };
  }
  if (!state.workspaces[key].files) {
    state.workspaces[key].files = {};
  }
  return state.workspaces[key];
}

function buildWorkspaceRemoteDir(connection, workspaceId, settings) {
  const base = normalizePosixPath(connection.rootPath || "/TuClip");
  const suffix = settings.webdavPath?.trim() || workspaceRemoteKey(workspaceId);
  return joinRemotePath(base, suffix);
}

function buildCaptureObjectKey(workspaceId, captureId, settings) {
  const prefix = (settings.s3Prefix || workspaceRemoteKey(workspaceId)).replace(/^\/+|\/+$/g, "");
  return [prefix, `${captureId}.png`].filter(Boolean).join("/");
}

function remoteUrlFromConfig(connection, key) {
  if (connection.publicBaseUrl) {
    return `${connection.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }
  if (!connection.endpoint || !connection.bucket) {
    return "";
  }
  return `${connection.endpoint.replace(/\/+$/, "")}/${connection.bucket}/${key}`;
}

function createWebDavClient(config, credentials) {
  return createClient(config.baseUrl, {
    username: config.username,
    password: credentials?.password || "",
  });
}

function createS3(config, credentials) {
  return new S3Client({
    region: config.region || "auto",
    endpoint: config.endpoint || undefined,
    forcePathStyle: config.forcePathStyle !== false,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: credentials?.secretAccessKey || "",
    },
  });
}

async function statRemoteFile(client, remotePath) {
  try {
    return await client.stat(remotePath);
  } catch (error) {
    if (error?.status === 404) {
      return null;
    }
    throw error;
  }
}

async function downloadRemoteBuffer(client, remotePath) {
  const payload = await client.getFileContents(remotePath, { format: "binary" });
  if (Buffer.isBuffer(payload)) {
    return payload;
  }
  if (payload instanceof ArrayBuffer) {
    return Buffer.from(payload);
  }
  if (ArrayBuffer.isView(payload)) {
    return Buffer.from(payload.buffer);
  }
  return Buffer.from(payload);
}

async function uploadRemoteFile(client, remotePath, absolutePath) {
  await client.createDirectory(path.posix.dirname(remotePath), { recursive: true });
  const buffer = fs.readFileSync(absolutePath);
  await client.putFileContents(remotePath, buffer, {
    overwrite: true,
    contentLength: buffer.length,
  });
  return statRemoteFile(client, remotePath);
}

function createConflictFile(root, relativePath, buffer) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetPath = path.join(root, ".tuclip", "conflicts", stamp, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
  return targetPath;
}

function makeJob(kind, workspaceId, captureId = null) {
  return {
    id: crypto.randomUUID(),
    kind,
    workspaceId: workspaceId ?? null,
    captureId,
    status: "queued",
    attempts: 0,
    error: "",
    scheduledAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function createRemoteServices({ app, runtime }) {
  let queueRunning = false;

  function getConfig() {
    return runtime.config;
  }

  function saveRuntimeConfig() {
    saveConfig(app, runtime.config);
  }

  function getConnections() {
    return runtime.config.remote.connections;
  }

  function isRemoteEnabled() {
    return Boolean(getConnections().enabled);
  }

  function readSyncState() {
    return loadSyncState(app);
  }

  function writeSyncState(state) {
    saveSyncState(app, state);
  }

  function updateWorkspaceSyncStatus(workspaceId, patch) {
    const next = setWorkspaceRemoteSettings(runtime.config, workspaceId, patch);
    saveRuntimeConfig();
    return next;
  }

  function appendConflict(conflict) {
    const state = readSyncState();
    state.conflicts.unshift(conflict);
    writeSyncState(state);
  }

  function queueJob(job) {
    const state = readSyncState();
    const duplicate = state.jobs.find(
      (item) =>
        item.kind === job.kind &&
        item.workspaceId === job.workspaceId &&
        item.captureId === job.captureId &&
        ["queued", "running"].includes(item.status),
    );
    if (duplicate) {
      return duplicate;
    }
    state.jobs.push(job);
    writeSyncState(state);
    void processQueue();
    return job;
  }

  async function testWebDavConnection(patch) {
    const connections = getConnections();
    const config = {
      ...connections.webdav,
      ...(patch || {}),
    };
    const credentials = readCredentials(app);
    if (patch?.password) {
      credentials.webdav = {
        ...credentials.webdav,
        password: patch.password,
      };
    }
    const client = createWebDavClient(config, credentials.webdav);
    const target = normalizePosixPath(config.rootPath || "/TuClip");
    await client.createDirectory(target, { recursive: true });
    await client.getDirectoryContents(target);
    return {
      checkedAt: nowIso(),
      ok: true,
      message: "Connected",
    };
  }

  async function testS3Connection(patch) {
    const connections = getConnections();
    const config = {
      ...connections.s3,
      ...(patch || {}),
    };
    const credentials = readCredentials(app);
    if (patch?.secretAccessKey) {
      credentials.s3 = {
        ...credentials.s3,
        secretAccessKey: patch.secretAccessKey,
      };
    }
    const client = createS3(config, credentials.s3);
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    return {
      checkedAt: nowIso(),
      ok: true,
      message: "Connected",
    };
  }

  async function updateRemoteConnections(patch) {
    const connections = getConnections();
    const next = {
      enabled: patch?.enabled === undefined ? connections.enabled : Boolean(patch.enabled),
      webdav: {
        ...connections.webdav,
        ...(patch?.webdav || {}),
        hasPassword:
          patch?.webdav?.password !== undefined
            ? Boolean(patch.webdav.password)
            : connections.webdav.hasPassword,
      },
      s3: {
        ...connections.s3,
        ...(patch?.s3 || {}),
        hasSecretAccessKey:
          patch?.s3?.secretAccessKey !== undefined
            ? Boolean(patch.s3.secretAccessKey)
            : connections.s3.hasSecretAccessKey,
      },
    };

    delete next.webdav.password;
    delete next.s3.secretAccessKey;

    const credentials = readCredentials(app);
    if (patch?.webdav?.password) {
      credentials.webdav = {
        ...credentials.webdav,
        password: patch.webdav.password,
      };
    }
    if (patch?.s3?.secretAccessKey) {
      credentials.s3 = {
        ...credentials.s3,
        secretAccessKey: patch.s3.secretAccessKey,
      };
    }

    runtime.config.remote.connections = next;
    writeCredentials(app, credentials);
    saveRuntimeConfig();
    return next;
  }

  async function syncWorkspaceInternal(workspaceId) {
    const config = getConfig();
    const workspace = resolveWorkspace(app, config, workspaceId);
    const settings = getWorkspaceRemoteSettings(config, workspaceId);
    const connection = config.remote.connections.webdav;
    const credentials = readCredentials(app).webdav;

    if (!config.remote.connections.enabled || !settings.webdavEnabled || !connection.enabled || !credentials?.password) {
      return { ok: true, skipped: true };
    }

    updateWorkspaceSyncStatus(workspaceId, {
      lastSyncStatus: "syncing",
      lastSyncMessage: "",
    });

    const client = createWebDavClient(connection, credentials);
    const remoteRoot = buildWorkspaceRemoteDir(connection, workspaceId, settings);
    await client.createDirectory(remoteRoot, { recursive: true });

    const state = readSyncState();
    const workspaceState = ensureRemoteStateWorkspace(state, workspaceId);
    const localFiles = listWorkspaceFiles(workspace.rootPath);
    const localMap = new Map(localFiles.map((file) => [file.relativePath, file]));
    const remoteEntries = await client.getDirectoryContents(remoteRoot, { deep: true });
    const remoteFiles = new Map();

    remoteEntries
      .filter((entry) => entry.type === "file")
      .forEach((entry) => {
        const filename = String(entry.filename || "").replace(remoteRoot, "").replace(/^\/+/, "");
        if (!filename) {
          return;
        }
        remoteFiles.set(filename, entry);
      });

    let conflictCount = 0;
    const paths = new Set([...localMap.keys(), ...remoteFiles.keys()]);

    for (const relativePath of paths) {
      const localFile = localMap.get(relativePath) || null;
      const remoteFile = remoteFiles.get(relativePath) || null;
      const remotePath = joinRemotePath(remoteRoot, relativePath);
      const stateEntry = workspaceState.files[relativePath] || null;

      if (localFile && !remoteFile) {
        const stat = await uploadRemoteFile(client, remotePath, localFile.absolutePath);
        workspaceState.files[relativePath] = {
          lastSyncedHash: localFile.hash,
          remoteEtag: stat?.etag || "",
          remoteModifiedAt: stat?.lastmod || null,
          lastSyncAt: nowIso(),
        };
        continue;
      }

      if (!localFile && remoteFile) {
        const remoteBuffer = await downloadRemoteBuffer(client, remotePath);
        const targetPath = path.join(workspace.rootPath, relativePath);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, remoteBuffer);
        workspaceState.files[relativePath] = {
          lastSyncedHash: hashBuffer(remoteBuffer),
          remoteEtag: remoteFile.etag || "",
          remoteModifiedAt: remoteFile.lastmod || null,
          lastSyncAt: nowIso(),
        };
        continue;
      }

      if (!localFile || !remoteFile) {
        continue;
      }

      if (!stateEntry) {
        const remoteBuffer = await downloadRemoteBuffer(client, remotePath);
        const remoteHash = hashBuffer(remoteBuffer);
        if (remoteHash === localFile.hash) {
          workspaceState.files[relativePath] = {
            lastSyncedHash: localFile.hash,
            remoteEtag: remoteFile.etag || "",
            remoteModifiedAt: remoteFile.lastmod || null,
            lastSyncAt: nowIso(),
          };
        } else {
          conflictCount += 1;
          const incomingPath = createConflictFile(workspace.rootPath, relativePath, remoteBuffer);
          state.conflicts.unshift({
            id: crypto.randomUUID(),
            workspaceId: workspaceId ?? null,
            relativePath,
            localPath: path.join(workspace.rootPath, relativePath),
            incomingPath,
            createdAt: nowIso(),
            status: "open",
          });
        }
        continue;
      }

      const localChanged = stateEntry.lastSyncedHash !== localFile.hash;
      const remoteChanged =
        stateEntry.remoteEtag !== (remoteFile.etag || "") ||
        stateEntry.remoteModifiedAt !== (remoteFile.lastmod || null);

      if (localChanged && remoteChanged) {
        const remoteBuffer = await downloadRemoteBuffer(client, remotePath);
        const remoteHash = hashBuffer(remoteBuffer);
        if (remoteHash === localFile.hash) {
          workspaceState.files[relativePath] = {
            lastSyncedHash: localFile.hash,
            remoteEtag: remoteFile.etag || "",
            remoteModifiedAt: remoteFile.lastmod || null,
            lastSyncAt: nowIso(),
          };
        } else {
          conflictCount += 1;
          const incomingPath = createConflictFile(workspace.rootPath, relativePath, remoteBuffer);
          state.conflicts.unshift({
            id: crypto.randomUUID(),
            workspaceId: workspaceId ?? null,
            relativePath,
            localPath: path.join(workspace.rootPath, relativePath),
            incomingPath,
            createdAt: nowIso(),
            status: "open",
          });
        }
        continue;
      }

      if (localChanged) {
        const stat = await uploadRemoteFile(client, remotePath, localFile.absolutePath);
        workspaceState.files[relativePath] = {
          lastSyncedHash: localFile.hash,
          remoteEtag: stat?.etag || "",
          remoteModifiedAt: stat?.lastmod || null,
          lastSyncAt: nowIso(),
        };
        continue;
      }

      if (remoteChanged) {
        const remoteBuffer = await downloadRemoteBuffer(client, remotePath);
        fs.mkdirSync(path.dirname(localFile.absolutePath), { recursive: true });
        fs.writeFileSync(localFile.absolutePath, remoteBuffer);
        workspaceState.files[relativePath] = {
          lastSyncedHash: hashBuffer(remoteBuffer),
          remoteEtag: remoteFile.etag || "",
          remoteModifiedAt: remoteFile.lastmod || null,
          lastSyncAt: nowIso(),
        };
        continue;
      }

      workspaceState.files[relativePath] = {
        ...stateEntry,
        lastSyncAt: nowIso(),
      };
    }

    writeSyncState(state);
    refreshTagCache(app, runtime.config);
    saveRuntimeConfig();
    updateWorkspaceSyncStatus(workspaceId, {
      lastSyncAt: nowIso(),
      lastSyncStatus: conflictCount > 0 ? "conflict" : "synced",
      lastSyncMessage: conflictCount > 0 ? `${conflictCount} conflict(s)` : "Synced",
    });
    return { ok: true, conflicts: conflictCount };
  }

  async function publishCaptureInternal(captureId, workspaceId) {
    const config = getConfig();
    const workspace = resolveWorkspace(app, config, workspaceId);
    const settings = getWorkspaceRemoteSettings(config, workspaceId);
    const connection = config.remote.connections.s3;
    const credentials = readCredentials(app).s3;

    if (!config.remote.connections.enabled || !settings.s3Enabled || !connection.enabled || !credentials?.secretAccessKey) {
      return { ok: true, skipped: true };
    }

    const capture = getCapture(workspace.rootPath, captureId);
    const client = createS3(connection, credentials);
    const objectKey = buildCaptureObjectKey(workspaceId, capture.id, settings);
    const body = fs.readFileSync(capture.publicPath);

    updateWorkspaceSyncStatus(workspaceId, {
      lastPublishStatus: "publishing",
      lastPublishMessage: "",
    });
    upsertCapture(workspace.rootPath, {
      ...capture,
      remote: {
        ...capture.remote,
        publishStatus: "publishing",
        lastError: "",
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: connection.bucket,
        Key: objectKey,
        Body: body,
        ContentType: "image/png",
      }),
    );

    const remoteUrl = remoteUrlFromConfig(connection, objectKey);
    const updated = normalizeCapture({
      ...capture,
      remote: {
        ...capture.remote,
        publishStatus: "published",
        syncStatus: capture.remote?.syncStatus || "idle",
        remoteUrl,
        remoteObjectKey: objectKey,
        lastPublishedAt: nowIso(),
        lastError: "",
      },
    });
    upsertCapture(workspace.rootPath, updated);
    updateWorkspaceSyncStatus(workspaceId, {
      lastPublishAt: nowIso(),
      lastPublishStatus: "published",
      lastPublishMessage: remoteUrl,
    });

    return { ok: true, capture: updated };
  }

  async function runJob(job) {
    if (job.kind === "workspace-sync") {
      return syncWorkspaceInternal(job.workspaceId);
    }
    if (job.kind === "capture-publish") {
      return publishCaptureInternal(job.captureId, job.workspaceId);
    }
    return { ok: true };
  }

  async function processQueue() {
    if (!isRemoteEnabled()) {
      return;
    }
    if (queueRunning) {
      return;
    }
    queueRunning = true;
    try {
      while (true) {
        const state = readSyncState();
        const job = state.jobs.find((item) => item.status === "queued");
        if (!job) {
          break;
        }

        job.status = "running";
        job.updatedAt = nowIso();
        writeSyncState(state);

        try {
          await runJob(job);
          const nextState = readSyncState();
          nextState.jobs = nextState.jobs.filter((item) => item.id !== job.id);
          writeSyncState(nextState);
        } catch (error) {
          const nextState = readSyncState();
          const target = nextState.jobs.find((item) => item.id === job.id);
          if (target) {
            target.status = "failed";
            target.attempts += 1;
            target.error = error instanceof Error ? error.message : String(error);
            target.updatedAt = nowIso();
          }
          writeSyncState(nextState);
          if (job.kind === "workspace-sync") {
            updateWorkspaceSyncStatus(job.workspaceId, {
              lastSyncStatus: "failed",
              lastSyncMessage: error instanceof Error ? error.message : String(error),
            });
          }
          if (job.kind === "capture-publish") {
            const workspace = resolveWorkspace(app, runtime.config, job.workspaceId);
            const capture = getCapture(workspace.rootPath, job.captureId);
            upsertCapture(workspace.rootPath, {
              ...capture,
              remote: {
                ...capture.remote,
                publishStatus: "failed",
                lastError: error instanceof Error ? error.message : String(error),
              },
            });
            updateWorkspaceSyncStatus(job.workspaceId, {
              lastPublishStatus: "failed",
              lastPublishMessage: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    } finally {
      queueRunning = false;
    }
  }

  function queueWorkspaceSync(workspaceId) {
    if (!isRemoteEnabled()) {
      return null;
    }
    return queueJob(makeJob("workspace-sync", workspaceId));
  }

  function queueCapturePublish(captureId, workspaceId) {
    if (!isRemoteEnabled()) {
      return null;
    }
    return queueJob(makeJob("capture-publish", workspaceId, captureId));
  }

  function getRemoteState(activeWorkspaceId = null) {
    const state = readSyncState();
    const config = getConfig();
    return {
      connections: config.remote.connections,
      workspaceSettings: config.remote.workspaceSettings,
      jobs: state.jobs,
      conflicts: state.conflicts,
      summary: {
        enabled: Boolean(config.remote.connections.enabled),
        configured:
          Boolean(config.remote.connections.webdav.baseUrl) ||
          Boolean(config.remote.connections.s3.bucket),
        pendingJobs: config.remote.connections.enabled
          ? state.jobs.filter((job) => ["queued", "running", "failed"].includes(job.status)).length
          : 0,
        conflicts: config.remote.connections.enabled
          ? state.conflicts.filter((item) => item.status === "open").length
          : 0,
        activeWorkspaceStatus: getWorkspaceRemoteSettings(config, activeWorkspaceId).lastSyncStatus,
      },
    };
  }

  async function runWorkspaceSync(workspaceId) {
    if (!isRemoteEnabled()) {
      return getRemoteState(workspaceId);
    }
    queueWorkspaceSync(workspaceId);
    await processQueue();
    return getRemoteState(workspaceId);
  }

  async function publishCaptureNow(captureId, workspaceId) {
    if (!isRemoteEnabled()) {
      const workspace = resolveWorkspace(app, runtime.config, workspaceId);
      return getCapture(workspace.rootPath, captureId);
    }
    queueCapturePublish(captureId, workspaceId);
    await processQueue();
    const workspace = resolveWorkspace(app, runtime.config, workspaceId);
    return getCapture(workspace.rootPath, captureId);
  }

  async function retryRemoteJobs() {
    if (!isRemoteEnabled()) {
      return getRemoteState(runtime.config.activeWorkspaceId ?? null);
    }
    const state = readSyncState();
    state.jobs = state.jobs.map((job) =>
      job.status === "failed"
        ? {
            ...job,
            status: "queued",
            updatedAt: nowIso(),
          }
        : job,
    );
    writeSyncState(state);
    await processQueue();
    return getRemoteState(runtime.config.activeWorkspaceId ?? null);
  }

  function copyCaptureRemoteUrl(captureId, workspaceId) {
    const workspace = resolveWorkspace(app, runtime.config, workspaceId);
    const capture = getCapture(workspace.rootPath, captureId);
    if (!capture.remote?.remoteUrl) {
      throw new Error("Remote URL is unavailable");
    }
    clipboard.writeText(capture.remote.remoteUrl);
    return capture.remote.remoteUrl;
  }

  async function openCaptureRemoteUrl(captureId, workspaceId) {
    const url = copyCaptureRemoteUrl(captureId, workspaceId);
    await shell.openExternal(url);
    return url;
  }

  function updateWorkspaceRemoteBinding(workspaceId, patch) {
    const next = setWorkspaceRemoteSettings(runtime.config, workspaceId, patch);
    saveRuntimeConfig();
    return next;
  }

  function resolveSyncConflict(conflictId, action = "resolved") {
    const state = readSyncState();
    const conflict = state.conflicts.find((item) => item.id === conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    if (action === "useIncoming") {
      fs.mkdirSync(path.dirname(conflict.localPath), { recursive: true });
      copyFile(conflict.incomingPath, conflict.localPath);
    }
    conflict.status = "resolved";
    conflict.resolvedAt = nowIso();
    conflict.resolution = action;
    writeSyncState(state);
    return conflict;
  }

  async function testRemoteConnection(provider, patch) {
    try {
      const result =
        provider === "s3"
          ? await testS3Connection(patch?.s3 || patch)
          : await testWebDavConnection(patch?.webdav || patch);
      const target =
        provider === "s3"
          ? runtime.config.remote.connections.s3
          : runtime.config.remote.connections.webdav;
      target.lastTestedAt = result.checkedAt;
      target.lastTestSuccess = true;
      target.lastTestMessage = result.message;
      saveRuntimeConfig();
      return result;
    } catch (error) {
      const target =
        provider === "s3"
          ? runtime.config.remote.connections.s3
          : runtime.config.remote.connections.webdav;
      target.lastTestedAt = nowIso();
      target.lastTestSuccess = false;
      target.lastTestMessage = error instanceof Error ? error.message : String(error);
      saveRuntimeConfig();
      throw error;
    }
  }

  function scheduleEnabledWorkspaceSync() {
    if (!isRemoteEnabled()) {
      return;
    }
    const workspaces = [null, ...runtime.config.workspaces.map((workspace) => workspace.id)];
    workspaces.forEach((workspaceId) => {
      const settings = getWorkspaceRemoteSettings(runtime.config, workspaceId);
      if (settings.webdavEnabled) {
        queueWorkspaceSync(workspaceId);
      }
    });
    void processQueue();
  }

  return {
    copyCaptureRemoteUrl,
    getRemoteState,
    openCaptureRemoteUrl,
    processQueue,
    publishCaptureNow,
    queueCapturePublish,
    queueWorkspaceSync,
    resolveSyncConflict,
    retryRemoteJobs,
    runWorkspaceSync,
    scheduleEnabledWorkspaceSync,
    testRemoteConnection,
    updateRemoteConnections,
    updateWorkspaceRemoteBinding,
  };
}

module.exports = {
  createRemoteServices,
  defaultRemoteSyncState,
};
