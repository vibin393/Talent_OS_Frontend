import type { Metadata } from "next";
import { ApplicationDetailView } from "@/features/portal/application-detail";

export const metadata: Metadata = { title: "Application" };

export default async function Page({ params }: PageProps<"/portal/applications/[id]">) {
  const { id } = await params;
  return <ApplicationDetailView id={id} />;
}
