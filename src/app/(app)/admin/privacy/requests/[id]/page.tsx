import type { Metadata } from "next";
import { DsrDetail } from "@/features/privacy/dsr-detail";

export const metadata: Metadata = { title: "Data subject request" };

export default async function Page({ params }: PageProps<"/admin/privacy/requests/[id]">) {
  const { id } = await params;
  return <DsrDetail key={id} id={id} />;
}
