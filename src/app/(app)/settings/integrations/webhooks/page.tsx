import type { Metadata } from "next";
import { SubscriptionsList } from "@/features/webhooks/subscriptions-list";

export const metadata: Metadata = { title: "Webhooks" };

export default function Page() {
  return <SubscriptionsList />;
}
