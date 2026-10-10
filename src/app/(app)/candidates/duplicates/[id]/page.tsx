import type { Metadata } from "next";
import { MergeCompare } from "@/features/candidates/merge-compare";

export const metadata: Metadata = { title: "Review duplicate" };

export default async function Page({ params }: PageProps<"/candidates/duplicates/[id]">) {
  const { id } = await params;
  return <MergeCompare key={id} id={id} />;
}
