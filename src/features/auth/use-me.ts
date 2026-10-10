"use client";

import { useQuery } from "@tanstack/react-query";
import { authApi, authKeys } from "./api";

/** The signed-in user. A 401 fires the global unauthorized handler (redirect to /login). */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: ({ signal }) => authApi.me(signal),
    staleTime: 60_000,
    retry: false,
  });
}
