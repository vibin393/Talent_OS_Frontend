import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingPage } from "@/features/marketplace/listing-page";

export const metadata: Metadata = { title: "Integration" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense>
      <ListingPage slug={slug} />
    </Suspense>
  );
}
