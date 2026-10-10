import type { Metadata } from "next";
import { ExpensePoliciesAdmin } from "@/features/expenses/expense-policies-admin";

export const metadata: Metadata = { title: "Expense policies" };

export default function Page() {
  return <ExpensePoliciesAdmin />;
}
