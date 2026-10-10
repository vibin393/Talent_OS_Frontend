"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/components/toast";
import { isApiError } from "@/lib/api/errors";
import { LOGIN_PATH } from "@/lib/navigation";
import { authApi } from "./api";

/**
 * Sign out: POST logout, clear the query cache and hard-navigate to /login so no signed-in state
 * survives. A 401 means the session is already gone and also counts as signed out; any other failure
 * keeps the user where they are (the server session may still be valid).
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout();
      } catch (error) {
        if (!(isApiError(error) && error.status === 401)) throw error;
      }
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.replace(LOGIN_PATH);
    },
    onError: () => {
      toast.error("Couldn't sign out, please try again");
    },
  });
}
