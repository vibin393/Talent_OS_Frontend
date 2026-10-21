"use client";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Spinner,
  Subtitle2,
  Switch,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Mail24Regular, Send20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { adminErrorMessage } from "@/features/admin/errors";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { useAdminMutation } from "@/features/admin/use-admin-data";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { mailApi, mailKeys } from "./api";
import type { MailBackend, MailSettings } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "640px" },
  card: { maxWidth: "640px", padding: tokens.spacingHorizontalXL, gap: tokens.spacingVerticalM },
  nested: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    paddingInlineStart: tokens.spacingHorizontalXXL,
  },
  row: { display: "flex", alignItems: "flex-end", gap: tokens.spacingHorizontalS },
  grow: { flex: 1 },
  muted: { color: tokens.colorNeutralForeground2 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS },
});

/** `/admin/email-settings` — tenant outbound email (platform mailbox vs own SMTP server). */
export function MailSettingsView() {
  const canRead = usePermission("settings:read");
  const canManage = usePermission("settings:manage");
  const query = useQuery({
    queryKey: mailKeys.settings,
    queryFn: ({ signal }) => mailApi.get(signal),
    enabled: canRead,
  });

  if (!canRead) return <NoAccess what="email settings" />;

  return (
    <>
      <PageHeader
        title="Email settings"
        subtitle="Choose how this organization sends outbound email — through the shared platform mailbox or your own SMTP server."
      />
      {query.isPending ? (
        <GridSkeleton rows={6} />
      ) : query.isError ? (
        <ErrorBar title="Could not load email settings." message={errorMessage(query.error)} />
      ) : (
        <>
          <MailForm key={query.dataUpdatedAt} data={query.data} canManage={canManage} />
          <TestEmailCard canManage={canManage} />
        </>
      )}
    </>
  );
}

function MailForm({ data, canManage }: { data: MailSettings; canManage: boolean }) {
  const styles = useStyles();
  const [backend, setBackend] = useState<MailBackend>(data.backend);
  const [host, setHost] = useState(data.smtp_address);
  const [port, setPort] = useState(String(data.smtp_port || 587));
  const [username, setUsername] = useState(data.smtp_username);
  // Write-only: blank means "keep the stored password". We only send a password the admin types.
  const [password, setPassword] = useState("");
  const [useSsl, setUseSsl] = useState(data.smtp_use_ssl);
  const [senderName, setSenderName] = useState(data.sender_name);
  const [senderEmail, setSenderEmail] = useState(data.sender_email);
  const [enabled, setEnabled] = useState(data.enabled);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isSmtp = backend === "smtp";
  const hostError = submitted && isSmtp && !host.trim() ? "Enter the SMTP server host." : undefined;
  const senderEmailError = submitted && isSmtp && !senderEmail.trim() ? "Enter a sender email address." : undefined;
  const portNumber = Number.parseInt(port, 10);
  const portError =
    submitted && isSmtp && (!Number.isFinite(portNumber) || portNumber < 1 || portNumber > 65535)
      ? "Enter a port between 1 and 65535."
      : undefined;

  const save = useAdminMutation({
    mutationFn: () =>
      mailApi.update({
        backend,
        smtp_address: host.trim(),
        smtp_port: Number.isFinite(portNumber) ? portNumber : 587,
        smtp_username: username.trim(),
        // Omit the password unless the admin typed a new one (keeps the stored one).
        ...(password ? { smtp_password: password } : {}),
        smtp_use_ssl: useSsl,
        sender_email: senderEmail.trim(),
        sender_name: senderName.trim(),
        enabled,
      }),
    invalidate: [mailKeys.settings],
    success: "Email settings saved.",
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (isSmtp && (hostError || senderEmailError || portError)) return;
    if (isSmtp && (!host.trim() || !senderEmail.trim())) return;
    save
      .mutateAsync()
      .then(() => setPassword(""))
      .catch((err) => setFormError(adminErrorMessage(err)));
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <ErrorBar message={formError} />
      <MessageBar intent="info">
        <MessageBarBody>
          <strong>Platform email</strong> sends from the shared Talent OS mailbox — nothing to configure.{" "}
          <strong>Your own SMTP server</strong> sends from your account and domain, so recipients see your address and
          your domain&apos;s reputation is used.
        </MessageBarBody>
      </MessageBar>

      <Field label="Outbound email">
        <RadioGroup
          value={backend}
          disabled={!canManage}
          onChange={(_, d) => setBackend(d.value as MailBackend)}
        >
          <Radio value="platform" label="Use platform email (shared Talent OS mailbox)" />
          <Radio value="smtp" label="Use our own SMTP server" />
        </RadioGroup>
      </Field>

      {isSmtp && (
        <div className={styles.nested}>
          <div className={styles.row}>
            <Field className={styles.grow} label="SMTP host" required validationMessage={hostError}>
              <Input
                value={host}
                placeholder="smtp.example.com"
                disabled={!canManage}
                onChange={(_, d) => setHost(d.value)}
              />
            </Field>
            <Field label="Port" validationMessage={portError}>
              <Input
                type="number"
                value={port}
                disabled={!canManage}
                onChange={(_, d) => setPort(d.value)}
              />
            </Field>
          </div>
          <Field label="Username">
            <Input
              value={username}
              placeholder="apikey or user@example.com"
              autoComplete="off"
              disabled={!canManage}
              onChange={(_, d) => setUsername(d.value)}
            />
          </Field>
          <Field
            label="Password"
            hint={data.password_set ? "A password is configured. Leave blank to keep it." : "Required to connect."}
          >
            <Input
              type="password"
              value={password}
              placeholder={data.password_set ? "••••••••" : ""}
              autoComplete="new-password"
              disabled={!canManage}
              contentAfter={
                data.password_set && !password ? (
                  <Badge appearance="tint" color="success">
                    Configured
                  </Badge>
                ) : undefined
              }
              onChange={(_, d) => setPassword(d.value)}
            />
          </Field>
          <Switch
            label="Use SSL/TLS"
            checked={useSsl}
            disabled={!canManage}
            onChange={(_, d) => setUseSsl(d.checked)}
          />
        </div>
      )}

      <Field label="Sender name" hint="Shown as the From name on messages.">
        <Input
          value={senderName}
          placeholder="Acme Talent"
          disabled={!canManage}
          onChange={(_, d) => setSenderName(d.value)}
        />
      </Field>
      <Field label="Sender email" required={isSmtp} validationMessage={senderEmailError}>
        <Input
          type="email"
          value={senderEmail}
          placeholder="talent@example.com"
          disabled={!canManage}
          onChange={(_, d) => setSenderEmail(d.value)}
        />
      </Field>

      <Switch
        label="Enabled"
        checked={enabled}
        disabled={!canManage}
        onChange={(_, d) => setEnabled(d.checked)}
      />
      <Text size={200} className={styles.muted}>
        When off, Talent OS falls back to the shared platform mailbox for this organization.
      </Text>

      {!canManage ? (
        <Text size={200} className={styles.muted}>
          You can view these settings but need the settings:manage permission to change them.
        </Text>
      ) : (
        <div className={styles.actions}>
          <Button
            appearance="primary"
            type="submit"
            disabled={save.isPending}
            icon={save.isPending ? <Spinner size="tiny" /> : undefined}
          >
            Save
          </Button>
        </div>
      )}
    </form>
  );
}

function TestEmailCard({ canManage }: { canManage: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const [to, setTo] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const test = useMutation({
    mutationFn: (recipient: string) => mailApi.test(recipient),
    onSuccess: (out) => {
      if (out.ok) {
        const msg = `Sent via ${out.channel ?? "email"}`;
        setResult({ ok: true, message: msg });
        toast.success(msg);
      } else {
        const msg = out.error ?? "The test email could not be sent.";
        setResult({ ok: false, message: msg });
      }
    },
    onError: (e) => {
      const msg = adminErrorMessage(e);
      setResult({ ok: false, message: msg });
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!to.trim()) return;
    setResult(null);
    test.mutate(to.trim());
  }

  return (
    <Card className={styles.card}>
      <CardHeader
        image={<Mail24Regular aria-hidden />}
        header={<Subtitle2 as="h2">Send a test email</Subtitle2>}
      />
      <Text size={200} className={styles.muted}>
        Sends a test message with the settings saved above. Save your changes first.
      </Text>
      <form className={styles.row} onSubmit={onSubmit} noValidate>
        <Field className={styles.grow} label="Recipient">
          <Input
            type="email"
            value={to}
            placeholder="you@example.com"
            disabled={!canManage || test.isPending}
            onChange={(_, d) => setTo(d.value)}
          />
        </Field>
        <Button
          type="submit"
          icon={test.isPending ? <Spinner size="tiny" /> : <Send20Regular />}
          disabled={!canManage || test.isPending || !to.trim()}
        >
          Send test
        </Button>
      </form>
      {result && (
        <MessageBar intent={result.ok ? "success" : "error"} role="status">
          <MessageBarBody>{result.message}</MessageBarBody>
        </MessageBar>
      )}
    </Card>
  );
}
