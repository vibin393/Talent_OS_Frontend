import type { Metadata } from "next";
import { PrivacyCenter } from "@/features/privacy/privacy-center";

export const metadata: Metadata = { title: "Privacy center" };

export default async function Page({ searchParams }: PageProps<"/admin/privacy">) {
  const { tab } = await searchParams;
  return <PrivacyCenter initialTab={typeof tab === "string" ? tab : undefined} />;
}
