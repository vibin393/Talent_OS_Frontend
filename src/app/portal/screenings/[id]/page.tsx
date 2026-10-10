import type { Metadata } from "next";
import { ScreeningView } from "@/features/portal/screening-view";

export const metadata: Metadata = { title: "Screening questions" };

export default async function Page({ params }: PageProps<"/portal/screenings/[id]">) {
  const { id } = await params;
  return <ScreeningView id={id} />;
}
