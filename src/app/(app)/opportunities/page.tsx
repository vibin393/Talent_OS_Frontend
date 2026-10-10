import type { Metadata } from "next";
import { opportunityFiltersFromParams } from "@/features/crm/api";
import { OpportunitiesView } from "@/features/crm/opportunities/opportunities-view";

export const metadata: Metadata = { title: "Opportunities" };

export default async function OpportunitiesPage({ searchParams }: PageProps<"/opportunities">) {
  const sp = await searchParams;
  const view = sp.view === "list" || sp.view === "board" ? sp.view : undefined;
  return <OpportunitiesView initialFilters={opportunityFiltersFromParams(sp)} initialView={view} />;
}
