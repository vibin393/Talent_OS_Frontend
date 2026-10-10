import { api } from "@/lib/api/client";

const V = "/api/v1";
const enc = encodeURIComponent;

export type NetworkSettings = {
  joined: boolean;
  member_status: string | null;
  verification_status: string | null;
  list_mode: string;
  show_logo: boolean;
  exclude_client_ids: string[];
  terms_version_current: string;
  terms_accepted_at: string | null;
  listing_limit: number;
  live_count: number;
  suspended_reason: string | null;
  sandbox: boolean;
};

export type MyListing = {
  listing_id: string;
  posting_ref: string;
  title: string;
  status: string;
  hold_reasons: string[];
  views: number;
  apply_clicks: number;
  impressions: number;
  applications: number;
  listed_at: string | null;
};

export type MyListingsPage = { items: MyListing[]; total: number; page: number; page_size: number };

export type AnalyticsRow = {
  listing_id: string;
  title: string;
  impressions: number;
  views: number;
  apply_clicks: number;
  applications: number;
  conversion: number;
};

export type NetworkAnalytics = { rows: AnalyticsRow[]; totals: AnalyticsRow | null };

export const networkAdminApi = {
  settings: () => api.get<NetworkSettings>(`${V}/job-network/settings`),
  join: (body: { terms_version: string; list_mode: string; show_logo: boolean }) =>
    api.post<NetworkSettings>(`${V}/job-network/join`, body),
  update: (body: { list_mode?: string; show_logo?: boolean; exclude_client_ids?: string[] }) =>
    api.patch<NetworkSettings>(`${V}/job-network/settings`, body),
  leave: (reason?: string) => api.post<NetworkSettings>(`${V}/job-network/leave${reason ? `?reason=${enc(reason)}` : ""}`),
  listings: (status?: string) =>
    api.get<MyListingsPage>(`${V}/job-network/listings${status ? `?status=${enc(status)}` : ""}`),
  requestReview: (listingId: string, note: string) =>
    api.post<unknown>(`${V}/job-network/listings/${enc(listingId)}/request-review`, { note }),
  analytics: () => api.get<NetworkAnalytics>(`${V}/job-network/analytics`),
};

export const LISTING_STATUS_LABELS: Record<string, string> = {
  listed: "Listed",
  pending_checks: "Checks pending",
  held: "Held",
  suspended: "Suspended",
  unlisted: "Unlisted",
  removed: "Removed",
};
