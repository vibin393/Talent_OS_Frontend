"use client";

import { Body1, Button, Skeleton, SkeletonItem, Text } from "@fluentui/react-components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AppLink } from "@/components/app-link";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { DEFAULT_APP_PATH } from "@/lib/navigation";
import { setLastWorkspace } from "@/lib/workspace";
import { authApi, authKeys } from "./api";
import { FormAlert } from "./form-alert";
import { useFormStyles } from "./form-styles";
import { type AcceptInviteValues, acceptInviteSchema } from "./schemas";
import { applyServerFieldErrors } from "./server-errors";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";
import { clearUrlToken, useUrlToken } from "./use-url-token";

const TOKEN_KEY = "tos:invite-token";

export const INVITATION_INVALID_MESSAGE = "This invitation has expired or was already used";

export function isInvalidInvitation(error: unknown): boolean {
  // 410 invitation_invalid; a malformed/unknown token may also surface as 404 or 422.
  return isApiError(error) && [404, 410, 422].includes(error.status);
}

function InvalidInvitation() {
  return (
    <FormAlert message={INVITATION_INVALID_MESSAGE}>
      <p>Ask your workspace administrator to send you a new invitation.</p>
      <p>
        <AppLink href="/login">Go to sign in</AppLink>
      </p>
    </FormAlert>
  );
}

/**
 * Accept an invitation. The token arrives in the URL fragment (`#token=`, or `?token=` in older emails); it is captured once and removed
 * from the address bar before the form renders so it does not linger in history or get copied.
 */
export function AcceptInviteForm({ initialToken }: { initialToken?: string }) {
  const styles = useFormStyles();
  const { token, ready } = useUrlToken(TOKEN_KEY, initialToken);

  const invitation = useQuery({
    queryKey: authKeys.invitation(token),
    queryFn: () => authApi.getInvitation(token),
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  if (ready && !token) return <InvalidInvitation />;
  if (!ready || invitation.isPending) {
    return (
      <Skeleton className={styles.skeleton} aria-busy="true" aria-label="Loading invitation">
        <SkeletonItem className={styles.skeletonLine} />
        <SkeletonItem size={32} />
        <SkeletonItem size={32} />
        <SkeletonItem size={32} />
      </Skeleton>
    );
  }
  if (invitation.isError) {
    if (isInvalidInvitation(invitation.error)) return <InvalidInvitation />;
    return (
      <FormAlert message={errorMessage(invitation.error)}>
        <div>
          <Button size="small" onClick={() => invitation.refetch()}>
            Try again
          </Button>
        </div>
      </FormAlert>
    );
  }

  return (
    <AcceptForm
      token={token}
      email={invitation.data.email}
      tenantName={invitation.data.tenant.name}
      tenantSlug={invitation.data.tenant.slug}
    />
  );
}

function AcceptForm({
  token,
  email,
  tenantName,
  tenantSlug,
}: {
  token: string;
  email: string;
  tenantName: string;
  tenantSlug: string;
}) {
  const styles = useFormStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [userExists, setUserExists] = useState(false);

  const accept = useMutation({
    mutationFn: (values: AcceptInviteValues) =>
      authApi.acceptInvitation(token, { name: values.name, password: values.password }),
    onSuccess: (session) => {
      queryClient.clear();
      queryClient.setQueryData(authKeys.me, session);
      setLastWorkspace(session.tenant.slug || tenantSlug);
      clearUrlToken(TOKEN_KEY);
    },
  });

  const form = useForm<AcceptInviteValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { name: "", password: "", confirm: "" },
  });

  async function onSubmit(values: AcceptInviteValues) {
    setFormError(null);
    setUserExists(false);
    try {
      await accept.mutateAsync(values);
      router.replace(DEFAULT_APP_PATH);
    } catch (error) {
      if (isApiError(error) && error.status === 422 && applyServerFieldErrors(error, form.setError, ["name", "password"])) {
        return;
      }
      if (isInvalidInvitation(error)) {
        clearUrlToken(TOKEN_KEY);
        setInvalid(true);
        return;
      }
      if (isApiError(error) && error.code === "seat_limit_reached") {
        setFormError("Your workspace has no free seats. Ask your administrator to increase the seat limit.");
        return;
      }
      if (isApiError(error) && error.code === "user_exists") {
        setUserExists(true);
        return;
      }
      setFormError(errorMessage(error));
    }
  }

  if (invalid) return <InvalidInvitation />;

  const pending = form.formState.isSubmitting || accept.isSuccess;

  return (
    <div className={styles.stack}>
      <div className={styles.info}>
        <Body1>
          You&apos;ve been invited to join <Text weight="semibold">{tenantName}</Text>.
        </Body1>
        <Body1 className={styles.muted}>
          Create your account for <Text weight="semibold">{email}</Text>
        </Body1>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className={styles.form}>
        <FormAlert message={formError} />
        <FormAlert message={userExists ? "An account with this email already exists in this workspace." : null}>
          <p>
            <AppLink href="/login">Sign in instead</AppLink>
          </p>
        </FormAlert>
        {/* Lets password managers associate the new password with the account. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <TextField control={form.control} name="name" label="Your name" autoComplete="name" />
        <TextField
          control={form.control}
          name="password"
          label="Password"
          hint="At least 10 characters. Avoid common passwords."
          type="password"
          autoComplete="new-password"
        />
        <TextField control={form.control} name="confirm" label="Confirm password" type="password" autoComplete="new-password" />
        <SubmitButton pending={pending}>Create account</SubmitButton>
      </form>
    </div>
  );
}
