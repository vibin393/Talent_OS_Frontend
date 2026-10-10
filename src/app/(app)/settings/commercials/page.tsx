import type { Metadata } from "next";
import { CommercialsSettings } from "@/features/commercials/settings/commercials-settings";

export const metadata: Metadata = { title: "Commercial settings" };

export default function CommercialsSettingsPage() {
  return <CommercialsSettings />;
}
