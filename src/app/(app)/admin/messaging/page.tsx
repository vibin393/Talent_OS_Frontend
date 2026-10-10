import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagingAdmin } from "@/features/messaging/messaging-admin";

export const metadata: Metadata = { title: "Messaging" };

export default function Page() {
  return (
    <Suspense>
      <MessagingAdmin />
    </Suspense>
  );
}
