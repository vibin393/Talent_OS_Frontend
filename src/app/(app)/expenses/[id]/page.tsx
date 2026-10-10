import type { Metadata } from "next";
import { ExpenseClaimDetail } from "@/features/expenses/expense-claim-detail";

export const metadata: Metadata = { title: "Expense claim" };

export default async function Page({ params }: PageProps<"/expenses/[id]">) {
  const { id } = await params;
  return <ExpenseClaimDetail key={id} id={id} />;
}
