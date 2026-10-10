import type { Metadata } from "next";
import { ExportsPage } from "@/features/exports/exports-page";

export const metadata: Metadata = { title: "My exports" };

export default function Page() {
  return <ExportsPage />;
}
