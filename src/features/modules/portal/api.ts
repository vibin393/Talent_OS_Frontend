/** Job Portal (recruiter) data for native Talent OS pages — via the module gateway. */

import { useQuery } from "@tanstack/react-query";
import { moduleApi } from "../api";

export type PortalDashboard = {
  active_jobs: number;
  closed_jobs: number;
  draft_jobs: number;
  total_applicants: number;
  new_applicants_7d: number;
  shortlisted: number;
  interview: number;
  hired: number;
  invites_sent: number;
};

export const portalKeys = { dashboard: ["modules", "portal", "dashboard"] as const };

export function usePortalDashboard() {
  return useQuery({
    queryKey: portalKeys.dashboard,
    queryFn: () => moduleApi.get<PortalDashboard>("portal", "/recruiter/dashboard"),
    staleTime: 30_000,
  });
}
