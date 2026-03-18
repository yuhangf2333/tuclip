import { Minus, Plus, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ShortcutSettings } from "./ShortcutSettings";
import { RemoteSettingsPanel } from "./RemoteSettingsPanel";
import type { UiStrings } from "../lib/i18n";
import type {
  AccentTheme,
  CloseAction,
  PreferencesConfig,
  QuickTag,
  RemoteConnectionConfig,
  RemoteProvider,
  RemoteStatePayload,
  ShortcutConfig,
  ThemeMode,
  SyncConflict,
  Workspace,
  WorkspaceRemoteSettings,
} from "../types/app";

interface PreferencesPanelProps {
  preferences: PreferencesConfig;
  shortcuts: ShortcutConfig;
  strings: UiStrings;
  tags: QuickTag[];
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  remoteState: RemoteStatePayload;
  onChange: (next: PreferencesConfig) => Promise<void>;
  onSaveShortcuts: (shortcuts: ShortcutConfig) => Promise<void>;
  onSaveTags: (tags: QuickTag[]) => Promise<void>;
  onSaveRemoteConnections: (patch: {
    enabled?: boolean;
    webdav?: Partial<RemoteConnectionConfig["webdav"]> & { password?: string };
    s3?: Partial<RemoteConnectionConfig["s3"]> & { secretAccessKey?: string };
  }) => Promise<void>;
  onTestRemoteConnection: (
    provider: RemoteProvider,
    patch?: {
      webdav?: Partial<RemoteConnectionConfig["webdav"]> & { password?: string };
      s3?: Partial<RemoteConnectionConfig["s3"]> & { secretAccessKey?: string };
    },
  ) => Promise<void>;
  onSaveWorkspaceRemoteSettings: (
    workspaceId: string | null,
    patch: Partial<WorkspaceRemoteSettings>,
  ) => Promise<void>;
  onRunWorkspaceSync: (workspaceId: string | null) => Promise<void>;
  onRetryRemoteJobs: () => Promise<void>;
  onResolveSyncConflict: (
    conflictId: string,
    action: "resolved" | "useIncoming" | "keepLocal",
  ) => Promise<SyncConflict | void>;
}

const durationOptions = [4, 6, 8, 10];
const themeOptions: ThemeMode[] = ["system", "light", "dark"];
const accentOptions: AccentTheme[] = ["blue", "graphite", "mint", "rose", "custom"];
const closeActionOptions: CloseAction[] = ["tray", "quit"];
const tagColors = ["#0f6cbd", "#0f9f6e", "#d94873", "#64748b", "#8b5cf6", "#f59e0b"];

type SettingsTab = "general" | "tags" | "shortcuts" | "remote";

export function PreferencesPanel({
  preferences,
  shortcuts,
  strings,
  tags,
  workspaces,
  activeWorkspaceId,
  remoteState,
  onChange,
  onSaveShortcuts,
  onSaveTags,
  onSaveRemoteConnections,
  onTestRemoteConnection,
  onSaveWorkspaceRemoteSettings,
  onRunWorkspaceSync,
  onRetryRemoteJobs,
  onResolveSyncConflict,
}: PreferencesPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const contentRef = useRef<HTMLDivElement | null>(null);

  const savePatch = async (patch: Partial<PreferencesConfig>) => {
    await onChange({
      ...preferences,
      ...patch,
    });
  };

  const shiftDuration = async (delta: number) => {
    await savePatch({
      popupDurationSeconds: Math.max(3, Math.min(12, preferences.popupDurationSeconds + delta)),
    });
  };

  const updateCustomAccent = async (customAccentColor: string) => {
    await savePatch({
      accentTheme: "custom",
      customAccentColor,
    });
  };

  const workspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => ({
        id: workspace.isInbox ? "" : workspace.id,
        label: workspace.isInbox ? strings.settings.inboxTarget : workspace.name,
      })),
    [strings.settings.inboxTarget, workspaces],
  );

  const saveTags = async (nextTags: QuickTag[]) => {
    await onSaveTags(nextTags);
  };

  const updateTag = async (tagId: string, patch: Partial<QuickTag>) => {
    await saveTags(
      tags.map((tag) =>
        tag.id === tagId
          ? {
              ...tag,
              ...patch,
            }
          : tag,
      ),
    );
  };

  const addTag = async () => {
    const color = tagColors[tags.length % tagColors.length];
    await saveTags([
      ...tags,
      {
        id: crypto.randomUUID(),
        label: `${strings.settings.tags} ${tags.length + 1}`,
        color,
        workspaceId: null,
        visible: true,
      },
    ]);
  };

  const deleteTag = async (tagId: string) => {
    await saveTags(tags.filter((tag) => tag.id !== tagId));
  };

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  return (
    <section className="glass-card settings-card">
      <div className="settings-toolbar">
        <span className="settings-autosave">{strings.settings.autoSaved}</span>
      </div>

      <div className="settings-shell">
        <nav className="settings-nav">
          {([
            ["general", strings.settings.general],
            ["tags", strings.settings.tags],
            ["shortcuts", strings.settings.shortcuts],
            ["remote", strings.settings.remote],
          ] as Array<[SettingsTab, string]>).map(([tabKey, label]) => (
            <button
              className={activeTab === tabKey ? "settings-nav__button is-active" : "settings-nav__button"}
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="settings-content" ref={contentRef}>
          {activeTab === "general" ? (
            <div className="settings-pane">
              <div className="panel-heading settings-pane__header">
                <div>
                  <p className="eyebrow">{strings.settings.general}</p>
                  <h4>{strings.settings.general}</h4>
                </div>
                <span className="settings-pane__spacer" aria-hidden="true" />
              </div>

              <div className="settings-grid">
                <section className="settings-group">
                  <p className="eyebrow">{strings.settings.display}</p>

                  <div className="settings-row">
                    <span>{strings.settings.language}</span>
                    <div className="segmented-control">
                      {(["en", "zh"] as const).map((language) => (
                        <button
                          className={
                            preferences.language === language
                              ? "segmented-button is-active"
                              : "segmented-button"
                          }
                          key={language}
                          onClick={() => void savePatch({ language })}
                          type="button"
                        >
                          {strings.languages[language]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-row">
                    <span>{strings.settings.theme}</span>
                    <div className="segmented-control">
                      {themeOptions.map((theme) => (
                        <button
                          className={
                            preferences.themeMode === theme
                              ? "segmented-button is-active"
                              : "segmented-button"
                          }
                          key={theme}
                          onClick={() => void savePatch({ themeMode: theme })}
                          type="button"
                        >
                          {strings.themes[theme]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-row settings-row--top">
                    <span>{strings.settings.accent}</span>
                    <div className="swatch-list swatch-list--with-custom">
                      {accentOptions.map((accent) =>
                        accent === "custom" ? (
                          <label
                            className={
                              preferences.accentTheme === "custom"
                                ? "swatch-button swatch-custom-picker is-active"
                                : "swatch-button swatch-custom-picker"
                            }
                            key={accent}
                            onClick={() => void savePatch({ accentTheme: "custom" })}
                            title={strings.accents[accent]}
                          >
                            <span
                              className="swatch-dot swatch-dot--custom"
                              style={{ "--swatch-custom-color": preferences.customAccentColor } as CSSProperties}
                            />
                            <span>{strings.accents[accent]}</span>
                            <input
                              aria-label={strings.settings.customAccent}
                              onChange={(event) => void updateCustomAccent(event.target.value)}
                              type="color"
                              value={preferences.customAccentColor}
                            />
                          </label>
                        ) : (
                          <button
                            className={
                              preferences.accentTheme === accent
                                ? "swatch-button is-active"
                                : "swatch-button"
                            }
                            key={accent}
                            onClick={() => void savePatch({ accentTheme: accent })}
                            title={strings.accents[accent]}
                            type="button"
                          >
                            <span className={`swatch-dot swatch-dot--${accent}`} />
                            <span>{strings.accents[accent]}</span>
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </section>

                <section className="settings-group">
                  <p className="eyebrow">{strings.settings.capture}</p>

                  <div className="settings-row">
                    <span>{strings.settings.popupTime}</span>
                    <div className="stepper-control">
                      <button className="icon-button subtle" onClick={() => void shiftDuration(-1)} type="button">
                        <Minus size={14} />
                      </button>
                      <span className="stepper-value">{preferences.popupDurationSeconds}s</span>
                      <button className="icon-button subtle" onClick={() => void shiftDuration(1)} type="button">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="settings-row settings-row--top">
                    <span>{strings.settings.popupTime}</span>
                    <div className="duration-chip-list">
                      {durationOptions.map((seconds) => (
                        <button
                          className={
                            preferences.popupDurationSeconds === seconds
                              ? "duration-chip is-active"
                              : "duration-chip"
                          }
                          key={seconds}
                          onClick={() => void savePatch({ popupDurationSeconds: seconds })}
                          type="button"
                        >
                          {seconds}s
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-row">
                    <span>{strings.settings.extendPopup}</span>
                    <div className="segmented-control">
                      {[true, false].map((value) => (
                        <button
                          className={
                            preferences.extendPopupOnInteraction === value
                              ? "segmented-button is-active"
                              : "segmented-button"
                          }
                          key={String(value)}
                          onClick={() => void savePatch({ extendPopupOnInteraction: value })}
                          type="button"
                        >
                          {value ? strings.settings.yes : strings.settings.no}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-row">
                    <span>{strings.settings.showWorkspaceTags}</span>
                    <div className="segmented-control">
                      {[true, false].map((value) => (
                        <button
                          className={
                            preferences.showWorkspaceTags === value
                              ? "segmented-button is-active"
                              : "segmented-button"
                          }
                          key={String(value)}
                          onClick={() => void savePatch({ showWorkspaceTags: value })}
                          type="button"
                        >
                          {value ? strings.settings.yes : strings.settings.no}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-row">
                    <span>{strings.settings.closeAction}</span>
                    <div className="segmented-control">
                      {closeActionOptions.map((value) => (
                        <button
                          className={
                            preferences.closeAction === value
                              ? "segmented-button is-active"
                              : "segmented-button"
                          }
                          key={value}
                          onClick={() => void savePatch({ closeAction: value })}
                          type="button"
                        >
                          {strings.settings.closeActions[value]}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {activeTab === "tags" ? (
            <div className="settings-pane">
              <section className="settings-group">
                <div className="panel-heading settings-pane__header">
                  <div>
                    <p className="eyebrow">{strings.settings.tags}</p>
                    <h4>{strings.settings.tags}</h4>
                  </div>
                  <button className="glass-button" onClick={() => void addTag()} type="button">
                    {strings.settings.addTag}
                  </button>
                </div>

                <div className="settings-pane__body">
                  {tags.length === 0 ? (
                    <div className="empty-state compact">
                      <p>{strings.settings.addTag}</p>
                    </div>
                  ) : (
                    <div className="tag-editor-list">
                      {tags.map((tag) => (
                        <div className="tag-editor-row" key={tag.id}>
                          <div className="tag-chip-preview">
                            <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
                            <input
                              onChange={(event) => void updateTag(tag.id, { label: event.target.value })}
                              value={tag.label}
                            />
                          </div>

                          <input
                            aria-label={`${tag.label} color`}
                            onChange={(event) => void updateTag(tag.id, { color: event.target.value })}
                            type="color"
                            value={tag.color}
                          />

                          <select
                            onChange={(event) =>
                              void updateTag(tag.id, { workspaceId: event.target.value || null })
                            }
                            value={tag.workspaceId ?? ""}
                          >
                            {workspaceOptions.map((workspace) => (
                              <option key={workspace.id || "inbox"} value={workspace.id}>
                                {workspace.label}
                              </option>
                            ))}
                          </select>

                          <button
                            className={tag.visible ? "segmented-button is-active" : "segmented-button"}
                            onClick={() => void updateTag(tag.id, { visible: !tag.visible })}
                            type="button"
                          >
                            {tag.visible ? strings.settings.yes : strings.settings.no}
                          </button>

                          <button
                            className="icon-button subtle danger"
                            onClick={() => void deleteTag(tag.id)}
                            title={strings.settings.deleteTag}
                            type="button"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === "shortcuts" ? (
            <div className="settings-pane settings-pane--shortcut">
              <ShortcutSettings
                embedded
                onSave={onSaveShortcuts}
                shortcuts={shortcuts}
                strings={strings}
              />
            </div>
          ) : null}

          {activeTab === "remote" ? (
            <RemoteSettingsPanel
              activeWorkspaceId={activeWorkspaceId}
              onResolveConflict={onResolveSyncConflict}
              onRetryJobs={onRetryRemoteJobs}
              onRunWorkspaceSync={onRunWorkspaceSync}
              onSaveConnections={onSaveRemoteConnections}
              onSaveWorkspaceSettings={onSaveWorkspaceRemoteSettings}
              onTestConnection={onTestRemoteConnection}
              remoteState={remoteState}
              strings={strings}
              workspaces={workspaces}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
