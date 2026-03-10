import type { CaptureItem, WorkspaceTag } from "../types/app";

export interface CaptureTagGroup {
  key: string;
  label: string;
  color: string | null;
  captures: CaptureItem[];
  isUntagged?: boolean;
}

export function buildCaptureTagGroups(
  captures: CaptureItem[],
  tags: WorkspaceTag[],
  includeEmpty = false,
) {
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const grouped = new Map<string, CaptureItem[]>();

  captures.forEach((capture) => {
    const key = capture.tagId && tagMap.has(capture.tagId) ? capture.tagId : "__untagged__";
    const bucket = grouped.get(key) ?? [];
    bucket.push(capture);
    grouped.set(key, bucket);
  });

  const groups: CaptureTagGroup[] = [];

  tags.forEach((tag) => {
    const bucket = grouped.get(tag.id) ?? [];
    if (!bucket.length && !includeEmpty) {
      return;
    }
    groups.push({
      key: tag.id,
      label: tag.label,
      color: tag.color,
      captures: bucket,
    });
    grouped.delete(tag.id);
  });

  const untagged = grouped.get("__untagged__") ?? [];
  if (untagged.length) {
    groups.push({
      key: "__untagged__",
      label: "untagged",
      color: null,
      captures: untagged,
      isUntagged: true,
    });
  }

  return groups;
}
