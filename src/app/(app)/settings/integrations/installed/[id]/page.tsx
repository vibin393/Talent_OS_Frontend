import type { Metadata } from "next";
import { Suspense } from "react";
import { InstalledDetail } from "@/features/marketplace/installed-detail";

export const metadata: Metadata = { title: "Installed integration" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <InstalledDetail id={id} />
    </Suspense>
  );
}
