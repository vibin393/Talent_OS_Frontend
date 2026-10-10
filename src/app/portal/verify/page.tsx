import type { Metadata } from "next";
import { VerifyView } from "@/features/portal/verify";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <VerifyView />;
}
