import type { Metadata } from "next";
import { WorkerExpenseList } from "@/features/expenses/worker-expense-list";

export const metadata: Metadata = { title: "My expenses" };

export default function Page() {
  return <WorkerExpenseList />;
}
