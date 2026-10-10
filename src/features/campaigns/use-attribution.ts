"use client";

import { useSyncExternalStore } from "react";
import { readAttributionToken, withAttribution } from "./attribution";

const noopSubscribe = () => () => {};

/** `href` carrying the current page's `tos_ct` (server render and first paint use the plain href). */
export function useAttributedHref(href: string): string {
  const search = useSyncExternalStore(
    noopSubscribe,
    () => window.location.search,
    () => "",
  );
  return withAttribution(href, readAttributionToken(search));
}
