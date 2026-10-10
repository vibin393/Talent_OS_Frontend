import { api } from "@/lib/api/client";
import type {
  CampaignCreate,
  CampaignMessagesPage,
  CampaignOut,
  CampaignStatus,
  CampaignUpdate,
  FunnelOut,
  MarketingOptionsOut,
  MarketingSettingsOut,
  MarketingSettingsUpdate,
  TestSendOut,
} from "./types";

const enc = encodeURIComponent;
const M = "/api/v1/marketing";
const C = `${M}/campaigns`;

function query(params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const marketingApi = {
  settings: (signal?: AbortSignal) => api.get<MarketingSettingsOut>(`${M}/settings`, { signal }),
  updateSettings: (body: MarketingSettingsUpdate) => api.patch<MarketingSettingsOut>(`${M}/settings`, body),
  pause: (reason: string) => api.post<MarketingSettingsOut>(`${M}/settings/pause`, { reason }),
  resume: (reason: string) => api.post<MarketingSettingsOut>(`${M}/settings/resume`, { reason }),
  options: (signal?: AbortSignal) => api.get<MarketingOptionsOut>(`${M}/options`, { signal }),
  overview: (from: string | null, to: string | null, signal?: AbortSignal) =>
    api.get<FunnelOut>(`${M}/overview${query({ from, to })}`, { signal }),
};

export const campaignsApi = {
  list: (status: CampaignStatus | null, signal?: AbortSignal) => api.get<CampaignOut[]>(`${C}${query({ status })}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<CampaignOut>(`${C}/${enc(id)}`, { signal }),
  create: (body: CampaignCreate) => api.post<CampaignOut>(C, body),
  update: (id: string, body: CampaignUpdate) => api.patch<CampaignOut>(`${C}/${enc(id)}`, body),
  submit: (id: string, scheduled_at: string | null) => api.post<CampaignOut>(`${C}/${enc(id)}/submit`, { scheduled_at }),
  pause: (id: string) => api.post<CampaignOut>(`${C}/${enc(id)}/pause`),
  resume: (id: string) => api.post<CampaignOut>(`${C}/${enc(id)}/resume`),
  cancel: (id: string, reason: string) => api.post<CampaignOut>(`${C}/${enc(id)}/cancel`, { reason }),
  testSend: (id: string) => api.post<TestSendOut>(`${C}/${enc(id)}/test-send`),
  messages: (id: string, status: string | null, page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<CampaignMessagesPage>(`${C}/${enc(id)}/messages${query({ status, page, page_size: pageSize })}`, { signal }),
  analytics: (id: string, signal?: AbortSignal) => api.get<FunnelOut>(`${C}/${enc(id)}/analytics`, { signal }),
};

export const marketingKeys = {
  all: ["marketing"] as const,
  settings: ["marketing", "settings"] as const,
  options: ["marketing", "options"] as const,
  overview: (from: string | null, to: string | null) => ["marketing", "overview", from, to] as const,
  campaigns: ["marketing", "campaigns"] as const,
  campaignList: (status: CampaignStatus | null) => ["marketing", "campaigns", "list", status] as const,
  campaign: (id: string) => ["marketing", "campaigns", "detail", id] as const,
  messages: (id: string, status: string | null, page: number) => ["marketing", "campaigns", "messages", id, status, page] as const,
  analytics: (id: string) => ["marketing", "campaigns", "analytics", id] as const,
};
