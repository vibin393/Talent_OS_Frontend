import { api } from "@/lib/api/client";
import { ApiError, toApiError } from "@/lib/api/errors";
import { portalRequest } from "@/lib/api/portal-client";
import type { AnswerValue, Question } from "./logic";

const enc = encodeURIComponent;

export type Referee = {
  id: string;
  name: string;
  relationship: string | null;
  company: string | null;
  email: string;
  phone: string | null;
  status: "pending" | "sent" | "responded" | "declined" | "expired";
  sent_at: string | null;
  expires_at: string | null;
  responded_at: string | null;
};

export type ReferenceCheck = {
  id: string;
  candidate_id: string;
  case_id: string | null;
  check_id: string | null;
  min_referees: number;
  status: "requested" | "sent" | "responded" | "declined" | "expired" | "reviewed";
  questionnaire_snapshot: { name?: string; questions?: Question[] };
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  referees: Referee[];
};

export type ReferenceResponses = {
  reference_check_id: string;
  questions: Question[];
  responses: { referee_id: string; referee_name: string; relationship: string | null; company: string | null; submitted_at: string; answers: Record<string, AnswerValue> }[];
};

export type PortalReferenceCheck = {
  id: string;
  status: ReferenceCheck["status"];
  min_referees: number;
  consent_given: boolean;
  notice_id: string | null;
  notice_title: string | null;
  notice_body_md: string | null;
  referees: { id: string; name: string; relationship: string | null; company: string | null; status: Referee["status"] }[];
  created_at: string;
};

export type RefereeIn = { name: string; relationship?: string | null; company?: string | null; email: string; phone?: string | null };

export type ReferenceFormView = { tenant_name: string | null; candidate_name: string | null; referee_name: string | null; questions: Question[]; status: string };

export const referencesApi = {
  forCandidate: (candidateId: string, signal?: AbortSignal) =>
    api.get<ReferenceCheck[]>(`/api/v1/candidates/${enc(candidateId)}/reference-checks`, { signal }),
  request: (candidateId: string, body: { min_referees: number; questionnaire_id?: string | null; check_id?: string | null }) =>
    api.post<ReferenceCheck>(`/api/v1/candidates/${enc(candidateId)}/reference-checks`, body),
  responses: (id: string, signal?: AbortSignal) => api.get<ReferenceResponses>(`/api/v1/reference-checks/${enc(id)}/responses`, { signal }),
  review: (id: string, note: string | null) => api.post<ReferenceCheck>(`/api/v1/reference-checks/${enc(id)}/review`, { note }),
};

export const workReferencesApi = {
  list: (signal?: AbortSignal) => portalRequest<PortalReferenceCheck[]>("/api/v1/portal/work/reference-checks", { signal }),
  addReferees: (id: string, referees: RefereeIn[], noticeId: string | null) =>
    portalRequest<PortalReferenceCheck>(`/api/v1/portal/work/reference-checks/${enc(id)}/referees`, {
      method: "POST",
      body: { referees, agreed: noticeId !== null, consent_notice_id: noticeId },
    }),
};

async function publicFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: { Accept: "application/json", ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

export const publicReferenceApi = {
  view: (token: string) => publicFetch<ReferenceFormView>(`/api/v1/public/links/${enc(token)}/reference`),
  submit: (token: string, answers: Record<string, AnswerValue>) =>
    publicFetch<{ status: string }>(`/api/v1/public/links/${enc(token)}/reference`, { method: "POST", body: { answers } }),
  decline: (token: string) => publicFetch<{ status: string }>(`/api/v1/public/links/${enc(token)}/reference/decline`, { method: "POST" }),
};
