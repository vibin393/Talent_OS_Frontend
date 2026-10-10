/** Sales CRM API client (Epic 15) and react-query keys. */
import { api } from "@/lib/api/client";
import type {
  BoardOut,
  ClientOpportunitiesOut,
  CrmSettingsOut,
  CrmSettingsUpdate,
  DashboardOut,
  DuplicateCheckIn,
  DuplicateMatch,
  LeadConvertIn,
  LeadConvertOut,
  LeadCreate,
  LeadImportOut,
  LeadOut,
  LeadPage,
  LeadSourceIn,
  LeadSourceOut,
  LeadSourceUpdate,
  LeadStatus,
  LeadTransitionIn,
  LeadUpdate,
  OpportunityCreate,
  OpportunityLineIn,
  OpportunityOut,
  OpportunityPage,
  OpportunityStage,
  OpportunityTransitionIn,
  OpportunityUpdate,
  ReasonCodeIn,
  ReasonCodeOut,
  ReasonCodeUpdate,
  ReasonKind,
  RecordKind,
  RecordLinkOut,
  Service,
  StatusHistoryOut,
  SummaryGroupBy,
  SummaryOut,
  WinIn,
  WinOut,
  WonPreviewOut,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

export type LeadFilters = {
  q: string;
  status: LeadStatus | null;
  ownerId: string | null;
  source: string | null;
  createdFrom: string | null;
  createdTo: string | null;
};
export const EMPTY_LEAD_FILTERS: LeadFilters = {
  q: "",
  status: null,
  ownerId: null,
  source: null,
  createdFrom: null,
  createdTo: null,
};

export type OpportunityFilters = {
  q: string;
  stage: OpportunityStage | null;
  ownerId: string | null;
  accountManagerId: string | null;
  clientId: string | null;
  closeFrom: string | null;
  closeTo: string | null;
  service: Service | null;
};
export const EMPTY_OPPORTUNITY_FILTERS: OpportunityFilters = {
  q: "",
  stage: null,
  ownerId: null,
  accountManagerId: null,
  clientId: null,
  closeFrom: null,
  closeTo: null,
  service: null,
};

function setIf(p: URLSearchParams, key: string, value: string | null | undefined) {
  const v = value?.trim();
  if (v) p.set(key, v);
}

export function leadQuery(f: LeadFilters, page?: number, pageSize?: number): string {
  const p = new URLSearchParams();
  setIf(p, "q", f.q.slice(0, 200));
  setIf(p, "status", f.status);
  setIf(p, "owner_id", f.ownerId);
  setIf(p, "source", f.source);
  setIf(p, "created_from", f.createdFrom);
  setIf(p, "created_to", f.createdTo);
  if (page) p.set("page", String(page));
  if (pageSize) p.set("page_size", String(pageSize));
  return p.toString();
}

export function opportunityQuery(f: OpportunityFilters, page?: number, pageSize?: number): string {
  const p = new URLSearchParams();
  setIf(p, "q", f.q.slice(0, 200));
  setIf(p, "stage", f.stage);
  setIf(p, "owner_id", f.ownerId);
  setIf(p, "account_manager_id", f.accountManagerId);
  setIf(p, "client_id", f.clientId);
  setIf(p, "close_from", f.closeFrom);
  setIf(p, "close_to", f.closeTo);
  setIf(p, "service", f.service);
  if (page) p.set("page", String(page));
  if (pageSize) p.set("page_size", String(pageSize));
  return p.toString();
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) || null;

/** Lead filters from URL search params (dashboard drill-down links). */
export function leadFiltersFromParams(sp: SP): LeadFilters {
  return {
    q: one(sp.q) ?? "",
    status: (one(sp.status) as LeadStatus | null) ?? null,
    ownerId: one(sp.owner_id),
    source: one(sp.source),
    createdFrom: one(sp.created_from),
    createdTo: one(sp.created_to),
  };
}

/** Opportunity filters from URL search params (dashboard drill-down links). */
export function opportunityFiltersFromParams(sp: SP): OpportunityFilters {
  return {
    q: one(sp.q) ?? "",
    stage: (one(sp.stage) as OpportunityStage | null) ?? null,
    ownerId: one(sp.owner_id),
    accountManagerId: one(sp.account_manager_id),
    clientId: one(sp.client_id),
    closeFrom: one(sp.close_from),
    closeTo: one(sp.close_to),
    service: (one(sp.service) as Service | null) ?? null,
  };
}

export const crmApi = {
  // settings
  settings: (signal?: AbortSignal) => api.get<CrmSettingsOut>(`${V}/crm/settings`, { signal }),
  updateSettings: (body: CrmSettingsUpdate) => api.patch<CrmSettingsOut>(`${V}/crm/settings`, body),
  reasonCodes: (kind?: ReasonKind, signal?: AbortSignal) =>
    api.get<ReasonCodeOut[]>(`${V}/crm/reason-codes${kind ? `?kind=${kind}` : ""}`, { signal }),
  createReasonCode: (body: ReasonCodeIn) => api.post<ReasonCodeOut>(`${V}/crm/reason-codes`, body),
  updateReasonCode: (id: string, body: ReasonCodeUpdate) => api.patch<ReasonCodeOut>(`${V}/crm/reason-codes/${enc(id)}`, body),
  leadSources: (signal?: AbortSignal) => api.get<LeadSourceOut[]>(`${V}/crm/lead-sources`, { signal }),
  createLeadSource: (body: LeadSourceIn) => api.post<LeadSourceOut>(`${V}/crm/lead-sources`, body),
  updateLeadSource: (id: string, body: LeadSourceUpdate) => api.patch<LeadSourceOut>(`${V}/crm/lead-sources/${enc(id)}`, body),

  // leads
  leads: (f: LeadFilters, page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<LeadPage>(`${V}/leads?${leadQuery(f, page, pageSize)}`, { signal }),
  createLead: (body: LeadCreate) => api.post<LeadOut>(`${V}/leads`, body),
  duplicateCheck: (body: DuplicateCheckIn, signal?: AbortSignal) =>
    api.post<DuplicateMatch[]>(`${V}/leads/duplicate-check`, body, { signal }),
  lead: (id: string, signal?: AbortSignal) => api.get<LeadOut>(`${V}/leads/${enc(id)}`, { signal }),
  updateLead: (id: string, body: LeadUpdate) => api.patch<LeadOut>(`${V}/leads/${enc(id)}`, body),
  transitionLead: (id: string, body: LeadTransitionIn) => api.post<LeadOut>(`${V}/leads/${enc(id)}/transition`, body),
  archiveLead: (id: string) => api.post<LeadOut>(`${V}/leads/${enc(id)}/archive`),
  leadHistory: (id: string, signal?: AbortSignal) => api.get<StatusHistoryOut[]>(`${V}/leads/${enc(id)}/history`, { signal }),
  convertLead: (id: string, body: LeadConvertIn) => api.post<LeadConvertOut>(`${V}/leads/${enc(id)}/convert`, body),
  importTemplateUrl: `${V}/leads/import-template.csv`,
  importLeads: (form: FormData) => api.post<LeadImportOut>(`${V}/leads/import`, form),
  importStatus: (batchId: string, signal?: AbortSignal) =>
    api.get<LeadImportOut>(`${V}/lead-imports/${enc(batchId)}`, { signal }),
  importErrorsUrl: (batchId: string) => `${V}/lead-imports/${enc(batchId)}/errors.csv`,

  // opportunities
  opportunities: (f: OpportunityFilters, page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<OpportunityPage>(`${V}/opportunities?${opportunityQuery(f, page, pageSize)}`, { signal }),
  board: (f: OpportunityFilters, signal?: AbortSignal) => {
    const qs = opportunityQuery(f);
    return api.get<BoardOut>(`${V}/opportunities/board${qs ? `?${qs}` : ""}`, { signal });
  },
  summary: (groupBy: SummaryGroupBy, f: OpportunityFilters, signal?: AbortSignal) => {
    const qs = opportunityQuery(f);
    return api.get<SummaryOut>(`${V}/opportunities/summary?group_by=${groupBy}${qs ? `&${qs}` : ""}`, { signal });
  },
  createOpportunity: (body: OpportunityCreate) => api.post<OpportunityOut>(`${V}/opportunities`, body),
  opportunity: (id: string, signal?: AbortSignal) => api.get<OpportunityOut>(`${V}/opportunities/${enc(id)}`, { signal }),
  updateOpportunity: (id: string, body: OpportunityUpdate) => api.patch<OpportunityOut>(`${V}/opportunities/${enc(id)}`, body),
  replaceLines: (id: string, lines: OpportunityLineIn[]) =>
    api.put<OpportunityOut>(`${V}/opportunities/${enc(id)}/lines`, { lines }),
  transitionOpportunity: (id: string, body: OpportunityTransitionIn) =>
    api.post<OpportunityOut>(`${V}/opportunities/${enc(id)}/transition`, body),
  resetProbability: (id: string) => api.post<OpportunityOut>(`${V}/opportunities/${enc(id)}/reset-probability`),
  opportunityHistory: (id: string, signal?: AbortSignal) =>
    api.get<StatusHistoryOut[]>(`${V}/opportunities/${enc(id)}/history`, { signal }),
  wonPreview: (id: string) => api.post<WonPreviewOut>(`${V}/opportunities/${enc(id)}/won-preview`),
  win: (id: string, body: WinIn, idempotencyKey: string) =>
    api.post<WinOut>(`${V}/opportunities/${enc(id)}/win`, body, { headers: { "Idempotency-Key": idempotencyKey } }),
  clientOpportunities: (clientId: string, signal?: AbortSignal) =>
    api.get<ClientOpportunitiesOut>(`${V}/clients/${enc(clientId)}/opportunities`, { signal }),
  recordLink: (kind: RecordKind, recordId: string, signal?: AbortSignal) =>
    api.get<RecordLinkOut | null>(`${V}/crm/links?record_kind=${kind}&record_id=${enc(recordId)}`, { signal }),

  // dashboard
  dashboard: (params: { from: string; to: string; ownerIds?: string[]; teamId?: string | null }, signal?: AbortSignal) => {
    const p = new URLSearchParams({ from: params.from, to: params.to });
    if (params.ownerIds?.length) p.set("owner_ids", params.ownerIds.join(","));
    if (params.teamId) p.set("team_id", params.teamId);
    return api.get<DashboardOut>(`${V}/crm/dashboard?${p}`, { signal });
  },
};

/** Query keys. `board`, `opportunity`, `lead` roots are invalidated after CRM mutations. */
export const crmKeys = {
  settings: ["crm", "settings"] as const,
  reasonCodes: (kind?: ReasonKind) => ["crm", "reason-codes", kind ?? "all"] as const,
  reasonCodesAll: ["crm", "reason-codes"] as const,
  leadSources: ["crm", "lead-sources"] as const,
  leads: ["lead"] as const,
  leadList: (f: LeadFilters, page: number) => ["lead", "list", f, page] as const,
  lead: (id: string) => ["lead", "detail", id] as const,
  leadHistory: (id: string) => ["lead", "detail", id, "history"] as const,
  opportunities: ["opportunity"] as const,
  opportunityList: (f: OpportunityFilters, page: number) => ["opportunity", "list", f, page] as const,
  opportunitySummary: (g: SummaryGroupBy, f: OpportunityFilters) => ["opportunity", "summary", g, f] as const,
  opportunity: (id: string) => ["opportunity", "detail", id] as const,
  opportunityHistory: (id: string) => ["opportunity", "detail", id, "history"] as const,
  board: ["board"] as const,
  boardFor: (f: OpportunityFilters) => ["board", f] as const,
  clientOpportunities: (clientId: string) => ["client-360", "opportunities", clientId] as const,
  client360: ["client-360"] as const,
  recordLink: (kind: RecordKind, id: string) => ["crm", "link", kind, id] as const,
  dashboard: (from: string, to: string, ownerIds: string[], teamId: string | null) =>
    ["crm", "dashboard", from, to, ownerIds, teamId] as const,
};
