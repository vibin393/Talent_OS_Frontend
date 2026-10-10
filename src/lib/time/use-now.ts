"use client";

import { useEffect, useState } from "react";

/** Current epoch milliseconds, refreshed every `intervalMs` (keeps render pure for "now"-dependent views). */
export function useNowMs(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
