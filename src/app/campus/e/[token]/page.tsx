import type { Metadata } from "next";
import { PublicEventPage } from "@/features/events/public-event";

// Public event registration / check-in pass (Epic 43): outside `(app)`, never indexed, no referrer.
export const metadata: Metadata = {
  title: "Event registration",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

/** `/campus/e/[token]`: register for a recruitment event, or show a personal check-in pass. */
export default async function Page({ params }: PageProps<"/campus/e/[token]">) {
  const { token } = await params;
  return <PublicEventPage key={token} token={token} />;
}
