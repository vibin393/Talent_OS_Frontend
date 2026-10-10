/** Server-side loaders for the career site routes: API 404s become Next `notFound()` (a real 404). */
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { isNotFound, publicCareers } from "@/lib/api/public-server";
import { requestOrigin } from "./format";

const SLUG = /^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (isNotFound(e)) notFound();
    throw e;
  }
}

export const loadBranding = cache(async (slug: string) => {
  if (!SLUG.test(slug)) notFound();
  return orNotFound(publicCareers.branding(slug));
});

export const loadPosting = cache(async (slug: string, postingId: string) => {
  if (!SLUG.test(slug) || !UUID.test(postingId)) notFound();
  return orNotFound(publicCareers.posting(slug, postingId));
});

export const loadApplyForm = cache(async (slug: string, postingId: string) => {
  if (!SLUG.test(slug) || !UUID.test(postingId)) notFound();
  return orNotFound(publicCareers.applyForm(slug, postingId));
});

/** Absolute origin of this request, for canonical URLs, OpenGraph images and the sitemap. */
export async function siteOrigin(): Promise<string> {
  return requestOrigin(await headers(), process.env.FRONTEND_URL ?? "http://localhost:3000");
}
