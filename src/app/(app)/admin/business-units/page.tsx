import type { Metadata } from "next";
import { BusinessUnitsView } from "@/features/admin/business-units-view";

export const metadata: Metadata = { title: "Business units" };

export default function Page() {
  return <BusinessUnitsView />;
}
