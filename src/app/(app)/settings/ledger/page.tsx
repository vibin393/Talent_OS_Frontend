import type { Metadata } from "next";
import { LedgerSettingsPage } from "@/features/ledger-sync/settings-page";

export const metadata: Metadata = { title: "Ledger sync" };

export default function Page() {
  return <LedgerSettingsPage />;
}
