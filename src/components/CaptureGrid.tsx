import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, PencilLine } from "lucide-react";

import { api } from "../lib/api";
import { buildCaptureTagGroups } from "../lib/capture-groups";
import { statusLabel, type UiStrings } from "../lib/i18n";
import type { CaptureItem, WorkspaceTag } from "../types/app";

interface CaptureGridProps {
  captures: CaptureItem[];
  selectedCaptureId: string | null;
  onOpenCapture: (captureId: string) => Promise<void>;
  onPublishCapture: (captureId: string, workspaceId: string | null) => Promise<void>;
  onCopyRemoteUrl: (captureId: string, workspaceId: string | null) => Promise<void>;
  onOpenRemoteUrl: (captureId: string, workspaceId: string | null) => Promise<void>;
  onReorder: (captureId: string, direction: -1 | 1) => Promise<void>;
  publishEnabled: boolean;
  publishDisabledReason: string;
  strings: UiStrings;
  tags: WorkspaceTag[];
  showTags: boolean;
}

type CaptureViewMode = "list" | "tags";

function fileNameFromPath(filePath: string) {
  return filePath.split(/[\\/]/).filter(Boolean).slice(-1)[0] ?? filePath;
}

export function CaptureGrid({
  captures,
  selectedCaptureId,
  onOpenCapture,
  onPublishCapture,
  onCopyRemoteUrl,
  onOpenRemoteUrl,
  onReorder,
  publishEnabled,
  publishDisabledReason,
  strings,
  tags,
  showTags,
}: CaptureGridProps) {
  const tagMap = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  );
  const allowTagMode = showTags && tags.length > 0;
  const [viewMode, setViewMode] = useState<CaptureViewMode>(allowTagMode ? "tags" : "list");
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const tagGroups = useMemo(
    () => buildCaptureTagGroups(captures, tags, true),
    [captures, tags],
  );

  useEffect(() => {
    setViewMode(allowTagMode ? "tags" : "list");
  }, [allowTagMode]);

  useEffect(() => {
    if (!allowTagMode && viewMode === "tags") {
      setViewMode("list");
    }
  }, [allowTagMode, viewMode]);

  useEffect(() => {
    if (!tagGroups.length) {
      setExpandedGroups([]);
      return;
    }
    setExpandedGroups((current) => {
      const next = current.filter((key) => tagGroups.some((group) => group.key === key));
      if (next.length > 0) {
        return next;
      }
      const withCaptures = tagGroups.find((group) => group.captures.length > 0);
      return [withCaptures?.key ?? tagGroups[0].key];
    });
  }, [tagGroups]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((current) =>
      current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey],
    );
  };

  const renderRow = (capture: CaptureItem, index: number, total: number, allowReorder = true) => {
    const tag = capture.tagId ? tagMap.get(capture.tagId) : null;
    const showInlineTag = showTags && tag && viewMode === "list";
    const publishLabel =
      capture.remote.publishStatus === "publishing"
        ? strings.captures.publishing
        : capture.remote.remoteUrl
          ? strings.captures.republish
          : strings.captures.publish;
    const publishDisabled = capture.remote.publishStatus === "publishing";

    return (
      <article
        className={capture.id === selectedCaptureId ? "capture-row is-selected" : "capture-row"}
        key={capture.id}
      >
        <img alt={`Capture ${capture.orderIndex}`} src={api.fileUrl(capture.publicPath)} />

        <div className="capture-row__body">
          <div className="capture-row__copy">
            <div className="capture-row__top">
              <strong>{fileNameFromPath(capture.publicPath)}</strong>
              <span className="capture-badge">#{capture.orderIndex}</span>
            </div>
            <p>{capture.publicPath}</p>
            {showInlineTag ? (
              <div className="capture-row__meta">
                <span className="workspace-tag-chip compact">
                  <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
                  {tag.label}
                </span>
              </div>
            ) : null}
            {capture.note ? <p className="capture-note">{capture.note}</p> : null}
          </div>

          <div className="capture-row__actions">
            <div className="capture-row__status-group">
              <span className="status-tag">{statusLabel(capture.status, strings)}</span>
              <span className="status-tag">{strings.remoteSyncStatuses[capture.remote.syncStatus]}</span>
              <span className="status-tag">{strings.remotePublishStatuses[capture.remote.publishStatus]}</span>
            </div>
            <div className="capture-row__controls">
              {allowReorder ? (
                <>
                  <button
                    className="icon-button subtle"
                    disabled={index === 0}
                    onClick={() => void onReorder(capture.id, -1)}
                    title={strings.captures.moveUp}
                    type="button"
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    className="icon-button subtle"
                    disabled={index === total - 1}
                    onClick={() => void onReorder(capture.id, 1)}
                    title={strings.captures.moveDown}
                    type="button"
                  >
                    <ArrowDown size={15} />
                  </button>
                </>
              ) : null}
              <button
                className="ghost-button"
                disabled={publishDisabled}
                onClick={() => void onPublishCapture(capture.id, capture.workspaceId === "inbox" ? null : capture.workspaceId)}
                title={publishDisabled ? publishLabel : publishEnabled ? publishLabel : publishDisabledReason}
                type="button"
              >
                {publishLabel}
              </button>
              {capture.remote.remoteUrl ? (
                <>
                  <button
                    className="ghost-button"
                    onClick={() => void onCopyRemoteUrl(capture.id, capture.workspaceId === "inbox" ? null : capture.workspaceId)}
                    type="button"
                  >
                    {strings.captures.copyLink}
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => void onOpenRemoteUrl(capture.id, capture.workspaceId === "inbox" ? null : capture.workspaceId)}
                    type="button"
                  >
                    {strings.captures.openRemote}
                  </button>
                </>
              ) : null}
              <button className="ghost-button" onClick={() => void onOpenCapture(capture.id)} type="button">
                <PencilLine size={15} />
                {strings.captures.edit}
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <section className="capture-pane glass-card">
      <div className="panel-heading capture-pane__header">
        <div>
          <p className="eyebrow">{strings.captures.eyebrow}</p>
          <h3>{strings.captures.title}</h3>
        </div>

        {allowTagMode ? (
          <div className="segmented-control capture-mode-toggle">
            <button
              className={viewMode === "list" ? "segmented-button is-active" : "segmented-button"}
              onClick={() => setViewMode("list")}
              type="button"
            >
              {strings.captures.byOrder}
            </button>
            <button
              className={viewMode === "tags" ? "segmented-button is-active" : "segmented-button"}
              onClick={() => setViewMode("tags")}
              type="button"
            >
              {strings.captures.byTag}
            </button>
          </div>
        ) : null}
      </div>

      {captures.length === 0 ? (
        <div className="empty-state compact">
          <p>{strings.captures.empty}</p>
        </div>
      ) : viewMode === "tags" && allowTagMode ? (
        <div className="capture-list capture-group-list">
          {tagGroups.map((group) => {
            const expanded = expandedGroups.includes(group.key);
            const label = group.isUntagged ? strings.captures.untagged : group.label;

            return (
              <section className="capture-group" key={group.key}>
                <button
                  className={expanded ? "capture-group__header is-expanded" : "capture-group__header"}
                  onClick={() => toggleGroup(group.key)}
                  type="button"
                >
                  <div className="capture-group__title">
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="workspace-tag-chip compact">
                      {group.color ? (
                        <span className="tag-chip-dot" style={{ backgroundColor: group.color }} />
                      ) : null}
                      {label}
                    </span>
                  </div>
                  <span className="section-count">{group.captures.length}</span>
                </button>

                {expanded ? (
                  <div className="capture-group__body">
                    {group.captures.length ? (
                      group.captures.map((capture) => renderRow(capture, 0, group.captures.length, false))
                    ) : (
                      <div className="empty-state compact capture-group__empty">
                        <p>{strings.captures.emptyTag}</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="capture-list">
          {captures.map((capture, index) => renderRow(capture, index, captures.length))}
        </div>
      )}
    </section>
  );
}
