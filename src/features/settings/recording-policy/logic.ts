/** Recording Policy labels (Epic 58), unit-tested in `recording-policy.test.ts`. */
export type RecordingRule = "not_permitted" | "candidate_consent" | "all_party_consent";

export const RULE_LABELS: Record<RecordingRule, string> = {
  not_permitted: "Not permitted",
  candidate_consent: "Permitted with the candidate's consent",
  all_party_consent: "Permitted with everyone's consent",
};

export function ruleLabel(rule: string | null | undefined): string {
  return RULE_LABELS[(rule ?? "not_permitted") as RecordingRule] ?? RULE_LABELS.not_permitted;
}

export const UNLISTED_CAPTION = "Anywhere not listed: not permitted.";
