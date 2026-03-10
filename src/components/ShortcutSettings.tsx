import { useEffect, useMemo, useState } from "react";

import { formatShortcut, normalizeShortcut, shortcutFromKeyboardEvent } from "../lib/shortcuts";
import type { UiStrings } from "../lib/i18n";
import type { ShortcutConfig } from "../types/app";

interface ShortcutSettingsProps {
  shortcuts: ShortcutConfig;
  onSave: (shortcuts: ShortcutConfig) => Promise<void>;
  strings: UiStrings;
  embedded?: boolean;
}

const shortcutGroups: Array<{ titleKey: "tools" | "editor" | "popup"; fields: Array<keyof ShortcutConfig> }> = [
  { titleKey: "tools", fields: ["rectTool", "numberTool", "textTool", "cropTool"] },
  { titleKey: "editor", fields: ["save", "cancel", "deleteSelection", "undo", "redo"] },
  {
    titleKey: "popup",
    fields: ["quickSavePending", "quickAnnotatePending", "dismissPopup", "toggleMonitoring"],
  },
];

type KeyboardKey = {
  id: string;
  label: string;
  width?: number;
};

const keyboardRows: KeyboardKey[][] = [
  [
    { id: "Escape", label: "Esc", width: 44 },
    { id: "F1", label: "F1", width: 30 },
    { id: "F2", label: "F2", width: 30 },
    { id: "F3", label: "F3", width: 30 },
    { id: "F4", label: "F4", width: 30 },
    { id: "F5", label: "F5", width: 30 },
    { id: "F6", label: "F6", width: 30 },
    { id: "F7", label: "F7", width: 30 },
    { id: "F8", label: "F8", width: 30 },
    { id: "F9", label: "F9", width: 30 },
    { id: "F10", label: "F10", width: 34 },
    { id: "F11", label: "F11", width: 34 },
    { id: "F12", label: "F12", width: 34 },
  ],
  [
    { id: "`", label: "`" },
    { id: "1", label: "1" },
    { id: "2", label: "2" },
    { id: "3", label: "3" },
    { id: "4", label: "4" },
    { id: "5", label: "5" },
    { id: "6", label: "6" },
    { id: "7", label: "7" },
    { id: "8", label: "8" },
    { id: "9", label: "9" },
    { id: "0", label: "0" },
    { id: "-", label: "-" },
    { id: "=", label: "=" },
    { id: "Backspace", label: "Backspace", width: 70 },
  ],
  [
    { id: "Tab", label: "Tab", width: 42 },
    { id: "Q", label: "Q" },
    { id: "W", label: "W" },
    { id: "E", label: "E" },
    { id: "R", label: "R" },
    { id: "T", label: "T" },
    { id: "Y", label: "Y" },
    { id: "U", label: "U" },
    { id: "I", label: "I" },
    { id: "O", label: "O" },
    { id: "P", label: "P" },
    { id: "[", label: "[" },
    { id: "]", label: "]" },
    { id: "\\", label: "\\", width: 42 },
  ],
  [
    { id: "Caps", label: "Caps", width: 52 },
    { id: "A", label: "A" },
    { id: "S", label: "S" },
    { id: "D", label: "D" },
    { id: "F", label: "F" },
    { id: "G", label: "G" },
    { id: "H", label: "H" },
    { id: "J", label: "J" },
    { id: "K", label: "K" },
    { id: "L", label: "L" },
    { id: ";", label: ";" },
    { id: "'", label: "'" },
    { id: "Enter", label: "Enter", width: 70 },
  ],
  [
    { id: "ShiftLeft", label: "Shift", width: 62 },
    { id: "Z", label: "Z" },
    { id: "X", label: "X" },
    { id: "C", label: "C" },
    { id: "V", label: "V" },
    { id: "B", label: "B" },
    { id: "N", label: "N" },
    { id: "M", label: "M" },
    { id: ",", label: "," },
    { id: ".", label: "." },
    { id: "/", label: "/" },
    { id: "ShiftRight", label: "Shift", width: 62 },
  ],
  [
    { id: "Fn", label: "Fn", width: 32 },
    { id: "Ctrl", label: "Ctrl", width: 40 },
    { id: "AltLeft", label: "Alt", width: 40 },
    { id: "CmdLeft", label: "Cmd", width: 44 },
    { id: "Space", label: "Space", width: 120 },
    { id: "CmdRight", label: "Cmd", width: 44 },
    { id: "AltRight", label: "Alt", width: 40 },
    { id: "←", label: "←" },
    { id: "↑", label: "↑" },
    { id: "↓", label: "↓" },
    { id: "→", label: "→" },
  ],
];

function shortcutToKeyboardKeys(shortcut: string) {
  return normalizeShortcut(shortcut)
    .split("+")
    .filter(Boolean)
    .flatMap((part) => {
      switch (part) {
        case "Mod":
          return navigator.platform.includes("Mac") ? ["CmdLeft"] : ["Ctrl"];
        case "Shift":
          return ["ShiftLeft"];
        case "Alt":
          return ["AltLeft"];
        case "ArrowUp":
          return ["↑"];
        case "ArrowDown":
          return ["↓"];
        case "ArrowLeft":
          return ["←"];
        case "ArrowRight":
          return ["→"];
        default:
          return [part];
      }
    });
}

export function ShortcutSettings({
  shortcuts,
  onSave,
  strings,
  embedded = false,
}: ShortcutSettingsProps) {
  const [draft, setDraft] = useState(shortcuts);
  const [recordingKey, setRecordingKey] = useState<keyof ShortcutConfig | null>(null);
  const [previewField, setPreviewField] = useState<keyof ShortcutConfig>("rectTool");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(shortcuts);
  }, [shortcuts]);

  useEffect(() => {
    if (!recordingKey) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      const value = shortcutFromKeyboardEvent(event);
      if (!value) {
        return;
      }
      setDraft((current) => ({ ...current, [recordingKey]: normalizeShortcut(value) }));
      setRecordingKey(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [recordingKey]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(shortcuts),
    [draft, shortcuts],
  );
  const activePreviewField = recordingKey ?? previewField;
  const previewKeys = useMemo(
    () => new Set(shortcutToKeyboardKeys(draft[activePreviewField])),
    [activePreviewField, draft],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  const groups = (
    <div className="shortcut-settings__main">
      <div className="shortcut-group-list">
        {shortcutGroups.map((group) => (
          <section className="shortcut-group-card" key={group.titleKey}>
            <div className="shortcut-group-card__header">
              <p className="eyebrow">{strings.settings[group.titleKey]}</p>
            </div>
            <div className="shortcut-list compact">
              {group.fields.map((fieldKey) => (
                <div className="shortcut-row compact" key={fieldKey}>
                  <strong>{strings.shortcutLabels[fieldKey]}</strong>
                  <button
                    className={recordingKey === fieldKey ? "shortcut-chip is-recording" : "shortcut-chip"}
                    onClick={() => {
                      setPreviewField(fieldKey);
                      setRecordingKey(fieldKey);
                    }}
                    onMouseEnter={() => setPreviewField(fieldKey)}
                    type="button"
                  >
                    {recordingKey === fieldKey
                      ? strings.settings.pressKeys
                      : formatShortcut(draft[fieldKey])}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );

  const keyboardPreview = (
    <aside className="keyboard-preview">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{strings.settings.shortcuts}</p>
          <h3>{strings.settings.shortcuts}</h3>
        </div>
        <button
          className="glass-button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          type="button"
        >
          {saving ? strings.settings.saving : strings.settings.saveKeys}
        </button>
      </div>
      <div className="keyboard-preview__header">
        <p className="eyebrow">{strings.shortcutLabels[activePreviewField]}</p>
        <strong>{formatShortcut(draft[activePreviewField])}</strong>
      </div>
      <div className="keyboard-preview__grid">
        {keyboardRows.map((row, index) => (
          <div className="keyboard-row" key={index}>
            {row.map((keyDef, keyIndex) => (
              <span
                className={previewKeys.has(keyDef.id) ? "keyboard-key is-active" : "keyboard-key"}
                key={`${index}-${keyIndex}-${keyDef.id}`}
                style={{ minWidth: `${keyDef.width ?? 28}px` }}
              >
                {keyDef.label}
              </span>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );

  if (embedded) {
    return (
      <section className="shortcut-settings embedded">
        {keyboardPreview}
        {groups}
      </section>
    );
  }

  return (
    <section className="glass-card shortcut-settings">
      {keyboardPreview}
      {groups}
    </section>
  );
}
