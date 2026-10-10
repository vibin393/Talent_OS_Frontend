/** Platform marketplace review client (Epic 69): queue, version detail, checklist, ★ decisions, listing actions. */
import { platformRequest } from "@/lib/api/platform-client";

const P = "/api/v1/platform/marketplace";
const enc = encodeURIComponent;

export type CheckResult = { key: string; passed: boolean; detail: string | null };
export type QueueItem = {
  version_id: string;
  listing_id: string;
  app_name: string;
  partner_name: string | null;
  version_no: number;
  submitted_at: string | null;
  status: string;
  checks_failed: number;
  reviewer_id: string | null;
};
export type ChecklistEntry = { ok: boolean; note: string | null };
export type ReviewVersion = {
  version_id: string;
  listing_id: string;
  listing_slug: string;
  listing_status: string;
  app_id: string | null;
  app_name: string;
  partner_name: string | null;
  version_no: number;
  status: string;
  manifest_snapshot: Record<string, unknown>;
  scopes: { key: string; reason: string; sensitive: boolean }[];
  data_flows: Record<string, unknown>[];
  egress_hosts: string[];
  description_md: string;
  privacy_url: string | null;
  dpa_url: string | null;
  india_transfer_statement: string | null;
  security_questionnaire: Record<string, unknown> | null;
  changelog: string | null;
  check_results: CheckResult[];
  conformance_report: { checks?: CheckResult[]; observed_scopes?: string[]; observed_hosts?: string[]; passed?: boolean } | null;
  checklist: Record<string, ChecklistEntry>;
  claimed_by: string | null;
  history: { action: string; operator_id: string; message: string | null; internal_note: string | null; at: string }[];
};
export type PlatformListing = {
  id: string;
  slug: string;
  kind: string;
  name: string;
  publisher_kind: string;
  partner_name: string | null;
  category: string;
  status: string;
  install_count: number;
  last_reviewed_at: string | null;
  suspended_reason: string | null;
};

export const CHECKLIST: { key: string; label: string }[] = [
  { key: "purpose_matches_scopes", label: "Purpose matches the requested access (least privilege)" },
  { key: "flows_match_sandbox_traffic", label: "Data flows match the sandbox traffic" },
  { key: "india_transfer_statement", label: "India data-transfer statement is present and accurate" },
  { key: "security_questionnaire", label: "Security questionnaire reviewed" },
  { key: "support_commitments", label: "Support commitments are acceptable" },
  { key: "no_human_only_automation", label: "No claims of automating human-only decisions" },
];

export const VERSION_STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  automated_checks: "Automated checks",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
  suspended: "Suspended",
  delisted: "Delisted",
  superseded: "Superseded",
  draft: "Draft",
};

export function checksLabel(failed: number): string {
  return failed === 0 ? "All passed" : `${failed} failed`;
}

export const reviewKeys = {
  queue: ["platform", "marketplace", "queue"] as const,
  version: (id: string) => ["platform", "marketplace", "version", id] as const,
  listings: ["platform", "marketplace", "listings"] as const,
};

const get = <T>(path: string, signal?: AbortSignal) => platformRequest<T>(path, { signal });
const post = <T>(path: string, body?: unknown) => platformRequest<T>(path, { method: "POST", body });
const put = <T>(path: string, body?: unknown) => platformRequest<T>(path, { method: "PUT", body });

export const reviewApi = {
  queue: (signal?: AbortSignal) => get<QueueItem[]>(`${P}/queue`, signal),
  version: (id: string, signal?: AbortSignal) => get<ReviewVersion>(`${P}/versions/${enc(id)}`, signal),
  claim: (id: string) => post<ReviewVersion>(`${P}/versions/${enc(id)}/claim`),
  checklist: (id: string, items: Record<string, ChecklistEntry>, internalNote: string | null) =>
    put<ReviewVersion>(`${P}/versions/${enc(id)}/checklist`, { items, internal_note: internalNote }),
  decide: (id: string, action: "approve" | "request-changes" | "reject", message: string, internalNote: string | null) =>
    post<ReviewVersion>(`${P}/versions/${enc(id)}/${action}`, { message, internal_note: internalNote }),
  listings: (signal?: AbortSignal) => get<PlatformListing[]>(`${P}/listings`, signal),
  listingAction: (id: string, action: "suspend" | "reinstate" | "delist", reason: string) =>
    post<PlatformListing>(`${P}/listings/${enc(id)}/${action}`, { reason }),
};
