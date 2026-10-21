"use client";

import { ModuleKpiDashboard, type Kpi } from "../kpi";
import { usePortalDashboard } from "./api";

/** Native Job Portal (recruiter) dashboard inside the Talent OS shell (data via the module gateway). */
export function PortalDashboard() {
  const { data, isPending, isError, refetch } = usePortalDashboard();
  const kpis: Kpi[] = data
    ? [
        { label: "Active jobs", value: data.active_jobs, hint: `${data.draft_jobs} draft · ${data.closed_jobs} closed` },
        { label: "Applicants", value: data.total_applicants, hint: `${data.new_applicants_7d} new (7d)` },
        { label: "Shortlisted", value: data.shortlisted },
        { label: "Interview", value: data.interview, hint: `${data.hired} hired` },
        { label: "Invites sent", value: data.invites_sent },
      ]
    : [];
  return (
    <ModuleKpiDashboard
      title="Job Portal"
      subtitle="Hiring & applicants — live, inside Talent OS."
      kpis={kpis}
      isPending={isPending}
      isError={isError}
      onRetry={() => refetch()}
    />
  );
}
