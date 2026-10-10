import type { Metadata } from "next";
import { PortalSignPage } from "@/features/esign/portal-signatures";

export const metadata: Metadata = { title: "Sign a document" };

export default async function Page({ params }: PageProps<"/portal/work/signatures/[signerId]">) {
  const { signerId } = await params;
  return <PortalSignPage key={signerId} signerId={signerId} />;
}
