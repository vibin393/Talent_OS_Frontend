/** Epic 62 Knowledge Sources display logic (Vitest-covered). */
import type { Audience, GapRow, SourceDetailOut, SourceKind, SourceStatus } from "./types";

export const KIND_LABELS: Record<SourceKind, string> = {
  article: "Article",
  file: "File",
  onboarding_template: "Onboarding template",
  policy_document: "Policy",
};

export const AUDIENCE_LABELS: Record<Audience, string> = {
  worker: "Workers",
  candidate: "Candidates",
  both: "Workers and candidates",
  internal: "Internal",
};

export const STATUS_LABELS: Record<SourceStatus, string> = {
  draft: "Draft",
  published: "Published",
  unpublished: "Unpublished",
  archived: "Archived",
};

export const GAP_OUTCOMES: Record<GapRow["outcome"], string> = {
  handed_off: "Handed off",
  ungrounded: "No source found",
  incorrect: "Marked incorrect",
};

export function statusColor(status: SourceStatus): "success" | "informative" | "warning" | "subtle" {
  return status === "published" ? "success" : status === "draft" ? "informative" : status === "unpublished" ? "warning" : "subtle";
}

/** The version to publish: the newest readable one. */
export function publishableVersion(s: SourceDetailOut): number | null {
  const v = s.versions.find((x) => x.extract_status === "ok" && (x.body_md || x.extracted_chars > 0));
  return v ? v.version_no : null;
}

export function canPublish(s: SourceDetailOut): boolean {
  const v = publishableVersion(s);
  return s.status !== "archived" && v != null && !(s.status === "published" && s.published_version_no === v);
}

/** A draft article body prefilled from an FAQ gap ("Create article from this"). */
export function articleFromGap(gap: GapRow): { title: string; body_md: string } {
  const title = gap.question.replace(/\?+$/, "").slice(0, 200) || "New article"; // NOSONAR
  return { title, body_md: `# ${title}\n\nWrite the answer here.` };
}
