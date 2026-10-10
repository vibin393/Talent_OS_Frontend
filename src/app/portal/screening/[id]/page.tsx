import type { Metadata } from "next";
import { PortalScreeningChat } from "@/features/agents/screening/portal-chats";

export const metadata: Metadata = { title: "Chat with a recruiter" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PortalScreeningChat id={id} />;
}
