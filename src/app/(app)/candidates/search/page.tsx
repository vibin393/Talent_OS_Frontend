import type { Metadata } from "next";
import { Suspense } from "react";
import { GridSkeleton } from "@/features/admin/ui";
import { CandidateSearchPage } from "@/features/search/search-page";

export const metadata: Metadata = { title: "Search candidates" };

export default function Page() {
  // The page reads its state from the URL (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense fallback={<GridSkeleton rows={6} />}>
      <CandidateSearchPage />
    </Suspense>
  );
}
