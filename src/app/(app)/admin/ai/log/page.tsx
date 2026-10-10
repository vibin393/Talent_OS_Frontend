import type { Metadata } from "next";
import { ActionLogPage } from "@/features/ai-governance/action-log-page";

export const metadata: Metadata = { title: "AI action log" };

export default async function Page({ searchParams }: PageProps<"/admin/ai/log">) {
  const { id } = await searchParams;
  return <ActionLogPage initialSearch={typeof id === "string" ? id : ""} />;
}
