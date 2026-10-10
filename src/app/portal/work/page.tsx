import type { Metadata } from "next";
import { WorkHome } from "@/features/work-portal/work-pages";

export const metadata: Metadata = { title: "My work" };

export default function Page() {
  return <WorkHome />;
}
