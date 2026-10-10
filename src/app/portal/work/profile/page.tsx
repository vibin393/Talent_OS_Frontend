import type { Metadata } from "next";
import { WorkProfile } from "@/features/work-portal/work-pages";

export const metadata: Metadata = { title: "Work profile" };

export default function Page() {
  return <WorkProfile />;
}
