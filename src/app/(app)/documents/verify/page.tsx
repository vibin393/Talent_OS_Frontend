import type { Metadata } from "next";
import { VerifyPage } from "@/features/documents/verify-page";

export const metadata: Metadata = { title: "Verify a document" };

export default function Page() {
  return <VerifyPage />;
}
