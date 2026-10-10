import type { Metadata } from "next";
import { PayrollPeriodView } from "@/features/payroll/payroll-period";

export const metadata: Metadata = { title: "Pay period" };

export default async function Page({ params }: PageProps<"/payroll/periods/[id]">) {
  const { id } = await params;
  return <PayrollPeriodView key={id} periodId={id} />;
}
