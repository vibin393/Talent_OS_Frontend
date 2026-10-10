"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  SpinButton,
  Spinner,
  Switch,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isApiError, errorMessage } from "@/lib/api/errors";
import { type Subscription, type SubscriptionInput, webhookKeys, webhooksApi } from "./api";
import { EventTypePicker } from "./event-type-picker";
import { FiltersEditor } from "./filters-editor";
import { allowedFilterFields } from "./logic";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, justifyContent: "flex-end" },
});

const EGRESS_REASONS: Record<string, string> = {
  scheme: "not an https address",
  port: "unsupported port",
  userinfo: "credentials in the address",
  ip_literal: "an IP address instead of a domain name",
  suffix: "not a public domain name",
  private_address: "private network address",
  resolution: "the domain could not be found",
};

/** Error text of a failed save; `egress_refused` gets the plain-language category. */
export function saveError(e: unknown): string {
  if (isApiError(e) && e.code === "egress_refused") {
    const reason = String(e.details.reason ?? "");
    return `This address can't be used. Use a public https address. (${EGRESS_REASONS[reason] ?? reason})`;
  }
  if (isApiError(e) && e.code === "echo_sandbox_only") return "The echo endpoint can only be used in a sandbox.";
  return errorMessage(e);
}

/** Create / edit form (Epic 68, B3). */
export function SubscriptionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Subscription;
  submitLabel: string;
  onSubmit: (body: SubscriptionInput) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const styles = useStyles();
  const [url, setUrl] = useState(initial?.url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [allEvents, setAllEvents] = useState(initial?.all_events ?? false);
  const [selected, setSelected] = useState<string[]>(initial?.event_types ?? []);
  const [filters, setFilters] = useState<Record<string, string[]>>(initial?.filters ?? {});
  const [parallel, setParallel] = useState(initial?.max_in_flight ?? 5);
  const [suppress, setSuppress] = useState(initial?.suppress_own_changes ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const installationId = initial?.installation_id ?? null;
  const types = useQuery({
    queryKey: webhookKeys.eventTypes(installationId),
    queryFn: ({ signal }) => webhooksApi.eventTypes(installationId, signal),
  });
  const allowed = useMemo(() => allowedFilterFields(selected, allEvents, types.data ?? []), [selected, allEvents, types.data]);
  const valid = url.trim().length > 0 && (allEvents || selected.length > 0);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const kept = Object.fromEntries(Object.entries(filters).filter(([k, v]) => allowed.includes(k) && v.length > 0));
      await onSubmit({
        url: url.trim(),
        description: description.trim() || null,
        event_types: allEvents ? ["*"] : selected,
        filters: kept,
        max_in_flight: parallel,
        ...(installationId ? { suppress_own_changes: suppress } : {}),
      });
    } catch (e) {
      setError(saveError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.form}>
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <Field label="Endpoint URL" required hint="Must start with https://. Talent OS won't follow redirects.">
        <Input type="url" value={url} onChange={(_, d) => setUrl(d.value)} placeholder="https://" />
      </Field>
      <Field label="Description">
        <Input value={description} maxLength={300} onChange={(_, d) => setDescription(d.value)} />
      </Field>
      {types.isLoading ? (
        <Spinner size="tiny" label="Loading event types" />
      ) : (
        <EventTypePicker
          catalogue={types.data ?? []}
          allEvents={allEvents}
          selected={selected}
          onChange={(n) => {
            setAllEvents(n.allEvents);
            setSelected(n.selected);
          }}
        />
      )}
      <Accordion collapsible>
        <AccordionItem value="filters">
          <AccordionHeader>Filters</AccordionHeader>
          <AccordionPanel>
            <FiltersEditor value={filters} allowed={allowed} onChange={setFilters} />
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
      <Field label="Parallel deliveries">
        <SpinButton min={1} max={5} value={parallel} onChange={(_, d) => setParallel(Math.min(5, Math.max(1, Number(d.value ?? d.displayValue ?? 5) || 5)))} />
      </Field>
      {installationId && (
        <Switch
          label="Don't send events caused by this app's own changes"
          checked={suppress}
          onChange={(_, d) => setSuppress(d.checked)}
        />
      )}
      <div className={styles.actions}>
        {onCancel && (
          <Button disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button appearance="primary" disabled={!valid || busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
