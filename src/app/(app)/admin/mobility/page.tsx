import type { Metadata } from "next";
import { MobilityAdmin } from "@/features/mobility/admin-view";

export const metadata: Metadata = { title: "Internal mobility" };

export default function Page() {
  return <MobilityAdmin />;
}
