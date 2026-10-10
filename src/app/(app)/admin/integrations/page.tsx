import type { Metadata } from "next";
import { EcosystemConsolePage } from "@/features/ecosystem-console/console-page";

export const metadata: Metadata = { title: "Integrations" };

export default function Page() {
  return <EcosystemConsolePage />;
}
