import type { Metadata } from "next";
import { ContractDetail } from "@/features/commercials/contracts/contract-detail";

export const metadata: Metadata = { title: "Contract" };

export default async function ContractPage({ params }: PageProps<"/contracts/[id]">) {
  const { id } = await params;
  return <ContractDetail key={id} contractId={id} />;
}
