import type { Metadata } from "next";
import { P5DashboardsPage } from "@/features/dashboards/p5/p5-dashboards-page";

export const metadata: Metadata = { title: "Integration dashboards" };

export default function Page() {
  return <P5DashboardsPage />;
}
