import type { Metadata } from "next";
import { SalesDashboard } from "@/features/crm/dashboard/sales-dashboard";

export const metadata: Metadata = { title: "Sales dashboard" };

export default function SalesPage() {
  return <SalesDashboard />;
}
