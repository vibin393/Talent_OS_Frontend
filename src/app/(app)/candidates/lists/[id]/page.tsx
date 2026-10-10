import type { Metadata } from "next";
import { ListDetail } from "@/features/candidates/list-detail";

export const metadata: Metadata = { title: "Saved list" };

export default async function Page({ params }: PageProps<"/candidates/lists/[id]">) {
  const { id } = await params;
  return <ListDetail key={id} id={id} />;
}
