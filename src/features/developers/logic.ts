/**
 * Developer portal pure logic (Epic 74): org roles, GSTIN check (mirrors the backend), PKCE, docs anchors,
 * conformance checklist states and labels.
 */

export type OrgRole = "owner" | "developer" | "viewer";

const RANK: Record<OrgRole, number> = { viewer: 0, developer: 1, owner: 2 };

/** Spec 0.1 role matrix: viewers see everything but change nothing; only owners manage members and verification. */
export function canDo(role: OrgRole | null | undefined, minimum: OrgRole): boolean {
  return role != null && RANK[role] >= RANK[minimum];
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** GSTIN format + mod-36 check character (same rule as the backend `legal_entities.gstin`). */
export function gstinError(value: string): string | null {
  const v = value.trim().toUpperCase();
  if (!GSTIN_RE.test(v)) return "GSTIN must be 15 characters in the GST format";
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const product = CHARS.indexOf(v[i]) * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (total % 36)) % 36] === v[14] ? null : "The GSTIN check digit is not valid";
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 7636 PKCE pair (S256), browser-side only; the verifier is kept in memory, never in storage. */
export async function pkcePair(random: Uint8Array = crypto.getRandomValues(new Uint8Array(32))): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = base64url(random);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge: base64url(digest) };
}

export function operationAnchor(operationId: string): string {
  return `op-${operationId}`;
}

export const SANDBOX_STATUS: Record<string, string> = {
  creating: "Creating…",
  ready: "Ready",
  resetting: "Resetting…",
  deleting: "Deleting…",
  deleted: "Deleted",
  failed: "Failed",
};

export const CHECK_LABELS: Record<string, string> = {
  oauth_client_credentials: "Obtain a client-credentials token and use it",
  oauth_authorization_code_pkce: "Complete one authorization-code + PKCE flow",
  scope_minimality: "Call at least one endpoint for every granted scope",
  webhook_signature_verified: "Accept signed events and refuse a bad signature",
  idempotent_retry: "Retry POST requests with the same Idempotency-Key",
  handles_429: "Wait for Retry-After after a rate limit",
  uninstall_cleanup: "Stop calling after uninstall and acknowledge the event",
};

export type CheckState = "pending" | "passed" | "failed";

export function checkState(passed: boolean | null | undefined): CheckState {
  return passed == null ? "pending" : passed ? "passed" : "failed";
}

/** "Finish run" is enabled after at least 5 minutes of the window. */
export function canFinish(createdAt: string, now: number = Date.now()): boolean {
  return now - new Date(createdAt).getTime() >= 5 * 60 * 1000;
}

export function timeLeft(windowEndsAt: string, now: number = Date.now()): string {
  const ms = Math.max(0, new Date(windowEndsAt).getTime() - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The one-time token of a `#t=...` link (invitations, verification, reset, sandbox handoff). */
export function fragmentToken(hash: string): string | null {
  const m = /[#&]t=([A-Za-z0-9_-]+)/.exec(hash);
  return m ? m[1] : null;
}
