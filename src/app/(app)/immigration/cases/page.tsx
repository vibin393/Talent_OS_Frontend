import type { Metadata } from "next";
import { Suspense } from "react";
import { ImmigrationCasesView } from "@/features/immigration/cases-view";

export const metadata: Metadata = { title: "Immigration cases" };

export default function Page() {
  return (
    <Suspense>
      <ImmigrationCasesView />
    </Suspense>
  );
}
