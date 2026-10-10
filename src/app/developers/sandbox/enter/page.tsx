import type { Metadata } from "next";
import { TokenAction } from "@/features/developers/auth-forms";

export const metadata: Metadata = { title: "Opening your sandbox", robots: { index: false, follow: false } };

export default function Page() {
  return <TokenAction kind="handoff" />;
}
