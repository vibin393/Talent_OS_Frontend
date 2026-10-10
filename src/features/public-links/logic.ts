/**
 * Pure logic of the public secure-link pages (`/l/[token]`): which screen a view model shows, the error
 * copy for 404 / 410 / 429, and the sessionStorage answer draft.
 */
import type { PublicLinkView } from "@/lib/api/types";

export type LinkErrorCopy = { title: string; body: string };

/** Specific copy per failure (NFR-17 link errors). */
export function linkErrorCopy(status: number, code: string | undefined): LinkErrorCopy {
  if (status === 410 || code === "link_expired" || code === "link_used" || code === "link_revoked") {
    if (code === "link_used") {
      return {
        title: "This link has already been used",
        body: "Your response was already recorded, so this link cannot be used again. If you need to change something, reply to the email you received.",
      };
    }
    if (code === "link_revoked") {
      return {
        title: "This link is no longer active",
        body: "The sender has withdrawn this link. If you still need to respond, ask them for a new one.",
      };
    }
    return {
      title: "This link has expired",
      body: "For your security, links only work for a limited time. Ask the sender for a new link.",
    };
  }
  if (status === 429 || code === "rate_limited") {
    return {
      title: "Too many attempts",
      body: "Please wait a few minutes, then reload this page.",
    };
  }
  if (status === 404 || code === "link_invalid") {
    return {
      title: "Link not found",
      body: "This link is not valid. Check that you copied the whole address from the email.",
    };
  }
  if (status === 403) {
    return {
      title: "Request refused",
      body: "Open the link directly from the email you received, then try again.",
    };
  }
  if (status === 0) {
    return { title: "Cannot reach the server", body: "Check your internet connection, then try again." };
  }
  return { title: "Something went wrong", body: "Please try again in a few minutes." };
}

export type PublicScreen =
  | "screening_consent"
  | "screening_questions"
  | "screening_done"
  | "screening_declined"
  | "screening_closed"
  | "consent_request"
  | "client_feedback"
  | "unsupported";

/** The screen a freshly loaded link shows. */
export function screenFor(view: Pick<PublicLinkView, "purpose" | "status" | "consent_required">): PublicScreen {
  switch (view.purpose) {
    case "ai_screening":
      if (view.status === "consent_declined") return "screening_declined";
      if (view.status === "answered" || view.status === "reviewed" || view.status === "completed") return "screening_done";
      if (view.status && view.status !== "sent") return "screening_closed";
      return view.consent_required ? "screening_consent" : "screening_questions";
    case "consent_request":
      return "consent_request";
    case "client_feedback":
      return "client_feedback";
    default:
      return "unsupported";
  }
}

export const DECISION_LABELS: Record<string, string> = {
  interested: "Interested — I'd like to take this forward",
  on_hold: "On hold — not decided yet",
  rejected: "Not a fit — decline this candidate",
};

export const DECISION_SHORT: Record<string, string> = {
  interested: "Interested",
  on_hold: "On hold",
  rejected: "Not a fit",
};

export const CONSENT_PURPOSE_LABELS: Record<string, string> = {
  data_processing: "processing your personal data",
  ai_processing: "AI-assisted processing of your application",
  client_submission: "sharing your profile with a client",
  marketing: "marketing communications",
};

// ---------------------------------------------------------------- answer draft (sessionStorage)
/** Storage key derived from the token (a short hash, so the raw token is not stored). */
export function draftKey(token: string): string {
  let h = 5381;
  for (let i = 0; i < token.length; i++) h = ((h << 5) + h + token.charCodeAt(i)) | 0;
  return `tos-link-draft-${(h >>> 0).toString(36)}`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function session(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function loadDraft(token: string, storage: StorageLike | null = session()): Record<string, unknown> {
  try {
    const raw = storage?.getItem(draftKey(token));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function saveDraft(token: string, answers: Record<string, unknown>, storage: StorageLike | null = session()): void {
  try {
    storage?.setItem(draftKey(token), JSON.stringify(answers));
  } catch {
    // Private mode / quota: the draft is a convenience only.
  }
}

export function clearDraft(token: string, storage: StorageLike | null = session()): void {
  try {
    storage?.removeItem(draftKey(token));
  } catch {
    // ignore
  }
}
