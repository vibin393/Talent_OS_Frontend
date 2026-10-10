import type { Metadata } from "next";
import { NewCandidatePage } from "@/features/candidates/resume-upload";

export const metadata: Metadata = { title: "New candidate" };

export default async function Page({ searchParams }: PageProps<"/candidates/new">) {
  const { from } = await searchParams;
  return <NewCandidatePage fromResume={from === "resume"} />;
}
