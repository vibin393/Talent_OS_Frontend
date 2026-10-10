import type { Metadata } from "next";
import { EchoPanel } from "@/features/webhooks/echo-panel";

export const metadata: Metadata = { title: "Echo endpoint" };

export default function Page() {
  return <EchoPanel />;
}
