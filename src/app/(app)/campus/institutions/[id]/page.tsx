import type { Metadata } from "next";
import { InstitutionEditor } from "@/features/campus/institutions/institution-editor";

export const metadata: Metadata = { title: "Institution" };

/** `/campus/institutions/[id]` (Epic 43); `new` creates one. */
export default async function Page({ params }: PageProps<"/campus/institutions/[id]">) {
  const { id } = await params;
  return <InstitutionEditor key={id} id={id === "new" ? null : id} />;
}
