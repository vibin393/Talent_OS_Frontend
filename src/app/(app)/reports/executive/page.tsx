import type { Metadata } from "next";
import { ExecutiveView } from "@/features/dashboards/p2/executive-grid";

export const metadata: Metadata = { title: "Executive summary" };

export default function ExecutivePage() {
  return <ExecutiveView />;
}
