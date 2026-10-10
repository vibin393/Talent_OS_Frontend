"use client";

import { useEffect, useState } from "react";

/** `value`, updated only after it has been stable for `ms` milliseconds (300 ms by default). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
