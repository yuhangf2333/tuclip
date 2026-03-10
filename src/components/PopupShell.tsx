import { PencilLine, Save, StickyNote, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "../lib/api";
import type { UiStrings } from "../lib/i18n";
import { formatShortcut, matchesShortcut } from "../lib/shortcuts";
import type { AppStatePayload, PendingCapture, Workspace } from "../types/app";

interface PopupShellProps {
  appState: AppStatePayload | null;
  pendingCaptures: PendingCapture[];
  workspaces: Workspace[];
  onSave: (pendingId: string, annotate: boolean) => Promise<void>;
  onDiscard: (pendingId: string) => Promise<void>;
  strings: UiStrings;
}

export function PopupShell({
  appState,
  pendingCaptures,
  workspaces,
  onSave,
  onDiscard,
  strings,
}: PopupShellProps) {
  const pending = pendingCaptures[0] ?? null;
  const [now, setNow] = useState(Date.now());
  const [expiresAt, setExpiresAt] = useState<string | null>(pending?.expiresAt ?? null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(pending?.selectedTagId ?? null);
  const [note, setNote] = useState(pending?.note ?? "");
  const [showNoteEditor, setShowNoteEditor] = useState(Boolean(pending?.note));
  const lastExtendAt = useRef(0);
  const noteSaveTimer = useRef<number | null>(null);
  const shortcuts = useMemo(() => appState?.shortcuts ?? null, [appState]);
  const popupDurationMs = Number(appState?.preferences?.popupDurationSeconds ?? 6) * 1000;
  const tags = useMemo(() => (appState?.tags ?? []).filter((tag) => tag.visible !== false), [appState?.tags]);
  const selectedTag = tags.find((tag) => tag.id === selectedTagId) ?? null;
  const targetWorkspace = workspaces.find((workspace) =>
    workspace.isInbox
      ? (selectedTag?.workspaceId ?? pending?.workspaceHintId ?? null) === null
      : workspace.id === (selectedTag?.workspaceId ?? pending?.workspaceHintId),
  );

  const shortcutHint = useMemo(() => {
    if (!shortcuts) {
      return "";
    }

    return [
      `${formatShortcut(shortcuts.quickSavePending)} ${strings.popup.save}`,
      `${formatShortcut(shortcuts.quickAnnotatePending)} ${strings.popup.edit}`,
      `${formatShortcut(shortcuts.dismissPopup)} ${strings.popup.skip}`,
    ].join(" · ");
  }, [shortcuts, strings.popup.edit, strings.popup.save, strings.popup.skip]);

  useEffect(() => {
    setExpiresAt(pending?.expiresAt ?? null);
    setSelectedTagId(pending?.selectedTagId ?? null);
  }, [pending?.expiresAt, pending?.id, pending?.selectedTagId]);

  useEffect(() => {
    setNote(pending?.note ?? "");
    setShowNoteEditor(Boolean(pending?.note));
  }, [pending?.id]);

  useEffect(() => {
    return () => {
      if (noteSaveTimer.current) {
        window.clearTimeout(noteSaveTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!pending || !shortcuts) {
        return;
      }

      if (matchesShortcut(event, shortcuts.quickSavePending)) {
        event.preventDefault();
        void (async () => {
          await persistPendingNote();
          await onSave(pending.id, false);
        })();
      } else if (matchesShortcut(event, shortcuts.quickAnnotatePending)) {
        event.preventDefault();
        void (async () => {
          await persistPendingNote();
          await onSave(pending.id, true);
        })();
      } else if (matchesShortcut(event, shortcuts.dismissPopup)) {
        event.preventDefault();
        void onDiscard(pending.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [note, onDiscard, onSave, pending, shortcuts]);

  useEffect(() => {
    if (!pending) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 120);
    return () => window.clearInterval(timer);
  }, [pending?.id]);

  const handleInteraction = async () => {
    if (!pending) {
      return;
    }
    if (!appState?.preferences?.extendPopupOnInteraction) {
      return;
    }
    const nextTick = Date.now();
    if (nextTick - lastExtendAt.current < 700) {
      return;
    }
    lastExtendAt.current = nextTick;
    const updated = await api.extendPopupCountdown();
    if (updated?.id === pending.id) {
      setExpiresAt(updated.expiresAt);
    }
  };

  const handleSelectTag = async (tagId: string | null) => {
    if (!pending) {
      return;
    }
    setSelectedTagId(tagId);
    await api.selectPendingTag(pending.id, tagId);
  };

  const persistPendingNote = async () => {
    if (!pending || note === (pending.note ?? "")) {
      return;
    }
    if (noteSaveTimer.current) {
      window.clearTimeout(noteSaveTimer.current);
      noteSaveTimer.current = null;
    }
    await api.updatePendingNote(pending.id, note);
  };

  const handleNoteChange = (value: string) => {
    setNote(value);
    if (!pending) {
      return;
    }
    if (noteSaveTimer.current) {
      window.clearTimeout(noteSaveTimer.current);
    }
    noteSaveTimer.current = window.setTimeout(() => {
      void api.updatePendingNote(pending.id, value);
    }, 220);
  };

  const toggleNoteEditor = () => {
    if (showNoteEditor) {
      void persistPendingNote();
    }
    setShowNoteEditor((current) => !current);
  };

  const remainingMs = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0;
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const progress = popupDurationMs > 0 ? Math.max(0, Math.min(1, remainingMs / popupDurationMs)) : 0;

  if (!pending) {
    return (
      <main className="popup-shell">
        <div className="glass-card popup-card empty-popup">
          <p className="eyebrow">{strings.popup.eyebrow}</p>
          <h3>{strings.popup.idleTitle}</h3>
          <p>{strings.popup.idleHint}</p>
          <button className="ghost-button" onClick={() => void api.hideCurrentWindow()} type="button">
            {strings.popup.hide}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="popup-shell">
      <div
        className="glass-card popup-card"
        onClick={() => void handleInteraction()}
        onMouseDown={() => void handleInteraction()}
        onMouseEnter={() => void handleInteraction()}
        onMouseMove={() => void handleInteraction()}
      >
        <div className="popup-topbar">
          <div className="popup-copy">
            <p className="eyebrow">{strings.popup.eyebrow}</p>
            <h3>{strings.popup.ready}</h3>
          </div>
          <span className="popup-countdown">{remainingSeconds}s</span>
        </div>

        <div className="popup-card__preview">
          <img alt="Pending capture preview" src={api.fileUrl(pending.tempPath)} />
        </div>

        {tags.length ? (
          <div className="popup-tag-block">
            <p className="eyebrow">{strings.popup.tags}</p>
            <div className="popup-tag-list">
              {tags.map((tag) => (
                <button
                  className={selectedTagId === tag.id ? "workspace-tag-chip popup is-active" : "workspace-tag-chip popup"}
                  key={tag.id}
                  onClick={() => void handleSelectTag(tag.id)}
                  type="button"
                >
                  <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="popup-meta-row">
          <div className="popup-target-line">
            <span>{strings.popup.target}</span>
            <strong>{targetWorkspace?.isInbox ? strings.workspace.inbox : targetWorkspace?.name ?? strings.workspace.inbox}</strong>
          </div>
          <button
            className={showNoteEditor || note ? "ghost-button popup-note-toggle is-active" : "ghost-button popup-note-toggle"}
            onClick={toggleNoteEditor}
            type="button"
          >
            <StickyNote size={14} />
            <span>{strings.popup.note}</span>
          </button>
        </div>

        {showNoteEditor ? (
          <div className="popup-note-block">
            <textarea
              onBlur={() => void persistPendingNote()}
              onChange={(event) => handleNoteChange(event.target.value)}
              placeholder={strings.popup.notePlaceholder}
              rows={2}
              value={note}
            />
          </div>
        ) : note ? (
          <p className="popup-note-preview">{note}</p>
        ) : null}

        <div className="popup-actions">
          <button
            className="ghost-button"
            onClick={() => {
              void (async () => {
                await persistPendingNote();
                await onSave(pending.id, false);
              })();
            }}
            type="button"
          >
            <Save size={16} />
            <span>{strings.popup.save}</span>
          </button>
          <button
            className="glass-button"
            onClick={() => {
              void (async () => {
                await persistPendingNote();
                await onSave(pending.id, true);
              })();
            }}
            type="button"
          >
            <PencilLine size={16} />
            <span>{strings.popup.edit}</span>
          </button>
          <button className="ghost-button danger" onClick={() => void onDiscard(pending.id)} type="button">
            <X size={16} />
            <span>{strings.popup.skip}</span>
          </button>
        </div>

        {shortcutHint ? <p className="popup-hint">{shortcutHint}</p> : null}
        <div className="popup-progress" role="presentation">
          <div className="popup-progress__bar" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
    </main>
  );
}
