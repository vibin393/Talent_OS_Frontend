/** Pure AI feature-toggle helpers shared by `useAiFeatures` and `<AiFeatureGate>`. */

export const AI_FEATURE_KEYS = [
  "resume_parsing",
  "demand_intake",
  "jd_generation",
  "nl_search",
  "matching",
  "ai_screening",
  "document_extraction",
] as const;
export type AiFeature = (typeof AI_FEATURE_KEYS)[number];

export const AI_FEATURE_INFO: Record<AiFeature, { label: string; description: string }> = {
  resume_parsing: {
    label: "Resume parsing",
    description: "Extract profile details from uploaded resumes. A person always reviews the result.",
  },
  demand_intake: { label: "Demand intake", description: "Turn client emails and notes into structured demands." },
  jd_generation: { label: "Job description drafts", description: "Draft job descriptions from demands." },
  nl_search: { label: "Natural-language search", description: "Search candidates by describing who you need." },
  matching: { label: "Matching", description: "Score and explain how candidates fit a demand." },
  ai_screening: { label: "AI screening", description: "Generate screening questions and summarize answers." },
  document_extraction: {
    label: "Document extraction",
    description:
      "Suggest commercial terms from uploaded client and vendor agreements. A person reviews every value before it is saved.",
  },
};

/** Features that are off unless an admin turns them on (shown even when the server map omits them). */
export const AI_FEATURE_DEFAULT_OFF = ["document_extraction"] as const;

/** Extra cost notes shown under a feature's switch. */
export const AI_FEATURE_COST_NOTES: Partial<Record<AiFeature, string>> = {
  document_extraction:
    "Cost note: each extraction reads the whole document, so it uses noticeably more of the monthly AI budget than other features.",
};

/** The toggle map shown on `/admin/ai`: the server map plus default-off features it does not list yet. */
export function withDefaultAiFeatures(map: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of AI_FEATURE_DEFAULT_OFF) out[key] = false;
  // Epic 53: agent toggles are managed by the agents settings (enablement notice, burn-in), not this list.
  for (const [key, value] of Object.entries(map)) if (!isAgentFeature(key)) out[key] = value;
  return out;
}

/** Epic 53: the agentic master switch (`agentic`) and the per-agent toggles (`agent_<key>`). */
export function isAgentFeature(key: string): boolean {
  return key === "agentic" || key.startsWith("agent_");
}

export function aiFeatureLabel(key: string): string {
  return (AI_FEATURE_INFO as Record<string, { label: string }>)[key]?.label ?? key.replace(/_/g, " ");
}

/**
 * Whether `feature` is on. While the map is loading (undefined) features are treated as enabled so
 * controls do not flash; the backend refuses disabled features anyway (403 `ai_feature_disabled`).
 * A feature missing from a loaded map is treated as disabled.
 */
export function isAiFeatureEnabled(map: Record<string, boolean> | undefined, feature: string): boolean {
  if (!map) return true;
  return map[feature] === true;
}
