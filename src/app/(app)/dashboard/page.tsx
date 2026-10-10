import type { Metadata } from "next";
import { DashboardView } from "@/features/dashboards/dashboard-view";
import { PinnedReports } from "@/features/report-builder/pinned-reports";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, v);
  }
  return (
    <>
      <DashboardView initialSearch={search.toString()} />
      {/* Epic 47 (decision 12): the user's pinned custom reports, each a viewer-scoped run. */}
      <PinnedReports />
    </>
  );
}
