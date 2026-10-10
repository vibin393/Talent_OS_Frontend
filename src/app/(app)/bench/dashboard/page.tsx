import type { Metadata } from "next";
import { BenchDashboard } from "@/features/bench/bench-dashboard";

export const metadata: Metadata = { title: "Bench dashboard" };

export default function BenchDashboardPage() {
  return <BenchDashboard />;
}
