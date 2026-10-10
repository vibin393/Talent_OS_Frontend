import type { Metadata } from "next";
import { WorkerExpenseClaim } from "@/features/expenses/worker-expense-claim";

export const metadata: Metadata = { title: "Expense claim" };

export default async function Page({ params }: PageProps<"/portal/work/expenses/[id]">) {
  const { id } = await params;
  return <WorkerExpenseClaim key={id} id={id} />;
}
