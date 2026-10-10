import type { Metadata } from "next";
import { JobNetworkAdmin } from "@/features/network/admin/job-network-admin";

export const metadata: Metadata = { title: "Job network" };

export default function Page() {
  return <JobNetworkAdmin />;
}
