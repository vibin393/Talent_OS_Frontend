/**
 * Epic 77 portal Copilot copy and pure helpers (exact labels from `spec-p5-portal-copilot.md` B1).
 */
import type { PortalDraft, PortalKind, UnavailableReason } from "./types";

export const PC_COPY = {
  toggle: "Ask Copilot",
  title: "Copilot",
  subtitle: (tenant: string) => `AI assistant for ${tenant}`,
  disclosure: (tenant: string) =>
    `Copilot is an AI assistant acting for ${tenant}. It can see only what you can see here and can make mistakes.`,
  talkToPerson: "Talk to a person",
  history: "Conversations",
  newChat: "New chat",
  keptFor: (n: number) => `Kept for ${n} days`,
  confirm: "Confirm",
  edit: "Edit",
  discard: "Discard",
  done: "Done",
  expired: "This draft expired. Ask again.",
  consentTitle: "Use the AI assistant?",
  consentAllow: "Allow and continue",
  consentLater: "Not now",
  privacyNotice: "Privacy notice",
  helpful: "Helpful",
  notHelpful: "Not helpful",
} as const;

export const PLACEHOLDER: Record<PortalKind, string> = {
  client: "Ask about your requirements, candidates or invoices…",
  vendor: "Ask about releases, submissions or statements…",
  candidate: "Ask about your application or interview…",
};

export const STARTERS: Record<PortalKind, string[]> = {
  client: [
    "Which candidates are waiting for my feedback?",
    "What's the status of my open requirements?",
    "Show my pending approvals",
  ],
  vendor: ["Which releases are open for us?", "Which of our submissions are pending?"],
  candidate: ["When is my next interview?", "What documents do I still need to send?"],
};

export const FEEDBACK_REASONS: { value: string; label: string }[] = [
  { value: "wrong", label: "Wrong" },
  { value: "not_grounded", label: "Not based on my records" },
  { value: "unhelpful", label: "Not helpful" },
  { value: "unsafe", label: "Unsafe" },
  { value: "other", label: "Other" },
];

/** "Talk to a person" pre-fills a hand-off question per portal. */
export const TALK_TO_PERSON: Record<PortalKind, string> = {
  client: "I'd like to talk to my account manager.",
  vendor: "I'd like to talk to my vendor manager.",
  candidate: "I'd like to talk to my recruiter.",
};

export function unavailableText(reason: UnavailableReason | string | null, tenant: string): string | null {
  switch (reason) {
    case null:
      return null;
    case "not_enabled":
    case "agentic_off":
      return "Copilot is not turned on for this portal";
    case "kill_switch":
      return `Copilot is paused by ${tenant}`;
    case "budget_exhausted":
      return "Copilot has reached its limit for this month";
    case "principal_inactive":
    case "no_permission":
      return "Your access changed. Refresh the page.";
    case "consent_required":
      return null; // the consent card shows instead
    default:
      return "Copilot is not available right now";
  }
}

/** 429 message with the local time the window reopens. */
export function rateLimitText(retryAfterS: number, now: Date = new Date()): string {
  const at = new Date(now.getTime() + Math.max(1, retryAfterS) * 1000);
  const time = at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return `You've asked a lot of questions this hour. Try again at ${time}.`;
}

const DRAFT_TITLES: Record<string, string> = {
  "portal_client.draft_demand_request": "Draft: new requirement request",
  "portal_client.draft_message": "Draft: message to your account manager",
  "portal_candidate.draft_profile_update": "Draft: profile update",
  "portal_candidate.draft_reschedule_request": "Draft: reschedule request",
  "portal_candidate.draft_message": "Draft: message to your recruiter",
  "portal_candidate.draft_handoff": "Draft: ask your recruiter",
};

/** Draft card title per tool (feedback / candidate-profile titles carry a name from the preview). */
export function draftTitle(d: Pick<PortalDraft, "tool_key" | "title" | "preview">): string {
  return DRAFT_TITLES[d.tool_key] ?? d.preview?.title ?? d.title;
}

export function isExpired(d: Pick<PortalDraft, "status" | "expires_at">, now: Date = new Date()): boolean {
  return d.status === "expired" || (d.status === "pending" && !!d.expires_at && new Date(d.expires_at) <= now);
}

const SCREEN_NAMES: Record<string, string> = {
  approvals: "Approvals",
  demands: "Demands",
  invoices: "Invoices",
  statement: "Statement",
  team: "Team",
  projects: "Projects",
  scorecards: "Scorecards",
  delegation: "Out of office",
  releases: "Requirements",
  submissions: "Submissions",
  statements: "Statements",
  documents: "Documents",
  scorecard: "Scorecard",
  users: "Users",
  applications: "Applications",
  offers: "Offers",
  interviews: "Interviews",
  privacy: "Privacy",
  profile: "Profile",
  onboarding: "Onboarding",
  signatures: "Signatures",
};

/** Link button label for a portal route ("Open Approvals"); only same-portal relative links are allowed. */
export function linkLabel(href: string): string {
  const parts = href.split("?")[0].split("/").filter(Boolean);
  const named = [...parts].reverse().find((p) => SCREEN_NAMES[p]);
  return named ? `Open ${SCREEN_NAMES[named]}` : "Open";
}

const PORTAL_ROOT: Record<PortalKind, string> = { client: "/client", vendor: "/vendor", candidate: "/portal" };

export function allowedLink(portal: PortalKind, href: string): boolean {
  const root = PORTAL_ROOT[portal];
  return (href === root || href.startsWith(`${root}/`) || (portal === "candidate" && href.startsWith("/careers/"))) && !href.includes("//");
}

/** Public (signed-out) paths where the panel never mounts. */
export const PUBLIC_PREFIXES: Record<PortalKind, string[]> = {
  client: ["/client/sign-in"],
  vendor: ["/vendor/sign-in", "/vendor/accept-invite", "/vendor/reset-password"],
  candidate: ["/portal/sign-in", "/portal/verify"],
};

export function isPublicPath(portal: PortalKind, pathname: string): boolean {
  return PUBLIC_PREFIXES[portal].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
