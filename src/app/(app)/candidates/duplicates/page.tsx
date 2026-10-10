import type { Metadata } from "next";
import { DuplicatesView } from "@/features/candidates/duplicates-view";

export const metadata: Metadata = { title: "Duplicate candidates" };

export default function Page() {
  return <DuplicatesView />;
}
