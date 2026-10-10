"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { offerKeys, offersApi } from "./api";

/** Object URL for a PDF blob, revoked when it changes or the component unmounts. */
export function useBlobUrl(blob: Blob | undefined): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

/**
 * The letter PDF for an offer: the live preview of the current (draft) version, keyed on `stamp` (the offer's
 * `updated_at`, so it re-renders after each save), or a stored past version.
 */
export function useLetterPreview(offerId: string, stamp: string, versionNo: number | null) {
  const q = useQuery({
    queryKey: [...offerKeys.preview(offerId, stamp), versionNo ?? "current"],
    queryFn: ({ signal }) => (versionNo ? offersApi.letter(offerId, versionNo, signal) : offersApi.letterPreview(offerId, signal)),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const url = useBlobUrl(q.data);
  return { ...q, url };
}
