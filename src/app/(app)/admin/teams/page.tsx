import type { Metadata } from "next";
import { TeamsView } from "@/features/admin/teams-view";

export const metadata: Metadata = { title: "Teams" };

export default function Page() {
  return <TeamsView />;
}
