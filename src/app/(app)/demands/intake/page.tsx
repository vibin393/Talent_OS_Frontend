import type { Metadata } from "next";
import { IntakeInbox } from "@/features/agents/demand/intake-inbox";

export const metadata: Metadata = { title: "Intake inbox" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : null;
  return <IntakeInbox initialMessageId={message} />;
}
