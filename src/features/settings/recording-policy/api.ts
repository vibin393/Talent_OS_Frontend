/** Recording Policy settings client (Epic 58). */
import { api } from "@/lib/api/client";
import type { RecordingRule } from "./logic";

const V = "/api/v1";

export type RecordingPolicyRule = {
  id: string;
  country: string;
  region: string | null;
  rule: RecordingRule;
  note: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: string;
};
export type RecordingPolicyIn = { country: string; region?: string | null; rule: RecordingRule; note?: string | null };
export type PolicyEvaluation = { country: string | null; region: string | null; jurisdiction: string | null; rule: RecordingRule; matched: "region" | "country" | "none" };

export const recordingPolicyKeys = { all: ["recording-policies"] as const };

export const recordingPolicyApi = {
  list: (signal?: AbortSignal) => api.get<RecordingPolicyRule[]>(`${V}/recording-policies`, { signal }),
  upsert: (body: RecordingPolicyIn) => api.put<RecordingPolicyRule>(`${V}/recording-policies`, body),
  update: (id: string, body: RecordingPolicyIn) => api.put<RecordingPolicyRule>(`${V}/recording-policies/${encodeURIComponent(id)}`, body),
  remove: (id: string) => api.delete<void>(`${V}/recording-policies/${encodeURIComponent(id)}`),
  evaluate: (country: string, region: string) =>
    api.get<PolicyEvaluation>(`${V}/recording-policies/evaluate?country=${encodeURIComponent(country)}&region=${encodeURIComponent(region)}`),
};
