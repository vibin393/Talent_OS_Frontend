"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AppLink } from "@/components/app-link";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { authApi } from "./api";
import { FormAlert } from "./form-alert";
import { useFormStyles } from "./form-styles";
import { type FindWorkspaceValues, findWorkspaceSchema } from "./schemas";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";

// Shown after every submit, match or not: the page never reveals whether the email belongs to a workspace.
export const FIND_WORKSPACE_SENT_MESSAGE = "If we found workspaces for that email, we've emailed you the links";

export function FindWorkspaceForm() {
  const styles = useFormStyles();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FindWorkspaceValues>({
    resolver: zodResolver(findWorkspaceSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: FindWorkspaceValues) {
    setFormError(null);
    try {
      await authApi.findWorkspace(values.email);
    } catch (error) {
      // Never reveal existence: only a rate limit or a genuine transport/server failure is surfaced.
      if (isApiError(error) && error.status === 429) {
        setFormError("Too many requests, try again later");
        return;
      }
      if (isApiError(error) && (error.status === 0 || error.status >= 500)) {
        setFormError(errorMessage(error));
        return;
      }
    }
    setSent(true);
  }

  if (sent) {
    return (
      <FormAlert message={FIND_WORKSPACE_SENT_MESSAGE} variant="success">
        <p>Check your inbox for a link to each workspace you belong to.</p>
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
        name="email"
        label="Email"
        type="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
      />
      <SubmitButton pending={form.formState.isSubmitting}>Email me my workspace links</SubmitButton>
      <AppLink href="/login" className={styles.center}>
        Back to sign in
      </AppLink>
    </form>
  );
}
