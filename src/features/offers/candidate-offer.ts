/** Pure state for the candidate-facing offer view (shared by the secure-link page and the Epic 9 portal). */
import { ApiError } from "@/lib/api/errors";
import type { CandidateOfferView } from "./types";

export type CandidateOfferState =
  | "open"
  | "accepted"
  | "declined"
  | "expired"
  | "withdrawn"
  | "closed";

/** What the candidate can do with the offer now. */
export function candidateOfferState(o: Pick<CandidateOfferView, "status" | "can_respond" | "expires_at" | "response">, now: number = Date.now()): CandidateOfferState {
  if (o.response?.decision === "accepted" || o.status === "accepted") return "accepted";
  if (o.response?.decision === "declined" || o.status === "declined") return "declined";
  if (o.status === "expired" || (o.expires_at && Date.parse(o.expires_at) <= now)) return "expired";
  if (o.status === "withdrawn") return "withdrawn";
  if ((o.status === "released" || o.status === "viewed") && o.can_respond) return "open";
  return "closed";
}

/** Accept is enabled once a name is typed and the e-signature box is ticked. */
export function canAccept(typedName: string, agreed: boolean): boolean {
  return typedName.trim().length > 0 && agreed;
}

/** "Expires in 2 days" / "Expires in 5 hours" / "Expires in 12 minutes" / "Expired". */
export function expiryCountdown(expiresAt: string | null | undefined, now: number = Date.now()): string | null {
  if (!expiresAt) return null;
  const ms = Date.parse(expiresAt) - now;
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return "Expired";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `Expires in ${Math.max(1, mins)} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `Expires in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `Expires in ${days} days`;
}

export type ResponseError =
  | { kind: "name_mismatch"; message: string }
  | { kind: "version_changed"; message: string }
  | { kind: "expired"; message: string }
  | { kind: "not_open"; message: string }
  | { kind: "not_found"; message: string }
  | { kind: "rate_limited"; message: string }
  | { kind: "other"; message: string };

/** Map accept / decline / view errors to what the page shows. */
export function responseError(e: unknown): ResponseError {
  if (e instanceof ApiError) {
    if (e.code === "name_mismatch") return { kind: "name_mismatch", message: "This doesn’t match the name on the offer. Type your full name exactly as shown." };
    if (e.code === "offer_version_changed") return { kind: "version_changed", message: "This offer was updated — reload to review." };
    if (e.code === "offer_expired" || e.code === "link_expired") return { kind: "expired", message: "This offer has expired." };
    if (e.code === "offer_not_open" || e.code === "link_used") return { kind: "not_open", message: "This offer is no longer open for a response." };
    if (e.status === 404) return { kind: "not_found", message: "This offer link is not valid." };
    if (e.status === 410) return { kind: "expired", message: "This link has expired." };
    if (e.status === 429) return { kind: "rate_limited", message: "Too many attempts. Please wait a few minutes and try again." };
    if (e.status === 422) return { kind: "other", message: e.message || "Check your answers and try again." };
    if (e.status === 0) return { kind: "other", message: "Cannot reach the server. Check your connection and try again." };
    if (e.status < 500 && e.message) return { kind: "other", message: e.message };
  }
  return { kind: "other", message: "Something went wrong. Please try again." };
}
