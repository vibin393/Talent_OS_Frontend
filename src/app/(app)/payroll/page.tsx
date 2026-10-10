import type { Metadata } from "next";
import { PayrollHome } from "@/features/payroll/payroll-home";

export const metadata: Metadata = { title: "Payroll" };

export default function Page() {
  return <PayrollHome />;
}
