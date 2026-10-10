import type { Metadata } from "next";
import { PayrollAdmin } from "@/features/payroll/payroll-admin";

export const metadata: Metadata = { title: "Payroll settings" };

export default function Page() {
  return <PayrollAdmin />;
}
