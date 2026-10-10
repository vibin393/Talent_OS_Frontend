import type { Metadata } from "next";
import { TenantsView } from "@/features/platform/tenants-view";

export const metadata: Metadata = { title: "Tenants" };

export default function Page() {
  return <TenantsView />;
}
