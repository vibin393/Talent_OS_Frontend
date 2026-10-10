import type { Metadata } from "next";
import { VendorDetail } from "@/features/vendors/vendor-detail";

export const metadata: Metadata = { title: "Vendor" };

export default async function VendorPage({ params }: PageProps<"/vendors/[id]">) {
  const { id } = await params;
  return <VendorDetail key={id} id={id} />;
}
