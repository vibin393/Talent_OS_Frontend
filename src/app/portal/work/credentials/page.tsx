import type { Metadata } from "next";
import { WorkCredentials } from "@/features/compliance/work-credentials";

export const metadata: Metadata = { title: "My credentials" };

export default function Page() {
  return <WorkCredentials />;
}
