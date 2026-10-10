import type { Metadata } from "next";
import { GovernanceProposalsPage } from "@/features/proposal-inbox/governance-proposals-page";

export const metadata: Metadata = { title: "Proposals" };

export default async function Page({ searchParams }: PageProps<"/admin/ai/proposals">) {
  const { id } = await searchParams;
  return <GovernanceProposalsPage initialId={typeof id === "string" ? id : null} />;
}
