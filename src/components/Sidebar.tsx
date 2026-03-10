import { FolderPlus, Inbox } from "lucide-react";

import type { UiStrings } from "../lib/i18n";
import type { Workspace } from "../types/app";

function splitTags<T>(items: T[], visibleCount = 2) {
  return {
    visible: items.slice(0, visibleCount),
    hidden: Math.max(0, items.length - visibleCount),
  };
}

interface SidebarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (workspaceId: string | null) => void;
  onCreateWorkspace: () => void;
  onOpenWorkspaceMenu: (workspace: Workspace) => void;
  showTags: boolean;
  strings: UiStrings;
}

export function Sidebar({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onOpenWorkspaceMenu,
  showTags,
  strings,
}: SidebarProps) {
  return (
    <aside className="sidebar glass-card">
      <div className="sidebar-header">
        <div>
          <p className="eyebrow">{strings.workspace.eyebrow}</p>
          <h2>{strings.workspace.title}</h2>
        </div>
        <button
          className="icon-button subtle"
          onClick={onCreateWorkspace}
          title={strings.workspace.create}
          type="button"
        >
          <FolderPlus size={16} />
        </button>
      </div>

      <div className="workspace-list">
        {workspaces.map((workspace) => {
          const selected =
            workspace.isInbox ? activeWorkspaceId === null : workspace.id === activeWorkspaceId;
          const tagMeta = splitTags(workspace.tags);

          return (
            <button
              className={selected ? "workspace-row is-active" : "workspace-row"}
              onContextMenu={(event) => {
                event.preventDefault();
                onOpenWorkspaceMenu(workspace);
              }}
              key={workspace.id}
              onClick={() => onSelectWorkspace(workspace.isInbox ? null : workspace.id)}
              type="button"
            >
              <div className="workspace-icon">
                {workspace.isInbox ? <Inbox size={15} /> : workspace.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="workspace-copy">
                <strong>{workspace.isInbox ? strings.workspace.inbox : workspace.name}</strong>
                <p>{workspace.rootPath}</p>
                {showTags && workspace.tags.length ? (
                  <div className="workspace-tag-row">
                    {tagMeta.visible.map((tag) => (
                      <span className="workspace-tag-chip compact" key={tag.id}>
                        <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
                        {tag.label}
                      </span>
                    ))}
                    {tagMeta.hidden ? <span className="workspace-tag-chip compact">+{tagMeta.hidden}</span> : null}
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
