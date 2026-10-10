import type { Metadata } from "next";
import { VendorSubmissionDetail } from "@/features/vendor-portal/submissions";

export const metadata: Metadata = { title: "Submission" };

export default async function VendorSubmissionPage({ params }: PageProps<"/vendor/submissions/[id]">) {
  const { id } = await params;
  return <VendorSubmissionDetail key={id} id={id} />;
}
