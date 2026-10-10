"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle2,
  Switch,
  tokens,
} from "@fluentui/react-components";
import { PlugConnected20Regular, Send20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { messagingApi, messagingKeys } from "./api";
import { CHANNEL_LABELS, connectorErrors, connectorPayload, PROVIDER_LABELS, providerFields, toE164 } from "./logic";
import type { Channel, ConnectorConfig } from "./types";

const useStyles = makeStyles({
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))", gap: tokens.spacingHorizontalL, maxWidth: "1100px" },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  muted: { color: tokens.colorNeutralForeground3 },
  mono: { fontFamily: tokens.fontFamilyMonospace, overflowWrap: "anywhere" },
});

/** Admin → Messaging → Connectors: one SMS and one WhatsApp provider configuration. */
export function ConnectorsTab() {
  const styles = useStyles();
  return (
    <div className={styles.grid}>
      <ConnectorCard category="sms" />
      <ConnectorCard category="whatsapp" />
    </div>
  );
}

function ConnectorCard({ category }: { category: Channel }) {
  const styles = useStyles();
  const q = useQuery({ queryKey: messagingKeys.connectors(category), queryFn: ({ signal }) => messagingApi.connectors(category, signal) });
  const config = q.data?.configs.find((c) => c.status !== "archived") ?? q.data?.configs[0] ?? null;
  return (
    <Card className={styles.card}>
      <CardHeader
        image={<PlugConnected20Regular aria-hidden />}
        header={<Subtitle2 as="h2">{CHANNEL_LABELS[category]} provider</Subtitle2>}
        description={<Caption1 className={styles.muted}>Credentials are stored encrypted and never shown again.</Caption1>}
        action={
          config ? (
            <Badge appearance="tint" color={config.status === "active" ? "success" : "subtle"}>
              {config.status === "active" ? "Active" : config.status}
            </Badge>
          ) : (
            <Badge appearance="outline" color="subtle">
              Not set up
            </Badge>
          )
        }
      />
      {q.isPending ? (
        <GridSkeleton rows={3} />
      ) : q.isError ? (
        <ErrorBar message={errorMessage(q.error)} />
      ) : (
        <ConnectorForm key={config?.id ?? "new"} category={category} providers={q.data.providers} config={config} />
      )}
    </Card>
  );
}

function ConnectorForm({ category, providers, config }: { category: Channel; providers: string[]; config: ConnectorConfig | null }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState(config?.provider_key ?? providers[0] ?? "fake");
  const [name, setName] = useState(config?.display_name ?? "");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(config?.settings ?? {})) if (typeof v === "string") out[k] = v;
    return out;
  });
  const [webhookSecret, setWebhookSecret] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testTo, setTestTo] = useState("");
  const sameProvider = config?.provider_key === provider;

  const save = useMutation({
    mutationFn: () => {
      const { credentials, settings } = connectorPayload(provider, values);
      const secret = webhookSecret.trim() || undefined;
      const display = name.trim() || PROVIDER_LABELS[provider] || provider;
      if (config && sameProvider) {
        return messagingApi.updateConnector(config.id, { display_name: display, credentials, settings, webhook_secret: secret });
      }
      return messagingApi.createConnector({ category, provider_key: provider, display_name: display, credentials, settings, webhook_secret: secret });
    },
    onSuccess: () => {
      setWebhookSecret("");
      void queryClient.invalidateQueries({ queryKey: messagingKeys.connectors(category) });
      toast.success(`${CHANNEL_LABELS[category]} provider saved`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: (active: boolean) => messagingApi.updateConnector(config!.id, { status: active ? "active" : "disabled" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: messagingKeys.connectors(category) }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const test = useMutation({
    mutationFn: (to: string) => messagingApi.sendTest(config!.id, to),
    onSuccess: (r) => toast.success(`Test message: ${r.status}`),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const fields = providerFields(provider);
  const submit = () => {
    const e = connectorErrors(provider, values, !!(config?.has_credentials && sameProvider));
    setErrors(e);
    if (!Object.keys(e).length) save.mutate();
  };

  return (
    <>
      <Field label="Provider">
        <Dropdown value={PROVIDER_LABELS[provider] ?? provider} selectedOptions={[provider]} onOptionSelect={(_, d) => setProvider(d.optionValue ?? provider)}>
          {providers.map((p) => (
            <Option key={p} value={p}>
              {PROVIDER_LABELS[p] ?? p}
            </Option>
          ))}
        </Dropdown>
      </Field>
      {provider === "manual" && (
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody>Messages wait in the Manual queue tab; an operator sends them and marks each one sent.</MessageBarBody>
        </MessageBar>
      )}
      {provider === "fake" && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>The fake provider only logs messages. Use it for testing, never in production.</MessageBarBody>
        </MessageBar>
      )}
      <Field label="Display name">
        <Input value={name} onChange={(_, d) => setName(d.value)} placeholder={PROVIDER_LABELS[provider] ?? provider} />
      </Field>
      {fields.map((f) => (
        <Field
          key={f.key}
          label={f.label}
          required={f.required && !(f.kind === "credential" && config?.has_credentials && sameProvider)}
          validationMessage={errors[f.key] || undefined}
          hint={f.kind === "credential" && config?.has_credentials && sameProvider ? "Stored. Leave empty to keep it." : undefined}
        >
          <Input
            type={f.secret ? "password" : "text"}
            autoComplete="off"
            value={values[f.key] ?? ""}
            onChange={(_, d) => {
              setValues((v) => ({ ...v, [f.key]: d.value }));
              setErrors((x) => ({ ...x, [f.key]: "" }));
            }}
          />
        </Field>
      ))}
      {provider !== "fake" && provider !== "manual" && (
        <Field label="Webhook secret" hint={config?.has_webhook_secret && sameProvider ? "Stored. Leave empty to keep it." : "Used to verify delivery reports and replies."}>
          <Input type="password" autoComplete="off" value={webhookSecret} onChange={(_, d) => setWebhookSecret(d.value)} />
        </Field>
      )}
      {config?.webhook_path && sameProvider && (
        <Body1>
          Webhook URL: <span className={styles.mono}>{config.webhook_path}</span>
        </Body1>
      )}
      <div className={styles.row}>
        <Button appearance="primary" onClick={submit} disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined}>
          Save
        </Button>
        {config && sameProvider && (
          <Switch checked={config.status === "active"} disabled={toggle.isPending} label="Active" onChange={(_, d) => toggle.mutate(d.checked)} />
        )}
      </div>
      {config && sameProvider && (
        <div className={styles.row}>
          <Field label="Send a test message to" hint="Mobile number, e.g. +91 98765 43210" style={{ flex: "1 1 220px" }}>
            <Input value={testTo} onChange={(_, d) => setTestTo(d.value)} type="tel" />
          </Field>
          <Button
            icon={test.isPending ? <Spinner size="tiny" /> : <Send20Regular />}
            disabled={test.isPending || !toE164(testTo)}
            onClick={() => {
              const to = toE164(testTo);
              if (to) test.mutate(to);
            }}
          >
            Send test
          </Button>
        </div>
      )}
    </>
  );
}
