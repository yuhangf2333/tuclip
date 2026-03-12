# TuClip Agent Guide

## Project
- Name: `TuClip`
- Type: Electron desktop app
- Frontend: React + TypeScript + Vite
- Desktop runtime: Electron
- Main process code: [`electron/`](/Users/fangyuhang/Desktop/codex_study/TuClip/electron)
- Renderer code: [`src/`](/Users/fangyuhang/Desktop/codex_study/TuClip/src)

## Common Commands
- Install: `npm install`
- Dev: `npm run dev`
- Start Electron directly: `npm start`
- Build: `npm run build`
- Test: `npm test`

## Important Paths
- Main process: [`electron/main.cjs`](/Users/fangyuhang/Desktop/codex_study/TuClip/electron/main.cjs)
- Storage logic: [`electron/storage.cjs`](/Users/fangyuhang/Desktop/codex_study/TuClip/electron/storage.cjs)
- Remote sync logic: [`electron/remote.cjs`](/Users/fangyuhang/Desktop/codex_study/TuClip/electron/remote.cjs)
- App shell: [`src/App.tsx`](/Users/fangyuhang/Desktop/codex_study/TuClip/src/App.tsx)
- Shared types: [`src/types/app.ts`](/Users/fangyuhang/Desktop/codex_study/TuClip/src/types/app.ts)

## Branch Workflow
- Keep `main` as the stable branch.
- Do feature work on a separate branch, usually with the prefix `codex/`.
- Merge a feature branch into `main` only after:
  - `npm test` passes
  - `npm run build` passes
  - the key UI flow is manually checked

## Merge Policy
- If a feature branch is complete, merge it into `main`.
- Suggested flow:
  1. `git checkout main`
  2. `git pull`
  3. `git merge <feature-branch>`
  4. `npm test`
  5. `npm run build`
  6. `git push`

## If There Is A Bug Before Merge
- Fix it on the same feature branch.
- Re-test before merging.

## If There Is A Bug After Merge
- Do not rewrite `main` history by default.
- Create a new fix branch from `main`, for example:
  - `git checkout main`
  - `git pull`
  - `git checkout -b codex/fix-<bug-name>`
- Fix the issue there, test it, then merge that fix branch back into `main`.

## If A Merge Must Be Undone
- Prefer `git revert <commit>` for shared history.
- Avoid `git reset --hard` on `main` unless you are absolutely sure no one else depends on it.

## Data Notes
- Public screenshots are stored in the workspace root.
- Internal workspace data is stored in `.tuclip/`.
- App-level config is stored under Electron `userData/state`.

## Guidance For Future Changes
- Prefer small, reviewable commits.
- Keep UI density compact.
- Avoid compatibility aliases unless explicitly requested.
- If renaming app-level identifiers, change them consistently across:
  - package name
  - Electron preload bridge
  - IPC channel names
  - storage paths
  - user-facing strings
