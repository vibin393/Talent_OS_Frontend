import type { Metadata } from "next";
import { VendorReleaseDetail } from "@/features/vendor-portal/releases";

export const metadata: Metadata = { title: "Release" };

export default async function VendorReleasePage({ params }: PageProps<"/vendor/releases/[id]">) {
  const { id } = await params;
  return <VendorReleaseDetail key={id} id={id} />;
}
