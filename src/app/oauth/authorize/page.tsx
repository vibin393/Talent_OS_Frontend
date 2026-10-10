import type { Metadata } from "next";
import { ConsentView } from "@/features/apps/consent-view";

export const metadata: Metadata = { title: "Allow access", robots: { index: false, follow: false } };

/** The OAuth consent page (Epic 67, spec B2): outside the app shell; the backend sends frame-ancestors 'none'. */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  return <ConsentView query={query.toString()} />;
}
