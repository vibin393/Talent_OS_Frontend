import type { Metadata } from "next";
import { WorkImmigrationCase } from "@/features/immigration/work-immigration";

export const metadata: Metadata = { title: "Immigration case" };

export default async function Page({ params }: PageProps<"/portal/work/immigration/[id]">) {
  const { id } = await params;
  return <WorkImmigrationCase key={id} id={id} />;
}
