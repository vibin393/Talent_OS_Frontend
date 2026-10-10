import type { Metadata } from "next";
import { ContractsView } from "@/features/commercials/contracts/contracts-view";

export const metadata: Metadata = { title: "Contracts" };

export default function ContractsPage() {
  return <ContractsView />;
}
