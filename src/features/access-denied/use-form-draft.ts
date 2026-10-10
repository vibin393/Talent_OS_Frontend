"use client";

import { useCallback, useEffect, useRef } from "react";

const PREFIX = "tos-form-draft:";

/** Save `values` under `key` in sessionStorage (silently ignored when storage is unavailable). */
export function saveFormDraft(key: string, values: unknown): void {
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(values));
  } catch {
    // private mode / quota / SSR: the draft is a convenience only
  }
}

/** Read and remove the draft saved under `key`. */
export function takeFormDraft<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    if (raw === null) return null;
    window.sessionStorage.removeItem(PREFIX + key);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Keep a form's values across the "reload to continue" of an exhausted CSRF retry (FR-82): on mount the
 * saved draft (if any) is handed to `restore` once; `saveAndReload(values)` stores them and reloads.
 */
export function useFormDraft<T>(key: string, restore: (values: T) => void) {
  const restored = useRef(false);
  const restoreRef = useRef(restore);
  useEffect(() => {
    restoreRef.current = restore;
  });
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const draft = takeFormDraft<T>(key);
    if (draft !== null) restoreRef.current(draft);
  }, [key]);
  const saveAndReload = useCallback(
    (values: T) => {
      saveFormDraft(key, values);
      window.location.reload();
    },
    [key],
  );
  return { saveAndReload };
}
