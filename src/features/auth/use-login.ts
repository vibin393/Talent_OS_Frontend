"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthOut, MfaVerifyIn, UserLogin } from "@/lib/api/types";
import { setLastWorkspace } from "@/lib/workspace";
import { authApi, authKeys } from "./api";
import { isMfaChallenge } from "./mfa";

/**
 * Password step. Resolves with the session, or with `{mfa_required: true}` for MFA users (the caller then
 * shows the code step, see `useMfaVerify`); only a real session replaces the cached `me`.
 */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UserLogin) => authApi.login(body),
    onSuccess: (result, variables) => {
      setLastWorkspace(variables.tenant_slug);
      if (isMfaChallenge(result)) return;
      queryClient.clear();
      queryClient.setQueryData<AuthOut>(authKeys.me, result);
    },
  });
}

/** Second sign-in step: a TOTP code or a recovery code against the `tos_mfa` challenge cookie. */
export function useMfaVerify() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: MfaVerifyIn) => authApi.mfaVerify(body),
    onSuccess: (user) => {
      queryClient.clear();
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}
