"use client";

import { useEffect, useState } from "react";

/** Essential-cookie banner (Epic 75, B1). Sets only the essential `jn_consent=1` flag; never tracks. */
export function CookieBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(document.cookie.includes("jn_consent=1"));
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;
  return (
    <div className="jobs-cookie-banner" role="region" aria-label="Cookie notice">
      <span>We use only essential cookies. We do not track you across agencies.</span>
      <button
        type="button"
        className="jobs-button"
        onClick={() => {
          try {
            document.cookie = `jn_consent=1; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
      >
        OK
      </button>
    </div>
  );
}
