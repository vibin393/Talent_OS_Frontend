"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { AppLink } from "@/components/app-link";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { getLastWorkspace, setLastWorkspace } from "@/lib/workspace";
import { authApi } from "./api";
import { FormAlert } from "./form-alert";
import { useFormStyles } from "./form-styles";
import { type ForgotPasswordValues, forgotPasswordSchema } from "./schemas";
import { applyServerFieldErrors } from "./server-errors";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";

export const RESET_REQUESTED_MESSAGE = "If an account exists, we've emailed a link";

export function ForgotPasswordForm() {
  const styles = useFormStyles();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { tenant_slug: "", email: "" },
  });

  useEffect(() => {
    const last = getLastWorkspace();
    if (last && !form.getValues("tenant_slug")) form.setValue("tenant_slug", last);
  }, [form]);

  async function onSubmit(values: ForgotPasswordValues) {
    setFormError(null);
    try {
      await authApi.requestPasswordReset(values);
    } catch (error) {
      // Never reveal whether the account exists: 2xx (the 202 body is empty) and 404 read as success.
      const ok = isApiError(error) && ((error.status >= 200 && error.status < 300) || error.status === 404);
      if (!ok) {
        if (isApiError(error) && error.status === 422 && applyServerFieldErrors(error, form.setError, ["tenant_slug", "email"])) {
          return;
        }
        setFormError(
          isApiError(error) && error.status === 429 ? "Too many requests, try again later" : errorMessage(error),
        );
        return;
      }
    }
    setLastWorkspace(values.tenant_slug);
    setSent(true);
  }

  if (sent) {
    return (
      <FormAlert message={RESET_REQUESTED_MESSAGE} variant="success">
        <p>The link expires in 1 hour.</p>
        <p>
          <AppLink href="/login">Back to sign in</AppLink>
        </p>
      </FormAlert>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className={styles.form}>
      <FormAlert message={formError} />
      <TextField
        control={form.control}
        name="tenant_slug"
        label="Workspace"
        autoComplete="organization"
        autoCapitalize="none"
        spellCheck={false}
      />
      <TextField
        control={form.control}
        name="email"
        label="Email"
        type="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
      />
      <SubmitButton pending={form.formState.isSubmitting}>Email me a reset link</SubmitButton>
      <AppLink href="/login" className={styles.center}>
        Back to sign in
      </AppLink>
    </form>
  );
}
