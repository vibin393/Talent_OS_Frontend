"use client";

import {
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { type Delivery, type Subscription, webhookKeys, webhooksApi } from "./api";

const useStyles = makeStyles({
  pre: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingHorizontalS,
    maxHeight: "240px",
    overflow: "auto",
    whiteSpace: "pre-wrap",
  },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

/** "Send test event" (Epic 68, B4): a signed sample of a subscribed type; the result shows the response code and latency. */
export function TestEventDialog({ sub, onClose }: { sub: Subscription | null; onClose: () => void }) {
  const styles = useStyles();
  const [type, setType] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Delivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const catalogue = useQuery({
    queryKey: webhookKeys.eventTypes(sub?.installation_id),
    queryFn: ({ signal }) => webhooksApi.eventTypes(sub?.installation_id, signal),
    enabled: sub !== null,
  });
  const options = (catalogue.data ?? []).filter((t) => t.allowed && (sub?.all_events || sub?.event_types.includes(t.type)));
  const chosen = options.find((t) => t.type === type) ?? options[0];
  const close = () => {
    setResult(null);
    setError(null);
    setType(null);
    onClose();
  };
  return (
    <Dialog open={sub !== null} onOpenChange={(_, d) => !d.open && close()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Send test event</DialogTitle>
          <DialogContent className={styles.body}>
            <Field label="Event type">
              <Dropdown
                value={chosen?.type ?? ""}
                selectedOptions={chosen ? [chosen.type] : []}
                onOptionSelect={(_, d) => setType(d.optionValue ?? null)}
              >
                {options.map((t) => (
                  <Option key={t.type} value={t.type}>
                    {t.type}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            {chosen && (
              <pre className={styles.pre} aria-label="Sample data">
                {JSON.stringify(Object.keys(chosen.example).length ? chosen.example : chosen.schema.properties ?? {}, null, 2)}
              </pre>
            )}
            {result && (
              <MessageBar intent={result.status === "succeeded" ? "success" : "error"}>
                <MessageBarBody>
                  Response {result.last_status_code ?? result.last_error ?? "—"}
                  {result.latency_ms !== null ? ` in ${result.latency_ms} ms` : ""}
                </MessageBarBody>
              </MessageBar>
            )}
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            {!catalogue.isLoading && options.length === 0 && <Body1>This webhook has no event type to test.</Body1>}
          </DialogContent>
          <DialogActions>
            <Button onClick={close}>Close</Button>
            <Button
              appearance="primary"
              disabled={!chosen || busy}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                if (!sub || !chosen) return;
                setBusy(true);
                setError(null);
                try {
                  setResult(await webhooksApi.test(sub.id, chosen.type));
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send test
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
