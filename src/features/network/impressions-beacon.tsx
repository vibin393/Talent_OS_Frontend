"use client";

import { useEffect, useRef } from "react";

/**
 * Impressions beacon (Epic 75, B1). Reports the listing ids that scroll into view, in batches, with no identifiers.
 * Uses IntersectionObserver; sends at most 50 ids per POST to `/stats/impressions` (204).
 */
export function ImpressionsBeacon({ listingIds }: { listingIds: string[] }) {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    function flush() {
      timer = null;
      const batch = [...pending].slice(0, 50);
      pending.clear();
      if (batch.length === 0) return;
      void fetch("/api/v1/public/network/stats/impressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_ids: batch }),
        credentials: "omit",
        keepalive: true,
      }).catch(() => undefined);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.listingId;
          if (id && !seen.current.has(id)) {
            seen.current.add(id);
            pending.add(id);
            observer.unobserve(entry.target);
          }
        }
        if (pending.size > 0 && timer === null) timer = setTimeout(flush, 1500);
      },
      { threshold: 0.5 },
    );

    for (const id of listingIds) {
      const el = document.querySelector(`[data-listing-id="${CSS.escape(id)}"]`);
      if (el) observer.observe(el);
    }
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [listingIds]);

  return null;
}
