import type { Metadata } from "next";
import { WorkHelp } from "@/features/work-portal/help/help-page";

export const metadata: Metadata = { title: "Onboarding help" };

export default async function Page({ params }: PageProps<"/portal/work/help/[id]">) {
  const { id } = await params;
  return <WorkHelp key={id} threadId={id} />;
}
