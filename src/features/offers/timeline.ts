/** Pure merge of offer status history and candidate responses into a timeline. */
import { OFFER_STATUS } from "./format";
import type { OfferResponseOut, OfferStatus, OfferStatusHistoryOut } from "./types";

export type TimelineEntry = {
  key: string;
  kind: "status" | "response";
  status: OfferStatus | null;
  label: string;
  detail: string | null;
  actorKind: string;
  actorId: string | null;
  versionNo: number | null;
  at: string;
};

const ACTOR: Record<string, string> = {
  user: "",
  candidate: "the candidate",
  system: "the system",
  secure_link: "the candidate (secure link)",
};

export function actorText(kind: string, name: string | null): string {
  if (kind === "user") return name ?? "a user";
  return ACTOR[kind] ?? kind;
}

function statusLabel(h: OfferStatusHistoryOut): string {
  const to = h.to_status as OfferStatus;
  if (h.from_status === null || h.from_status === undefined) return "Offer created";
  if (to === "draft" && h.from_status === "pending_approval") return "Returned by the approver";
  if (to === "draft") return "Revised (new version)";
  if (to === "pending_approval") return "Submitted for approval";
  return OFFER_STATUS[to]?.label ?? to;
}

/** Newest first. Responses carry the e-acceptance evidence line. */
export function buildTimeline(history: readonly OfferStatusHistoryOut[], responses: readonly OfferResponseOut[]): TimelineEntry[] {
  const out: TimelineEntry[] = history.map((h, i) => ({
    key: `h${i}-${h.at}`,
    kind: "status",
    status: h.to_status as OfferStatus,
    label: statusLabel(h),
    detail: h.reason ?? null,
    actorKind: h.actor_kind,
    actorId: h.actor_id ?? null,
    versionNo: h.version_no ?? null,
    at: h.at,
  }));
  responses.forEach((r, i) => {
    const via = r.channel === "portal" ? "Candidate Portal" : "secure link";
    out.push({
      key: `r${i}-${r.decided_at}`,
      kind: "response",
      status: r.decision,
      label:
        r.decision === "accepted"
          ? `Accepted by typed name '${r.typed_name ?? ""}'${r.ip ? ` from ${r.ip}` : ""} on version ${r.version_no}`
          : `Declined on version ${r.version_no}${r.decline_reason ? `: ${r.decline_reason}` : ""}`,
      detail: `Via ${via}${r.letter_sha256 ? ` · letter SHA-256 ${r.letter_sha256.slice(0, 12)}…` : ""}`,
      actorKind: "candidate",
      actorId: null,
      versionNo: r.version_no,
      at: r.decided_at,
    });
  });
  return out.sort((a, b) => b.at.localeCompare(a.at) || (a.kind === "response" ? -1 : 1));
}
