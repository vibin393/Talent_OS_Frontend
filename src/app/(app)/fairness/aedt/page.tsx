import type { Metadata } from "next";
import { AedtView } from "@/features/fairness/aedt-view";

export const metadata: Metadata = { title: "AEDT inventory" };

export default function Page() {
  return <AedtView />;
}
