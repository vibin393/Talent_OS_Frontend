"use client";

import { Skeleton, SkeletonItem } from "@fluentui/react-components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { errorMessage, fieldErrors, isApiError } from "@/lib/api/errors";
import { LOGIN_PATH } from "@/lib/navigation";
import { authApi } from "./api";
import { FormAlert } from "./form-alert";
import { useFormStyles } from "./form-styles";
import { type NewPasswordValues, newPasswordSchema } from "./schemas";
import { applyServerFieldErrors } from "./server-errors";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";
import { clearUrlToken, useUrlToken } from "./use-url-token";

const TOKEN_KEY = "tos:reset-token";

export const RESET_INVALID_MESSAGE = "This reset link has expired or was already used";

function InvalidLink() {
  return (
    <FormAlert message={RESET_INVALID_MESSAGE}>
      <p>
        <AppLink href="/forgot-password">Request a new link</AppLink>
      </p>
    </FormAlert>
  );
}

/** Set a new password from an emailed reset link. The token is removed from the address bar on mount. */
export function ResetPasswordForm({ initialToken }: { initialToken?: string }) {
  const styles = useFormStyles();
  const router = useRouter();
  const toast = useAppToast();
  const { token, ready } = useUrlToken(TOKEN_KEY, initialToken);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: NewPasswordValues) {
    if (done) return;
    setFormError(null);
    try {
      await authApi.confirmPasswordReset({ token, password: values.password });
      setDone(true);
      clearUrlToken(TOKEN_KEY);
      toast.success("Your password has been changed. Sign in with your new password.");
      router.replace(LOGIN_PATH);
    } catch (error) {
      if (isApiError(error) && (error.status === 410 || error.status === 404)) {
        clearUrlToken(TOKEN_KEY);
        setInvalid(true);
        return;
      }
      if (isApiError(error) && error.status === 422) {
        if (applyServerFieldErrors(error, form.setError, ["password"])) return;
        if (fieldErrors(error).token) {
          setInvalid(true);
          return;
        }
      }
      setFormError(errorMessage(error));
    }
  }

  if (!ready) {
    return (
      <Skeleton aria-label="Loading">
        <SkeletonItem className={styles.skeletonBlock} />
      </Skeleton>
    );
  }
  if ((!token && !done) || invalid) return <InvalidLink />;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className={styles.form}>
      <FormAlert message={formError} />
      <TextField
        control={form.control}
        name="password"
        label="New password"
        hint="At least 10 characters. Avoid common passwords."
        type="password"
        autoComplete="new-password"
      />
      <TextField control={form.control} name="confirm" label="Confirm new password" type="password" autoComplete="new-password" />
      <SubmitButton pending={form.formState.isSubmitting} disabled={form.formState.isSubmitting || done}>
        Set new password
      </SubmitButton>
    </form>
  );
}
