import type { Metadata } from "next";
import { Suspense } from "react";
import { CopilotPage } from "@/features/copilot/copilot-page";

export const metadata: Metadata = { title: "Copilot history" };

export default function Page() {
  return (
    <Suspense>
      <CopilotPage />
    </Suspense>
  );
}
