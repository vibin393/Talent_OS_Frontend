import type { Metadata } from "next";
import { leadFiltersFromParams } from "@/features/crm/api";
import { LeadsView } from "@/features/crm/leads/leads-view";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const sp = await searchParams;
  return <LeadsView initialFilters={leadFiltersFromParams(sp)} />;
}
