import type { Metadata } from "next";
import { DscView } from "@/features/billing/dsc/dsc-view";

export const metadata: Metadata = { title: "DSC signing" };

export default function Page() {
  return <DscView />;
}
