// Embedded external apps of the unified platform (Phase 2, Stories 3.1/3.2 — shell side).
//
// Each app is hosted inside the authenticated Talent OS shell through an <iframe> served from a
// module-host route under `/apps/*`. The external origins come from build-time env vars with local
// defaults; `next build` inlines `NEXT_PUBLIC_*` so changing them needs a rebuild.
//
// SSO: for now the embedded app renders its own login (embedded-first, per the unified-platform plan).
// Seamless SSO — a central token handshake via `postMessage` between the shell and the iframe — is a
// follow-up; the module-host passes the tenant slug as a hint only (see `module-host.tsx`).

export type EmbeddedAppKey = "croar" | "feedback-iq" | "portal";

export type EmbeddedApp = {
  key: EmbeddedAppKey;
  /** Human label shown in the launcher and the module-host title bar. */
  label: string;
  /** External origin the iframe loads (env-driven, with a `*.localhost` dev default). */
  url: string;
  /** The in-shell module-host route that embeds this app. */
  route: string;
};

const CROAR_URL = process.env.NEXT_PUBLIC_CROAR_URL ?? "http://croar.localhost";
const FEEDBACK_IQ_URL = process.env.NEXT_PUBLIC_FEEDBACK_IQ_URL ?? "http://feedbackiq.localhost";
// The Portal RECRUITER view lives under /hiring (the seeker site stays standalone, AD-8); the embed
// CSP (frame-ancestors) is scoped to /hiring too.
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://jobs.localhost/hiring";

export const EMBEDDED_APPS: readonly EmbeddedApp[] = [
  { key: "croar", label: "Croar", url: CROAR_URL, route: "/apps/croar" },
  { key: "feedback-iq", label: "Feedback IQ", url: FEEDBACK_IQ_URL, route: "/apps/feedback-iq" },
  { key: "portal", label: "Job Portal", url: PORTAL_URL, route: "/apps/portal" },
];

// Host-only base for DEEP-embedding an existing app page (native unification): the contextual
// sidebar links to `/apps/{app}/m/<deep path>` and the catch-all route embeds `${EMBED_BASE}/<deep path>`
// with the app's own chrome hidden. Portal deep paths already include `/hiring`, so its base is host-only.
export const EMBED_BASE: Record<EmbeddedAppKey, string> = {
  croar: CROAR_URL,
  "feedback-iq": FEEDBACK_IQ_URL,
  portal: process.env.NEXT_PUBLIC_PORTAL_HOST ?? "http://jobs.localhost",
};

const byKey = new Map(EMBEDDED_APPS.map((a) => [a.key, a] as const));

export function embeddedApp(key: EmbeddedAppKey): EmbeddedApp {
  const app = byKey.get(key);
  if (!app) throw new Error(`Unknown embedded app "${key}"`);
  return app;
}
