import type { Metadata } from "next";
import { Client360 } from "@/features/clients/client-360";
import { parseClientTab } from "@/features/clients/query";

export const metadata: Metadata = { title: "Client" };

export default async function Page({ params, searchParams }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <Client360 key={id} clientId={id} initialTab={parseClientTab(tab)} />;
}
