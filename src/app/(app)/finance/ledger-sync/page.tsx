import type { Metadata } from "next";
import { LedgerSyncPage } from "@/features/ledger-sync/ledger-sync-page";

export const metadata: Metadata = { title: "Ledger sync" };

export default function Page() {
  return <LedgerSyncPage />;
}
