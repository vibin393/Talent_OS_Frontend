import type { Metadata } from "next";
import { PurchaseOrdersView } from "@/features/commercials/purchase-orders/purchase-orders-view";

export const metadata: Metadata = { title: "Purchase orders" };

export default function PurchaseOrdersPage() {
  return <PurchaseOrdersView />;
}
