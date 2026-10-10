import type { Metadata } from "next";
import { Candidate360 } from "@/features/candidates/candidate-360";

export const metadata: Metadata = { title: "Candidate" };

export default async function Page({ params }: PageProps<"/candidates/[id]">) {
  const { id } = await params;
  return <Candidate360 key={id} id={id} />;
}
