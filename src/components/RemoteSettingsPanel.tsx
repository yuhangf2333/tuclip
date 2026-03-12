import { AlertTriangle, Cloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { UiStrings } from "../lib/i18n";
import type {
  RemoteConnectionConfig,
  RemoteProvider,
  RemoteStatePayload,
  Workspace,
  WorkspaceRemoteSettings,
} from "../types/app";

interface RemoteSettingsPanelProps {
  activeWorkspaceId: string | null;
  remoteState: RemoteStatePayload;
  workspaces: Workspace[];
  strings: UiStrings;
  onSaveConnections: (patch: {
    enabled?: boolean;
    webdav?: Partial<RemoteConnectionConfig["webdav"]> & { password?: string };
    s3?: Partial<RemoteConnectionConfig["s3"]> & { secretAccessKey?: string };
  }) => Promise<void>;
  onTestConnection: (
    provider: RemoteProvider,
    patch?: {
      webdav?: Partial<RemoteConnectionConfig["webdav"]> & { password?: string };
      s3?: Partial<RemoteConnectionConfig["s3"]> & { secretAccessKey?: string };
    },
  ) => Promise<void>;
  onSaveWorkspaceSettings: (
    workspaceId: string | null,
    patch: Partial<WorkspaceRemoteSettings>,
  ) => Promise<void>;
  onRunWorkspaceSync: (workspaceId: string | null) => Promise<void>;
  onRetryJobs: () => Promise<void>;
  onResolveConflict: (
    conflictId: string,
    action: "resolved" | "useIncoming" | "keepLocal",
  ) => Promise<unknown>;
}

const INBOX_VALUE = "__inbox__";

export function RemoteSettingsPanel({
  activeWorkspaceId,
  remoteState,
  workspaces,
  strings,
  onSaveConnections,
  onTestConnection,
  onSaveWorkspaceSettings,
  onRunWorkspaceSync,
  onRetryJobs,
  onResolveConflict,
}: RemoteSettingsPanelProps) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(activeWorkspaceId);
  const [webdavDraft, setWebdavDraft] = useState({
    enabled: false,
    baseUrl: "",
    username: "",
    rootPath: "/TuClip",
    password: "",
  });
  const [s3Draft, setS3Draft] = useState({
    enabled: false,
    endpoint: "",
    region: "auto",
    bucket: "",
    accessKeyId: "",
    publicBaseUrl: "",
    forcePathStyle: true,
    secretAccessKey: "",
  });
  const [workspaceDraft, setWorkspaceDraft] = useState<WorkspaceRemoteSettings>({
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
  });

  useEffect(() => {
    setSelectedWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId]);

  useEffect(() => {
    setWebdavDraft({
      enabled: remoteState.connections.webdav.enabled,
      baseUrl: remoteState.connections.webdav.baseUrl,
      username: remoteState.connections.webdav.username,
      rootPath: remoteState.connections.webdav.rootPath,
      password: "",
    });
    setS3Draft({
      enabled: remoteState.connections.s3.enabled,
      endpoint: remoteState.connections.s3.endpoint,
      region: remoteState.connections.s3.region,
      bucket: remoteState.connections.s3.bucket,
      accessKeyId: remoteState.connections.s3.accessKeyId,
      publicBaseUrl: remoteState.connections.s3.publicBaseUrl,
      forcePathStyle: remoteState.connections.s3.forcePathStyle,
      secretAccessKey: "",
    });
  }, [remoteState.connections]);

  const workspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => ({
        value: workspace.isInbox ? INBOX_VALUE : workspace.id,
        label: workspace.isInbox ? strings.workspace.inbox : workspace.name,
      })),
    [strings.workspace.inbox, workspaces],
  );

  useEffect(() => {
    const key = selectedWorkspaceId ?? "inbox";
    setWorkspaceDraft(
      remoteState.workspaceSettings[key] || {
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
      },
    );
  }, [remoteState.workspaceSettings, selectedWorkspaceId]);

  const hasFailedJobs = remoteState.jobs.some((job) => job.status === "failed");
  const remoteEnabled = remoteState.connections.enabled;
  const controlsDisabled = !remoteEnabled;
  const openConflicts = remoteState.conflicts.filter((item) => item.status === "open");
  const activeJobs = remoteState.jobs.filter((job) => ["queued", "running", "failed"].includes(job.status));

  return (
    <div className="settings-pane">
      <div className="panel-heading settings-pane__header">
        <div>
          <p className="eyebrow">{strings.settings.remote}</p>
          <h4>{strings.remote.title}</h4>
        </div>
        <span className="settings-pane__spacer" aria-hidden="true" />
      </div>

      <div className="remote-settings-stack">
        <section className="settings-group remote-settings-card remote-settings-card--wide">
          <div className="panel-heading">
            <div className="settings-copy-block">
              <div className="remote-master-title">
                <span className="remote-master-icon">
                  <Cloud size={16} />
                  {remoteEnabled && !remoteState.summary.configured ? (
                    <AlertTriangle className="remote-master-warning" size={12} />
                  ) : null}
                </span>
                <div>
                  <p className="eyebrow">{strings.remote.title}</p>
                  <h4>{strings.settings.remote}</h4>
                </div>
              </div>
              <p className="settings-copy">
                {remoteEnabled ? strings.remote.masterHint : strings.remote.disabledHint}
              </p>
            </div>
            <span className="settings-autosave">
              {remoteEnabled ? strings.settings.yes : strings.settings.no}
            </span>
          </div>

          <div className="settings-row">
            <span>{strings.settings.remote}</span>
            <div className="segmented-control">
              {[true, false].map((value) => (
                <button
                  className={remoteEnabled === value ? "segmented-button is-active" : "segmented-button"}
                  key={`remote-${String(value)}`}
                  onClick={() => void onSaveConnections({ enabled: value })}
                  type="button"
                >
                  {value ? strings.settings.yes : strings.settings.no}
                </button>
              ))}
            </div>
          </div>
          <div className="remote-summary-grid remote-summary-grid--compact">
            <span className="inline-stat">
              <strong>{remoteState.summary.configured ? strings.remote.configured : strings.remote.notConfigured}</strong>
            </span>
            <span className="inline-stat">
              <strong>{activeJobs.length}</strong>
              {strings.remote.jobs}
            </span>
            <span className="inline-stat">
              <strong>{openConflicts.length}</strong>
              {strings.remote.conflicts}
            </span>
          </div>
        </section>

        <div
          aria-disabled={controlsDisabled}
          className={controlsDisabled ? "settings-grid remote-settings-grid is-disabled" : "settings-grid remote-settings-grid"}
        >
            <section className="settings-group remote-settings-card">
              <div className="panel-heading">
                <div className="settings-copy-block">
                  <p className="eyebrow">{strings.remote.webdav}</p>
                  <h4>{strings.remote.webdav}</h4>
                  <p className="settings-copy">{strings.remote.webdavHint}</p>
                </div>
                <button
                  className="glass-button"
                  disabled={controlsDisabled}
                  onClick={() =>
                    void onSaveConnections({
                      webdav: {
                        enabled: webdavDraft.enabled,
                        baseUrl: webdavDraft.baseUrl,
                        username: webdavDraft.username,
                        rootPath: webdavDraft.rootPath,
                        ...(webdavDraft.password ? { password: webdavDraft.password } : {}),
                      },
                    })
                  }
                  type="button"
                >
                  {strings.remote.saveConnection}
                </button>
              </div>

              <div className="settings-row">
                <span>{strings.settings.yes}</span>
                <div className="segmented-control">
                  {[true, false].map((value) => (
                    <button
                      className={webdavDraft.enabled === value ? "segmented-button is-active" : "segmented-button"}
                      disabled={controlsDisabled}
                      key={String(value)}
                      onClick={() => setWebdavDraft((current) => ({ ...current, enabled: value }))}
                      type="button"
                    >
                      {value ? strings.settings.yes : strings.settings.no}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-row settings-row--top">
                <span>{strings.settings.serverUrl}</span>
                <input
                  disabled={controlsDisabled}
                  onChange={(event) => setWebdavDraft((current) => ({ ...current, baseUrl: event.target.value }))}
                  placeholder="https://dav.example.com/remote.php/dav/files/user"
                  value={webdavDraft.baseUrl}
                />
              </div>
              <div className="settings-row">
                <span>{strings.settings.username}</span>
                <input
                  disabled={controlsDisabled}
                  onChange={(event) => setWebdavDraft((current) => ({ ...current, username: event.target.value }))}
                  value={webdavDraft.username}
                />
              </div>
              <div className="settings-row">
                <span>{strings.settings.password}</span>
                <input
                  disabled={controlsDisabled}
                  onChange={(event) => setWebdavDraft((current) => ({ ...current, password: event.target.value }))}
                  placeholder={
                    remoteState.connections.webdav.hasPassword ? "••••••••" : strings.settings.password
                  }
                  type="password"
                  value={webdavDraft.password}
                />
              </div>
              <div className="settings-row">
                <span>{strings.settings.remoteFolder}</span>
                <input
                  disabled={controlsDisabled}
                  onChange={(event) => setWebdavDraft((current) => ({ ...current, rootPath: event.target.value }))}
                  value={webdavDraft.rootPath}
                />
              </div>
              <div className="settings-row settings-row--top">
                <span>{strings.remote.latestResult}</span>
                <div className="remote-inline-actions">
                  <button
                    className="ghost-button"
                    disabled={controlsDisabled}
                    onClick={() =>
                      void onTestConnection("webdav", {
                        webdav: {
                          enabled: webdavDraft.enabled,
                          baseUrl: webdavDraft.baseUrl,
                          username: webdavDraft.username,
                          rootPath: webdavDraft.rootPath,
                          ...(webdavDraft.password ? { password: webdavDraft.password } : {}),
                        },
                      })
                    }
                    type="button"
                  >
                    {strings.settings.test}
                  </button>
                  <span className="settings-autosave remote-result">
                    {remoteState.connections.webdav.lastTestMessage || strings.remote.none}
                  </span>
                </div>
              </div>
            </section>

            <section className="settings-group remote-settings-card">
              <div className="panel-heading">
                <div className="settings-copy-block">
                  <p className="eyebrow">{strings.remote.s3}</p>
                  <h4>{strings.remote.s3}</h4>
                  <p className="settings-copy">{strings.remote.s3Hint}</p>
                </div>
                <button
                  className="glass-button"
                  disabled={controlsDisabled}
                  onClick={() =>
                    void onSaveConnections({
                      s3: {
                        enabled: s3Draft.enabled,
                        endpoint: s3Draft.endpoint,
                        region: s3Draft.region,
                        bucket: s3Draft.bucket,
                        accessKeyId: s3Draft.accessKeyId,
                        publicBaseUrl: s3Draft.publicBaseUrl,
                        forcePathStyle: s3Draft.forcePathStyle,
                        ...(s3Draft.secretAccessKey ? { secretAccessKey: s3Draft.secretAccessKey } : {}),
                      },
                    })
                  }
                  type="button"
                >
                  {strings.remote.saveConnection}
                </button>
              </div>

              <div className="settings-row">
                <span>{strings.settings.yes}</span>
                <div className="segmented-control">
                  {[true, false].map((value) => (
                    <button
                      className={s3Draft.enabled === value ? "segmented-button is-active" : "segmented-button"}
                      disabled={controlsDisabled}
                      key={String(value)}
                      onClick={() => setS3Draft((current) => ({ ...current, enabled: value }))}
                      type="button"
                    >
                      {value ? strings.settings.yes : strings.settings.no}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-row">
                <span>{strings.settings.endpoint}</span>
                <input
                  disabled={controlsDisabled}
                  onChange={(event) => setS3Draft((current) => ({ ...current, endpoint: event.target.value }))}
                  value={s3Draft.endpoint}
                />
              </div>
              <div className="settings-row">
                <span>{strings.settings.region}</span>
                <input
                  disabled={controlsDisabled}
                  onChange={(event) => setS3Draft((current) => ({ ...current, region: event.target.value }))}
                  value={s3Draft.region}
                />
              </div>
              <div className="settings-row">
                <span>{strings.settings.bucket}</span>
                <input
                  disabled={controlsDisabled}
                  onChange={(event) => setS3Draft((current) => ({ ...current, bucket: event.target.value }))}
                  value={s3Draft.bucket}
                />
              </div>
              <div className="settings-row">
                <span>{strings.settings.accessKeyId}</span>
                <input
                  disabled={controlsDisabled}
                  onChange={(event) => setS3Draft((current) => ({ ...current, accessKeyId: event.target.value }))}
                  value={s3Draft.accessKeyId}
                />
              </div>
              <div className="settings-row">
                <span>{strings.settings.secretAccessKey}</span>
                <input
                  disabled={controlsDisabled}
                  onChange={(event) => setS3Draft((current) => ({ ...current, secretAccessKey: event.target.value }))}
                  placeholder={
                    remoteState.connections.s3.hasSecretAccessKey ? "••••••••" : strings.settings.secretAccessKey
                  }
                  type="password"
                  value={s3Draft.secretAccessKey}
                />
              </div>
              <div className="settings-row">
                <span>{strings.settings.publicBaseUrl}</span>
                <input
                  disabled={controlsDisabled}
                  onChange={(event) => setS3Draft((current) => ({ ...current, publicBaseUrl: event.target.value }))}
                  value={s3Draft.publicBaseUrl}
                />
              </div>
              <div className="settings-row">
                <span>{strings.settings.forcePathStyle}</span>
                <div className="segmented-control">
                  {[true, false].map((value) => (
                    <button
                      className={s3Draft.forcePathStyle === value ? "segmented-button is-active" : "segmented-button"}
                      disabled={controlsDisabled}
                      key={String(value)}
                      onClick={() => setS3Draft((current) => ({ ...current, forcePathStyle: value }))}
                      type="button"
                    >
                      {value ? strings.settings.yes : strings.settings.no}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-row settings-row--top">
                <span>{strings.remote.latestResult}</span>
                <div className="remote-inline-actions">
                  <button
                    className="ghost-button"
                    disabled={controlsDisabled}
                    onClick={() =>
                      void onTestConnection("s3", {
                        s3: {
                          enabled: s3Draft.enabled,
                          endpoint: s3Draft.endpoint,
                          region: s3Draft.region,
                          bucket: s3Draft.bucket,
                          accessKeyId: s3Draft.accessKeyId,
                          publicBaseUrl: s3Draft.publicBaseUrl,
                          forcePathStyle: s3Draft.forcePathStyle,
                          ...(s3Draft.secretAccessKey ? { secretAccessKey: s3Draft.secretAccessKey } : {}),
                        },
                      })
                    }
                    type="button"
                  >
                    {strings.settings.test}
                  </button>
                  <span className="settings-autosave remote-result">
                    {remoteState.connections.s3.lastTestMessage || strings.remote.none}
                  </span>
                </div>
              </div>
            </section>

            <section className="settings-group remote-settings-card remote-settings-card--wide">
              <div className="panel-heading">
                <div className="settings-copy-block">
                  <p className="eyebrow">{strings.remote.workspace}</p>
                  <h4>{strings.remote.workspace}</h4>
                  <p className="settings-copy">{strings.remote.workspaceHint}</p>
                </div>
                <button
                  className="ghost-button"
                  disabled={controlsDisabled}
                  onClick={() => void onRunWorkspaceSync(selectedWorkspaceId)}
                  type="button"
                >
                  {strings.captures.syncNow}
                </button>
              </div>

              <div className="settings-row">
                <span>{strings.settings.workspaceBinding}</span>
                <select
                  disabled={controlsDisabled}
                  onChange={(event) =>
                    setSelectedWorkspaceId(event.target.value === INBOX_VALUE ? null : event.target.value)
                  }
                  value={selectedWorkspaceId ?? INBOX_VALUE}
                >
                  {workspaceOptions.map((workspace) => (
                    <option key={workspace.value} value={workspace.value}>
                      {workspace.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="settings-row">
                <span>{strings.remote.webdav}</span>
                <div className="segmented-control">
                  {[true, false].map((value) => (
                    <button
                      className={workspaceDraft.webdavEnabled === value ? "segmented-button is-active" : "segmented-button"}
                      disabled={controlsDisabled}
                      key={`webdav-${String(value)}`}
                      onClick={() => void onSaveWorkspaceSettings(selectedWorkspaceId, { webdavEnabled: value })}
                      type="button"
                    >
                      {value ? strings.settings.yes : strings.settings.no}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-row">
                <span>{strings.settings.remoteFolder}</span>
                <input
                  disabled={controlsDisabled}
                  onChange={(event) => setWorkspaceDraft((current) => ({ ...current, webdavPath: event.target.value }))}
                  onBlur={() =>
                    void onSaveWorkspaceSettings(selectedWorkspaceId, { webdavPath: workspaceDraft.webdavPath })
                  }
                  value={workspaceDraft.webdavPath}
                />
              </div>
              <div className="settings-row">
                <span>{strings.remote.s3}</span>
                <div className="segmented-control">
                  {[true, false].map((value) => (
                    <button
                      className={workspaceDraft.s3Enabled === value ? "segmented-button is-active" : "segmented-button"}
                      disabled={controlsDisabled}
                      key={`s3-${String(value)}`}
                      onClick={() => void onSaveWorkspaceSettings(selectedWorkspaceId, { s3Enabled: value })}
                      type="button"
                    >
                      {value ? strings.settings.yes : strings.settings.no}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-row">
                <span>{strings.settings.publishPrefix}</span>
                <input
                  disabled={controlsDisabled}
                  onChange={(event) => setWorkspaceDraft((current) => ({ ...current, s3Prefix: event.target.value }))}
                  onBlur={() => void onSaveWorkspaceSettings(selectedWorkspaceId, { s3Prefix: workspaceDraft.s3Prefix })}
                  value={workspaceDraft.s3Prefix}
                />
              </div>
              <div className="settings-row settings-row--top">
                <span>{strings.remote.summary}</span>
                <div className="remote-summary-grid">
                  <span className="settings-autosave">
                    {strings.remoteSyncStatuses[workspaceDraft.lastSyncStatus]}
                  </span>
                  <span className="settings-autosave">
                    {strings.remotePublishStatuses[workspaceDraft.lastPublishStatus]}
                  </span>
                  <span className="settings-autosave">
                    {workspaceDraft.lastSyncMessage || workspaceDraft.lastPublishMessage || strings.remote.none}
                  </span>
                </div>
              </div>
            </section>

            <section className="settings-group remote-settings-card remote-settings-card--wide">
              <div className="panel-heading">
                <div className="settings-copy-block">
                  <p className="eyebrow">{strings.remote.summary}</p>
                  <h4>{strings.remote.summary}</h4>
                  <p className="settings-copy">{strings.remote.summaryHint}</p>
                </div>
                {hasFailedJobs ? (
                  <button className="ghost-button" disabled={controlsDisabled} onClick={() => void onRetryJobs()} type="button">
                    {strings.settings.retryFailed}
                  </button>
                ) : null}
              </div>

              <div className="remote-summary-grid remote-summary-grid--compact">
                <span className="inline-stat">
                  <strong>{remoteState.summary.configured ? strings.remote.configured : strings.remote.notConfigured}</strong>
                </span>
                <span className="inline-stat">
                  <strong>{activeJobs.length}</strong>
                  {strings.remote.jobs}
                </span>
                <span className="inline-stat">
                  <strong>{openConflicts.length}</strong>
                  {strings.remote.conflicts}
                </span>
              </div>

              <div className="remote-job-list">
                {remoteState.jobs.slice(0, 6).map((job) => (
                  <div className="version-row" key={job.id}>
                    <strong>{job.kind}</strong>
                    <span>{job.status}</span>
                  </div>
                ))}
                {remoteState.jobs.length === 0 ? (
                  <div className="empty-state compact">
                    <p>{strings.remote.none}</p>
                  </div>
                ) : null}
              </div>

              <div className="remote-conflict-list">
                {remoteState.conflicts.slice(0, 4).map((conflict) => (
                  <div className="tag-editor-row" key={conflict.id}>
                    <div className="workspace-copy">
                      <strong>{conflict.relativePath}</strong>
                      <p>{new Date(conflict.createdAt).toLocaleString()}</p>
                    </div>
                    <button
                      className="segmented-button"
                      disabled={controlsDisabled}
                      onClick={() => void onResolveConflict(conflict.id, "keepLocal")}
                      type="button"
                    >
                      {strings.remote.resolveKeep}
                    </button>
                    <button
                      className="segmented-button"
                      disabled={controlsDisabled}
                      onClick={() => void onResolveConflict(conflict.id, "useIncoming")}
                      type="button"
                    >
                      {strings.remote.resolveIncoming}
                    </button>
                  </div>
                ))}
                {remoteState.conflicts.length === 0 ? (
                  <div className="empty-state compact">
                    <p>{strings.remote.none}</p>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
      </div>
    </div>
  );
}
