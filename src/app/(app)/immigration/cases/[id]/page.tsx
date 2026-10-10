import type { Metadata } from "next";
import { ImmigrationCaseDetail } from "@/features/immigration/case-detail";

export const metadata: Metadata = { title: "Immigration case" };

export default async function Page({ params }: PageProps<"/immigration/cases/[id]">) {
  const { id } = await params;
  return <ImmigrationCaseDetail key={id} id={id} />;
}
