import type { Metadata } from "next";
import { Suspense } from "react";
import { SubscriptionDetail } from "@/features/webhooks/subscription-detail";

export const metadata: Metadata = { title: "Webhook" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <SubscriptionDetail id={id} />
    </Suspense>
  );
}
