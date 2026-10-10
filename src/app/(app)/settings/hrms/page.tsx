import type { Metadata } from "next";
import { HrmsSettingsPage } from "@/features/hrms-sync/settings-page";

export const metadata: Metadata = { title: "HRMS sync" };

export default function Page() {
  return <HrmsSettingsPage />;
}
