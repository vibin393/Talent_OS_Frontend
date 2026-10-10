import type { BoardPostingOut, BoardSetOut, BoardStatus } from "./types";

export const PUBLISH_EXTERNAL = "posting:publish_external";

export const BOARD_LABELS: Record<string, string> = {
  naukri: "Naukri",
  linkedin: "LinkedIn",
  indeed: "Indeed",
  job_feed: "XML feed",
  fake_job_board: "Demo board",
  manual: "Manual",
};

export function boardLabel(key: string): string {
  return BOARD_LABELS[key] ?? key;
}

export type BadgeColor = "brand" | "success" | "warning" | "danger" | "informative" | "subtle";

export const STATUS_BADGES: Record<BoardStatus, { label: string; color: BadgeColor }> = {
  draft: { label: "Draft", color: "subtle" },
  publishing: { label: "Publishing", color: "informative" },
  live: { label: "Live", color: "success" },
  expiring: { label: "Expiring", color: "warning" },
  expired: { label: "Expired", color: "subtle" },
  closed: { label: "Closed", color: "subtle" },
  failed: { label: "Failed", color: "danger" },
  abandoned: { label: "Abandoned", color: "subtle" },
  rejected: { label: "Rejected by board", color: "danger" },
};

export function statusBadge(status: string): { label: string; color: BadgeColor } {
  return STATUS_BADGES[status as BoardStatus] ?? { label: status, color: "subtle" };
}

/** Boards preselected in the post dialog: the default set for the employment type, else "any type", else all. */
export function preselectBoards(installed: string[], sets: BoardSetOut[], employmentType: string | null): string[] {
  const defaults = sets.filter((s) => s.is_default);
  const match =
    defaults.find((s) => s.employment_type === employmentType) ?? defaults.find((s) => s.employment_type === null);
  const keys = match ? match.board_keys : installed;
  return keys.filter((k) => installed.includes(k));
}

export function blockedMessage(labels: string[]): string | null {
  return labels.length ? `This board is skipped until you fill: ${labels.join(", ")}` : null;
}

export function salaryText(salary: string | null): string {
  return salary ?? "Hidden";
}

export function outOfDateCount(rows: BoardPostingOut[]): number {
  return rows.filter((r) => r.out_of_date).length;
}

export type RowMenuItem =
  | "Open on board"
  | "Update"
  | "Refresh"
  | "Close"
  | "Retry"
  | "Copy posting pack"
  | "Record manually"
  | "Mark closed"
  | "Abandon";

/** Row menu actions offered for a board posting. */
export function rowActions(r: BoardPostingOut): RowMenuItem[] {
  const open = !["closed", "expired", "abandoned"].includes(r.status);
  const out: RowMenuItem[] = [];
  if (r.board_url) out.push("Open on board");
  if (open && r.out_of_date && !r.manual) out.push("Update");
  if ((r.status === "live" || r.status === "expiring") && !r.manual) out.push("Refresh");
  if (open && !r.manual) out.push("Close");
  if (r.status === "failed" || r.status === "rejected") out.push("Retry");
  if (
    r.manual ||
    ["failed", "rejected", "abandoned", "publishing"].includes(r.status) ||
    r.last_error_code === "manual_action_required"
  )
    out.push("Copy posting pack");
  if (open && ["failed", "rejected", "publishing", "draft"].includes(r.status)) out.push("Record manually");
  if (open && r.manual) out.push("Mark closed");
  if (open && ["failed", "rejected", "draft"].includes(r.status)) out.push("Abandon");
  return out;
}

/** `?src=naukri&bp=<id>` on the careers apply link -> the apply-session attribution fields. */
export function boardTagFromSearch(search: string): { src?: string; ref?: string } {
  const p = new URLSearchParams(search);
  const src = p.get("src") ?? "";
  if (!/^[a-z_]{1,40}$/.test(src)) return {};
  const ref = (p.get("bp") ?? "").slice(0, 64);
  return ref ? { src, ref } : { src };
}

export function packText(pack: {
  title: string;
  description_text: string;
  fields: { label: string; value: string }[];
  apply_url: string;
}): string {
  return [
    pack.title,
    "",
    pack.description_text,
    "",
    ...pack.fields.map((f) => `${f.label}: ${f.value}`),
    "",
    `Apply: ${pack.apply_url}`,
  ].join("\n");
}

export const REGENERATE_CONFIRM = "Boards using the old URL will stop receiving jobs.";
