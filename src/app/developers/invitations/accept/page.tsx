import type { Metadata } from "next";
import { TokenAction } from "@/features/developers/auth-forms";

export const metadata: Metadata = { title: "Accept invitation", robots: { index: false, follow: false } };

export default function Page() {
  return <TokenAction kind="invitation" />;
}
