import type { Metadata } from "next";
import { ImmigrationDashboard } from "@/features/immigration/dashboard";

export const metadata: Metadata = { title: "Immigration" };

export default function Page() {
  return <ImmigrationDashboard />;
}
