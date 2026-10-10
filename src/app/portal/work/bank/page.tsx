import type { Metadata } from "next";
import { WorkBank } from "@/features/work-portal/work-pages";

export const metadata: Metadata = { title: "Bank details" };

export default function Page() {
  return <WorkBank />;
}
