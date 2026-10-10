import type { Metadata } from "next";
import { VendorSubmissionsView } from "@/features/vendor-portal/submissions";

export const metadata: Metadata = { title: "Submissions" };

export default async function VendorSubmissionsPage({ searchParams }: PageProps<"/vendor/submissions">) {
  const sp = await searchParams;
  const release = typeof sp.release === "string" ? sp.release : null;
  return <VendorSubmissionsView releaseId={release} />;
}
