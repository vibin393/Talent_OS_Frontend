import type { Metadata } from "next";
import { ItemBank } from "@/features/assessments/item-bank";

export const metadata: Metadata = { title: "Assessment item bank" };

export default function Page() {
  return <ItemBank />;
}
