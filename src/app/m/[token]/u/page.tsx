import type { Metadata } from "next";
import { UnsubscribePage } from "@/features/campaigns/unsubscribe-page";

// Tokenised public page: never indexed, never leaks the URL as a referrer.
export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

/** `/m/[token]/u` (Epic 39): public marketing unsubscribe, outside `(app)`, no sign-in. */
export default async function Page({ params }: PageProps<"/m/[token]/u">) {
  const { token } = await params;
  return <UnsubscribePage key={token} token={token} />;
}
