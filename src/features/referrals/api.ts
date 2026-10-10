import { api } from "@/lib/api/client";
import { downloadApiFile } from "@/lib/api/download";
import { ApiError, toApiError } from "@/lib/api/errors";
import { portalRequest } from "@/lib/api/portal-client";
import { type ReferralFilters, referralQuery } from "./logic";
import type {
  CandidateReferralOut,
  MarkPaidIn,
  ProgramIn,
  ProgramOut,
  PublicReferralOut,
  PublicReferralView,
  ReferIn,
  ReferralOut,
  ReferralPage,
  ReferralSettings,
  ReferrerOpeningOut,
  ReferrerReferralOut,
  ReferrerShareLinkOut,
  RewardOut,
  RewardStatus,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";
const ME = `${V}/me/referrals`;
const W = `${V}/portal/work/referrals`;

export function referForm(body: ReferIn): FormData {
  const form = new FormData();
  form.append("referee_name", body.referee_name.trim());
  form.append("referee_email", body.referee_email.trim());
  if (body.demand_id) form.append("demand_id", body.demand_id);
  if (body.referee_phone?.trim()) form.append("referee_phone", body.referee_phone.trim());
  if (body.relationship?.trim()) form.append("relationship", body.relationship.trim());
  if (body.note?.trim()) form.append("note", body.note.trim());
  form.append("resume", body.resume);
  return form;
}

/** The five self-service referrer calls; implemented for internal Users and for the Worker portal. */
export type ReferrerApi = {
  list: (signal?: AbortSignal) => Promise<ReferrerReferralOut[]>;
  openings: (signal?: AbortSignal) => Promise<ReferrerOpeningOut[]>;
  refer: (body: ReferIn) => Promise<ReferrerReferralOut>;
  shareLink: (demandId: string | null) => Promise<ReferrerShareLinkOut>;
  withdraw: (id: string) => Promise<ReferrerReferralOut>;
};

export const meReferralsApi: ReferrerApi = {
  list: (signal) => api.get<ReferrerReferralOut[]>(ME, { signal }),
  openings: (signal) => api.get<ReferrerOpeningOut[]>(`${ME}/openings`, { signal }),
  refer: (body) => api.post<ReferrerReferralOut>(ME, referForm(body)),
  shareLink: (demandId) => api.post<ReferrerShareLinkOut>(`${ME}/share-links`, { demand_id: demandId }),
  withdraw: (id) => api.post<ReferrerReferralOut>(`${ME}/${enc(id)}/withdraw`),
};

export const workReferralsApi: ReferrerApi = {
  list: (signal) => portalRequest<ReferrerReferralOut[]>(W, { signal }),
  openings: (signal) => portalRequest<ReferrerOpeningOut[]>(`${W}/openings`, { signal }),
  refer: (body) => portalRequest<ReferrerReferralOut>(W, { method: "POST", body: referForm(body) }),
  shareLink: (demandId) => portalRequest<ReferrerShareLinkOut>(`${W}/share-links`, { method: "POST", body: { demand_id: demandId } }),
  withdraw: (id) => portalRequest<ReferrerReferralOut>(`${W}/${enc(id)}/withdraw`, { method: "POST" }),
};

export const referralsApi = {
  // programs + settings
  programs: (includeArchived = false, signal?: AbortSignal) =>
    api.get<ProgramOut[]>(`${V}/referral-programs${includeArchived ? "?include_archived=true" : ""}`, { signal }),
  createProgram: (body: ProgramIn) => api.post<ProgramOut>(`${V}/referral-programs`, body),
  patchProgram: (id: string, body: Partial<ProgramIn>) => api.patch<ProgramOut>(`${V}/referral-programs/${enc(id)}`, body),
  archiveProgram: (id: string) => api.post<ProgramOut>(`${V}/referral-programs/${enc(id)}/archive`),
  settings: (signal?: AbortSignal) => api.get<ReferralSettings>(`${V}/referral-settings`, { signal }),
  saveSettings: (body: ReferralSettings) => api.put<ReferralSettings>(`${V}/referral-settings`, body),

  // referrals
  list: (filters: ReferralFilters, limit: number, offset: number, signal?: AbortSignal) =>
    api.get<ReferralPage>(`${V}/referrals${referralQuery(filters, limit, offset)}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<ReferralOut>(`${V}/referrals/${enc(id)}`, { signal }),
  byCandidate: (candidateId: string, signal?: AbortSignal) =>
    api.get<CandidateReferralOut[]>(`${V}/referrals/by-candidate/${enc(candidateId)}`, { signal }),
  linkDemand: (id: string, demandId: string) => api.post<ReferralOut>(`${V}/referrals/${enc(id)}/link-demand`, { demand_id: demandId }),
  downloadResume: (id: string) => downloadApiFile(`${V}/referrals/${enc(id)}/resume`, "resume"),

  // rewards
  rewards: (status: RewardStatus | null, signal?: AbortSignal) =>
    api.get<RewardOut[]>(`${V}/referral-rewards${status ? `?status=${enc(status)}` : ""}`, { signal }),
  voidReward: (id: string, reason: string) => api.post<RewardOut>(`${V}/referral-rewards/${enc(id)}/void`, { reason }),
  markPaid: (body: MarkPaidIn) => api.post<{ updated: number }>(`${V}/referral-rewards/mark-paid`, body),
  payoutExport: (format: "xlsx" | "csv") =>
    downloadApiFile(
      `${V}/referral-rewards/payout-export?status=approved&channel=payout_export&format=${enc(format)}`,
      `referral-payouts.${format}`,
    ),
};

// ---------------------------------------------------------------- public referee page (no session)
const PUB = `${V}/public/links`;

async function publicFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", ...init });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

export const publicReferralApi = {
  view: (token: string, signal?: AbortSignal) => publicFetch<PublicReferralView>(`${PUB}/${enc(token)}/referral`, { signal }),
  accept: (token: string, noticeId: string | null) =>
    publicFetch<PublicReferralOut>(`${PUB}/${enc(token)}/referral/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notice_id: noticeId, agreed: true }),
    }),
  decline: (token: string) => publicFetch<PublicReferralOut>(`${PUB}/${enc(token)}/referral/decline`, { method: "POST" }),
  submit: (
    token: string,
    body: { name: string; email: string; phone: string; resume: File; noticeId: string | null; botToken: string | null },
  ) => {
    const form = new FormData();
    form.append("name", body.name.trim());
    form.append("email", body.email.trim());
    if (body.phone.trim()) form.append("phone", body.phone.trim());
    form.append("resume", body.resume);
    if (body.noticeId) form.append("notice_id", body.noticeId);
    form.append("agreed", "true");
    form.append("bot_token", body.botToken ?? "");
    return publicFetch<PublicReferralOut>(`${PUB}/${enc(token)}/referral`, { method: "POST", body: form });
  },
};
