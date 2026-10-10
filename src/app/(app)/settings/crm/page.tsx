import type { Metadata } from "next";
import { CrmSettings } from "@/features/crm/settings/crm-settings";

export const metadata: Metadata = { title: "Sales settings" };

export default function CrmSettingsPage() {
  return <CrmSettings />;
}
