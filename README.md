# GleanDex

GleanDex is a desktop app for tutorial writers who take many system screenshots and need to keep them organized, editable, and export-stable for Markdown or Typst notes.

## What it does

- Watches the clipboard for screenshots created with the OS screenshot shortcut.
- Shows a temporary popup with `Save`, `Annotate`, and `Dismiss` actions.
- Stores captures in either a user workspace or a global Inbox.
- Preserves a stable public image path while archiving originals and edited revisions.
- Includes a glass-style annotation editor with boxes, numbered markers, text labels, crop, OCR label suggestions, and configurable shortcuts.

## Stack

- Tauri 2
- Rust + `rusqlite`
- React + TypeScript
- `react-konva` for the editor
- `opencv.js` for edge snapping
- `tesseract.js` with local `eng` + `chi_sim` language data for offline OCR

## Local development

```bash
npm install
npm run tauri dev
```

## Verification

```bash
npm run build
cd src-tauri && cargo check
```
