import type { Metadata } from "next";
import { DemandList } from "@/features/demands/demand-list";
import { CopilotListContext } from "@/features/copilot/list-context";

export const metadata: Metadata = { title: "Demands" };

export default async function DemandsPage({ searchParams }: PageProps<"/demands">) {
  const params = await searchParams;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, v);
  }
  return (
    <>
      <CopilotListContext kind="demands" />
      <DemandList initialSearch={search.toString()} />
    </>
  );
}
