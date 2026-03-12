import { describe, expect, it } from "vitest";

import { buildCaptureTagGroups } from "./capture-groups";
import type { CaptureItem, WorkspaceTag } from "../types/app";

const defaultRemote = {
  syncStatus: "idle",
  publishStatus: "idle",
  remoteUrl: null,
  remoteObjectKey: null,
  lastSyncedAt: null,
  lastPublishedAt: null,
  lastError: "",
} as const;

function createCapture(id: string, orderIndex: number, tagId: string | null): CaptureItem {
  return {
    id,
    workspaceId: "workspace-1",
    status: "saved",
    publicPath: `/tmp/${id}.png`,
    orderIndex,
    createdAt: "2026-03-09T12:00:00.000Z",
    currentVersionId: `version-${id}`,
    sourceHash: `hash-${id}`,
    tagId,
    note: "",
    remote: { ...defaultRemote },
  };
}

describe("buildCaptureTagGroups", () => {
  it("keeps tag order from the tag list and appends untagged captures", () => {
    const tags: WorkspaceTag[] = [
      {
        id: "tag-b",
        label: "Tag B",
        color: "#00aa66",
      },
      {
        id: "tag-a",
        label: "Tag A",
        color: "#2266ee",
      },
    ];

    const groups = buildCaptureTagGroups(
      [
        createCapture("capture-1", 1, "tag-a"),
        createCapture("capture-2", 2, null),
        createCapture("capture-3", 3, "tag-b"),
      ],
      tags,
    );

    expect(groups.map((group) => group.key)).toEqual(["tag-b", "tag-a", "__untagged__"]);
    expect(groups[0].captures.map((capture) => capture.id)).toEqual(["capture-3"]);
    expect(groups[1].captures.map((capture) => capture.id)).toEqual(["capture-1"]);
    expect(groups[2].captures.map((capture) => capture.id)).toEqual(["capture-2"]);
  });

  it("treats unknown tag ids as untagged", () => {
    const groups = buildCaptureTagGroups([createCapture("capture-1", 1, "missing-tag")], []);
    expect(groups).toHaveLength(1);
    expect(groups[0].isUntagged).toBe(true);
    expect(groups[0].captures[0].id).toBe("capture-1");
  });

  it("can keep empty tag groups visible for grouped layouts", () => {
    const groups = buildCaptureTagGroups(
      [createCapture("capture-1", 1, null)],
      [{ id: "tag-a", label: "Tag A", color: "#2266ee" }],
      true,
    );
    expect(groups.map((group) => group.key)).toEqual(["tag-a", "__untagged__"]);
    expect(groups[0].captures).toHaveLength(0);
    expect(groups[1].captures[0].id).toBe("capture-1");
  });
});
