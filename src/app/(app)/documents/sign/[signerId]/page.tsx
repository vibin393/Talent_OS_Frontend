import type { Metadata } from "next";
import { InternalSignPage } from "@/features/esign/internal-sign-page";

export const metadata: Metadata = { title: "Sign a document", referrer: "no-referrer" };

export default async function Page({ params }: PageProps<"/documents/sign/[signerId]">) {
  const { signerId } = await params;
  return <InternalSignPage key={signerId} signerId={signerId} />;
}
