"use client";

import { Body1, Button, Input, Text, makeStyles, tokens } from "@fluentui/react-components";
import { Copy20Regular, Checkmark20Filled } from "@fluentui/react-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AppLink } from "@/components/app-link";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { authApi, type SignupResult } from "./api";
import { FormAlert } from "./form-alert";
import { useFormStyles } from "./form-styles";
import { type SignupValues, signupSchema, slugFromName } from "./schemas";
import { applyServerFieldErrors } from "./server-errors";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";

const useStyles = makeStyles({
  success: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  linkBox: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  linkRow: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    alignItems: "center",
  },
  linkInput: { flex: 1 },
  note: { color: tokens.colorNeutralForeground3 },
  workspace: { color: tokens.colorNeutralForeground2 },
});

export function SignupForm() {
  const styles = useFormStyles();
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<SignupResult | null>(null);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { company_name: "", slug: "", admin_name: "", admin_email: "" },
  });

  // Auto-suggest the slug from the company name, but stop once the admin types their own: the field is
  // kept in sync only while it still equals the last suggestion we wrote.
  const companyName = useWatch({ control: form.control, name: "company_name" });
  const lastSuggested = useRef("");
  useEffect(() => {
    const suggestion = slugFromName(companyName ?? "");
    if (form.getValues("slug") === lastSuggested.current) {
      lastSuggested.current = suggestion;
      form.setValue("slug", suggestion, { shouldValidate: form.formState.isSubmitted });
    }
  }, [companyName, form]);

  const signup = useMutation({
    mutationFn: (values: SignupValues) => authApi.signup(values),
    onSuccess: (data) => setResult(data),
  });

  async function onSubmit(values: SignupValues) {
    setFormError(null);
    try {
      await signup.mutateAsync(values);
    } catch (error) {
      if (isApiError(error) && error.status === 422 && applyServerFieldErrors(error, form.setError, ["company_name", "slug", "admin_name", "admin_email"])) {
        return;
      }
      if (isApiError(error) && (error.code === "slug_taken" || error.code === "invalid_slug")) {
        form.setError("slug", { message: error.code === "slug_taken" ? "This workspace ID is already taken" : errorMessage(error) });
        return;
      }
      if (isApiError(error) && error.status === 429) {
        setFormError("Too many sign-ups from here; try again later.");
        return;
      }
      setFormError(errorMessage(error));
    }
  }

  if (result) return <SignupSuccess result={result} />;

  const pending = form.formState.isSubmitting || signup.isSuccess;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className={styles.form}>
      <FormAlert message={formError} />
      <TextField control={form.control} name="company_name" label="Company name" autoComplete="organization" />
      <TextField
        control={form.control}
        name="slug"
        label="Workspace ID"
        hint="Your sign-in address: <id>.talentos.localhost. Lowercase letters, digits and hyphens."
        autoCapitalize="none"
        spellCheck={false}
        placeholder="acme"
      />
      <TextField control={form.control} name="admin_name" label="Your name" autoComplete="name" />
      <TextField
        control={form.control}
        name="admin_email"
        label="Your email (workspace admin)"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
      />
      <SubmitButton pending={pending}>Create company</SubmitButton>
      <AppLink href="/login" className={styles.center}>
        Already have a workspace? Sign in
      </AppLink>
    </form>
  );
}

function SignupSuccess({ result }: { result: SignupResult }) {
  const styles = useStyles();
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(result.invite_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied: the link is visible in the field for the admin to copy manually.
    }
  }

  return (
    <div className={styles.success}>
      <FormAlert message="Workspace created" variant="success" />
      <Body1 className={styles.workspace} as="span" block>
        Your workspace is ready at <Text weight="semibold">{result.tenant_slug}.talentos.localhost</Text>
      </Body1>
      <div className={styles.linkBox}>
        <Text weight="semibold" as="span" block>
          Admin invitation link
        </Text>
        <Body1 className={styles.note} as="span" block>
          Open this link to set a password for <Text weight="semibold">{result.admin_email}</Text> and sign in.
        </Body1>
        <div className={styles.linkRow}>
          <Input className={styles.linkInput} readOnly value={result.invite_url} aria-label="Admin invitation link" />
          <Button
            icon={copied ? <Checkmark20Filled /> : <Copy20Regular />}
            onClick={copyLink}
            appearance="primary"
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <Body1 className={styles.note} as="span" block>
        In production this link is emailed to the admin. Locally there is no email, so it is shown here.
      </Body1>
      <AppLink href={result.invite_url}>Open the invitation</AppLink>
    </div>
  );
}
