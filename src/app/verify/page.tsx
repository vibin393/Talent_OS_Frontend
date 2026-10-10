import type { Metadata } from "next";
import { PublicVerifyPage } from "@/features/esign/public-verify-page";

// Public certificate check, outside the app shell: never indexed.
export const metadata: Metadata = {
  title: "Verify a signed document",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

/** `/verify?c=<certificate id>` */
export default async function Page({ searchParams }: PageProps<"/verify">) {
  const { c } = await searchParams;
  const certificateId = typeof c === "string" && c.trim() ? c.trim() : null;
  return <PublicVerifyPage key={certificateId ?? ""} certificateId={certificateId} />;
}
