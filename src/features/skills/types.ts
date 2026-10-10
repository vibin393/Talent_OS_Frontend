/** Hand-written DTOs of the Epic 37 skills graph endpoints (`app/schemas/skills.py`). Decimals are strings. */

export type EdgeKind = "parent_of" | "related_to" | "implies";
export type EdgeOrigin = "platform" | "tenant" | "legacy";
export type Verification = "declared" | "inferred" | "verified";
export type EvidenceKind = "resume" | "self" | "recruiter" | "assessment" | "project" | "graph" | "interview" | "interview_declared"; // Epic 60: + interview*
export type SuggestionSource = "ai_resume" | "graph" | "project" | "assessment" | "interview"; // Epic 60: + interview

export type SkillLabel = { key: string; name: string; category: string | null; status: string };

export type SkillEdge = {
  id: string | null;
  origin: EdgeOrigin;
  from_skill: SkillLabel;
  to_skill: SkillLabel;
  kind: EdgeKind;
  weight: string;
  note: string | null;
  source: string | null;
  updated_at: string | null;
};

export type SkillNode = {
  skill: SkillLabel;
  aliases: string[];
  parent: SkillLabel | null;
  outgoing: SkillEdge[];
  incoming: SkillEdge[];
};

export type SkillEdgeIn = { from_key: string; to_key: string; kind: EdgeKind; weight: string; note?: string | null };

export type SkillGraphSettings = {
  expansion_default: boolean;
  match_depth: number;
  min_weight: string;
  inference_auto_suggest: boolean;
  graph_version: string;
};

export type PathHop = { from_key: string; to_key: string; kind: EdgeKind; weight: string; label: string };

export type ExpandedSkillRow = {
  key: string;
  name: string;
  root: string;
  weight: string;
  depth: number;
  via: string | null;
  path: PathHop[];
};

export type ExpandPreview = { items: ExpandedSkillRow[]; graph_version: string };

export type Evidence = {
  id: string;
  candidate_skill_id: string;
  kind: EvidenceKind;
  proficiency: number | null;
  years: string | null;
  last_used: string | null;
  source_ref: string | null;
  note: string | null;
  observed_at: string;
  created_by_kind: string;
  created_by_id: string | null;
  created_by_name: string | null;
  superseded_at: string | null;
  proficiency_after: number | null;
  verification_after: Verification | null;
};

export type SkillProfileRow = {
  candidate_skill_id: string;
  skill_key: string;
  name: string;
  proficiency: number | null;
  verification: Verification;
  evidence_count: number;
};

export type SkillSuggestion = {
  id: string;
  candidate_id: string;
  skill_key: string;
  name: string;
  proposed_proficiency: number | null;
  source: SuggestionSource;
  rationale: string | null;
  status: "pending" | "accepted" | "rejected" | "edited";
  created_at: string;
  decided_at: string | null;
};

export type ProficiencyBucket = "1" | "2" | "3" | "4" | "5" | "unknown";

export type SkillInsightRow = {
  skill_key: string;
  name: string;
  category: string | null;
  open_demand: number;
  supply_by_proficiency: Record<ProficiencyBucket, number>;
  supply_total: number;
  verified_supply: number;
  bench: number | null;
  trend_90d: { demand: number[]; supply: number[] };
  links: Record<string, Record<string, unknown>>;
};

export type SkillInsights = { items: SkillInsightRow[]; generated_at: string; week_starts: string[] };
