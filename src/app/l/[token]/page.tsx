import type { Metadata } from "next";
import { PublicLinkPage } from "@/features/public-links/public-link-page";

// Secure-link pages: never indexed, never leak the tokenised URL as a referrer.
export const metadata: Metadata = {
  title: "Secure link",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

/** `/l/[token]`: public secure-link page (AI screening, consent request, client feedback), outside `(app)`. */
export default async function Page({ params }: PageProps<"/l/[token]">) {
  const { token } = await params;
  return <PublicLinkPage key={token} token={token} />;
}
