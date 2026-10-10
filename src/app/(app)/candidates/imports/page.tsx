import type { Metadata } from "next";
import { ImportView } from "@/features/candidates/import-view";

export const metadata: Metadata = { title: "Import candidates" };

export default function Page() {
  return <ImportView />;
}
