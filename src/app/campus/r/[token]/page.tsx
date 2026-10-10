import type { Metadata } from "next";
import { PublicDriveRegistration } from "@/features/campus/public/public-drive-registration";

// Public campus registration (Epic 43): outside `(app)` (no session), never indexed, no referrer leak of the token.
export const metadata: Metadata = {
  title: "Campus registration",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

/** `/campus/r/[token]`: a student registers for a campus drive. */
export default async function Page({ params }: PageProps<"/campus/r/[token]">) {
  const { token } = await params;
  return <PublicDriveRegistration key={token} token={token} />;
}
