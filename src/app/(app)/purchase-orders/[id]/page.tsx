import type { Metadata } from "next";
import { PurchaseOrderDetail } from "@/features/commercials/purchase-orders/po-detail";

export const metadata: Metadata = { title: "Purchase order" };

export default async function PurchaseOrderPage({ params }: PageProps<"/purchase-orders/[id]">) {
  const { id } = await params;
  return <PurchaseOrderDetail key={id} poId={id} />;
}
