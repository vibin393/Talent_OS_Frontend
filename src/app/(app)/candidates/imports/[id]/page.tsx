import type { Metadata } from "next";
import { ImportDetail } from "@/features/candidates/import-detail";

export const metadata: Metadata = { title: "Import" };

export default async function Page({ params }: PageProps<"/candidates/imports/[id]">) {
  const { id } = await params;
  return <ImportDetail key={id} id={id} />;
}
