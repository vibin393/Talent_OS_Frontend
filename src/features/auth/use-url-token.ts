"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { tokenFromHash } from "./url-token";

const noopSubscribe = () => () => {};

// First value read per key during this page load, so clearing storage after success does not make
// the still-mounted form flip to "invalid link" before navigation.
const firstRead = new Map<string, string>();

function readStored(key: string): string {
  const cached = firstRead.get(key);
  if (cached !== undefined) return cached;
  let value = tokenFromHash(window.location.hash);
  if (value) {
    // Keep the fragment token for a reload of the (soon fragment-less) page.
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // ignore: the token still works for this page view
    }
  } else {
    try {
      value = window.sessionStorage.getItem(key) ?? "";
    } catch {
      value = "";
    }
  }
  firstRead.set(key, value);
  return value;
}

export function clearUrlToken(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Single-use token delivered in the URL fragment (`#token=`, Epic 12) or, for links emailed before
 * that change, the query (`?token=`). It is saved to sessionStorage and stripped from the address bar
 * with `history.replaceState`, so a reload of the (now token-less) page can still use it.
 *
 * Returns `{ token, ready }`: `ready` is false until the client can read sessionStorage (server render
 * and hydration), so callers can show a loading state instead of flashing "invalid link".
 */
export function useUrlToken(key: string, initialToken: string | undefined) {
  const [fromUrl] = useState(() => initialToken ?? "");
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const stored = useSyncExternalStore(noopSubscribe, () => readStored(key), () => "");

  useEffect(() => {
    if (fromUrl) {
      try {
        window.sessionStorage.setItem(key, fromUrl);
      } catch {
        // ignore: the token still works for this page view
      }
    }
    if (window.location.search || window.location.hash) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, [key, fromUrl]);

  return { token: fromUrl || stored, ready: fromUrl !== "" || hydrated };
}
