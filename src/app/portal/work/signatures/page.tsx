import type { Metadata } from "next";
import { PortalSignaturesList } from "@/features/esign/portal-signatures";

export const metadata: Metadata = { title: "Documents to sign" };

export default function Page() {
  return <PortalSignaturesList />;
}
