import type { Metadata } from "next";
import { ExpenseClaimsView } from "@/features/expenses/expense-claims-view";

export const metadata: Metadata = { title: "Expenses" };

export default function Page() {
  return <ExpenseClaimsView />;
}
