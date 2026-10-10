import type { Metadata } from "next";
import { Suspense } from "react";
import { IntegrationsPage } from "@/features/marketplace/integrations-page";

export const metadata: Metadata = { title: "Integrations" };

export default function Page() {
  return (
    <Suspense>
      <IntegrationsPage />
    </Suspense>
  );
}
