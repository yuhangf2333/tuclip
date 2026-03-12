import { Clock4, PencilLine, Save, Trash2 } from "lucide-react";

import { api } from "../lib/api";
import type { UiStrings } from "../lib/i18n";
import type { PendingCapture, QuickTag, Workspace } from "../types/app";

interface PendingPanelProps {
  pendingCaptures: PendingCapture[];
  workspaces: Workspace[];
  tags: QuickTag[];
  activeWorkspaceId: string | null;
  onSave: (pendingId: string, annotate: boolean) => Promise<void>;
  onDiscard: (pendingId: string) => Promise<void>;
  strings: UiStrings;
}

export function PendingPanel({
  pendingCaptures,
  workspaces,
  tags,
  activeWorkspaceId,
  onSave,
  onDiscard,
  strings,
}: PendingPanelProps) {
  const fallbackWorkspace = workspaces.find((workspace) =>
    workspace.isInbox ? activeWorkspaceId === null : workspace.id === activeWorkspaceId,
  );

  return (
    <section className="utility-pane glass-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{strings.pending.eyebrow}</p>
          <h3>{strings.pending.title}</h3>
        </div>
        <span className="section-count">{pendingCaptures.length}</span>
      </div>

      {pendingCaptures.length === 0 ? (
        <div className="empty-state compact">
          <p>{strings.pending.empty}</p>
        </div>
      ) : (
        <div className="pending-list">
          {pendingCaptures.map((pending) => {
            const targetWorkspace =
              workspaces.find((workspace) =>
                workspace.isInbox ? pending.workspaceHintId === null : workspace.id === pending.workspaceHintId,
              ) ?? fallbackWorkspace;
            const selectedTag = tags.find((tag) => tag.id === pending.selectedTagId) ?? null;

            return (
              <article className="pending-row" key={pending.id}>
                <img alt="Pending capture preview" src={api.fileUrl(pending.tempPath)} />
                <div className="pending-row__body">
                  <strong>{targetWorkspace?.isInbox ? strings.workspace.inbox : targetWorkspace?.name ?? strings.workspace.inbox}</strong>
                  <p>{new Date(pending.detectedAt).toLocaleTimeString()}</p>
                  <div className="pending-row__meta">
                    <span>
                      <Clock4 size={13} />
                      {strings.pending.to} {targetWorkspace?.isInbox ? strings.workspace.inbox : targetWorkspace?.name ?? strings.workspace.inbox}
                    </span>
                    {selectedTag ? (
                      <span className="workspace-tag-chip compact">
                        <span className="tag-chip-dot" style={{ backgroundColor: selectedTag.color }} />
                        {selectedTag.label}
                      </span>
                    ) : null}
                  </div>
                  {pending.note ? <p className="capture-note">{pending.note}</p> : null}
                  <div className="pending-row__actions">
                    <div className="pending-row__action-group">
                      <button className="ghost-button" onClick={() => void onSave(pending.id, false)} type="button">
                        <Save size={15} />
                        {strings.pending.save}
                      </button>
                      <button className="ghost-button" onClick={() => void onSave(pending.id, true)} type="button">
                        <PencilLine size={15} />
                        {strings.pending.edit}
                      </button>
                    </div>
                    <button
                      aria-label={strings.pending.discard}
                      className="icon-button subtle danger pending-row__delete"
                      onClick={() => void onDiscard(pending.id)}
                      title={strings.pending.discard}
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
