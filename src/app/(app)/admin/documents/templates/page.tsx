import type { Metadata } from "next";
import { TemplatesAdmin } from "@/features/documents/templates-admin";

export const metadata: Metadata = { title: "Document templates" };

export default function Page() {
  return <TemplatesAdmin />;
}
