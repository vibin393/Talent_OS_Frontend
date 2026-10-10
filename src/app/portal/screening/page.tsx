import type { Metadata } from "next";
import { PortalScreeningChats } from "@/features/agents/screening/portal-chats";

export const metadata: Metadata = { title: "Chats with recruiters" };

export default function Page() {
  return <PortalScreeningChats />;
}
