import { platformRequest } from "@/lib/api/platform-client";

const P = "/api/v1/platform/network";
const enc = encodeURIComponent;

export type PlatformMember = {
  id: string;
  display_name: string;
  public_slug: string;
  status: string;
  verification_status: string;
  violation_count: number;
  suspended_reason: string | null;
  requested_at: string | null;
};
export type PlatformListing = { id: string; title: string; agency: string; status: string; hold_reasons: string[]; open_reports: number };
export type PlatformReport = { id: string; listing_id: string; listing_title: string; reason: string; details: string | null; status: string; created_at: string };
export type PlatformNetworkAnalytics = {
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_country: Record<string, number>;
};

const get = <T>(path: string, signal?: AbortSignal) => platformRequest<T>(`${P}${path}`, { signal });
const post = <T>(path: string, body?: unknown) => platformRequest<T>(`${P}${path}`, { method: "POST", body });

export const networkConsoleApi = {
  verificationQueue: (signal?: AbortSignal) => get<PlatformMember[]>("/verification-queue", signal),
  members: (signal?: AbortSignal) => get<PlatformMember[]>("/members", signal),
  heldListings: (signal?: AbortSignal) => get<PlatformListing[]>("/held-listings", signal),
  reports: (signal?: AbortSignal) => get<PlatformReport[]>("/reports", signal),
  analytics: (signal?: AbortSignal) => get<PlatformNetworkAnalytics>("/analytics", signal),

  verifyMember: (id: string, reason: string) => post<PlatformMember>(`/members/${enc(id)}/verify`, { reason }),
  rejectMember: (id: string, reason: string) => post<PlatformMember>(`/members/${enc(id)}/reject`, { reason }),
  suspendMember: (id: string, reason: string) => post<PlatformMember>(`/members/${enc(id)}/suspend`, { reason }),
  reinstateMember: (id: string, reason: string) => post<PlatformMember>(`/members/${enc(id)}/reinstate`, { reason }),

  suspendListing: (id: string, reason: string) => post<PlatformListing>(`/listings/${enc(id)}/suspend`, { reason }),
  reinstateListing: (id: string, reason: string) => post<PlatformListing>(`/listings/${enc(id)}/reinstate`, { reason }),
  removeListing: (id: string, reason: string) => post<PlatformListing>(`/listings/${enc(id)}/remove`, { reason }),
  releaseHold: (id: string, reason: string) => post<PlatformListing>(`/listings/${enc(id)}/release-hold`, { reason }),

  upholdReport: (id: string, reason: string) => post<void>(`/reports/${enc(id)}/uphold`, { reason }),
  dismissReport: (id: string, reason: string) => post<void>(`/reports/${enc(id)}/dismiss`, { reason }),
};
