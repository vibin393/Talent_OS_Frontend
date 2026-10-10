import type { Metadata } from "next";
import { ProposalInboxPage } from "@/features/proposal-inbox/proposal-inbox-page";

export const metadata: Metadata = { title: "Proposals" };

export default async function Page({ searchParams }: PageProps<"/proposals">) {
  const { id } = await searchParams;
  return <ProposalInboxPage initialId={typeof id === "string" ? id : null} />;
}
