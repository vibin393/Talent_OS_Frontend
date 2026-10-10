import type { Metadata } from "next";
import { ClientTimeDefaultsPage } from "@/features/timesheets/config-pages";

export const metadata: Metadata = { title: "Timesheet defaults" };

export default async function Page({ params }: PageProps<"/timesheets/clients/[clientId]/defaults">) {
  const { clientId } = await params;
  return <ClientTimeDefaultsPage key={clientId} clientId={clientId} />;
}
