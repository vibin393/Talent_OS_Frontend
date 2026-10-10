import type { Metadata } from "next";
import { BankImportView } from "@/features/receivables/tools-views";

export const metadata: Metadata = { title: "Bank import" };

export default function Page() {
  return <BankImportView />;
}
