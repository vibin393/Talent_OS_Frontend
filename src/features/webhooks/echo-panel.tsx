"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { ecosystemApi, ecosystemKeys } from "@/features/ecosystem/api";
import { errorMessage } from "@/lib/api/errors";
import { type EchoReceipt, webhookKeys, webhooksApi } from "./api";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "1000px" },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "end", flexWrap: "wrap" },
  pre: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingHorizontalS,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    maxHeight: "360px",
    overflow: "auto",
  },
});

/** The sandbox Echo endpoint (Epic 68, B5). Hidden outside Sandbox Tenants. */
export function EchoPanel() {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canManage = usePermission("webhook:manage");
  const eco = useQuery({ queryKey: ecosystemKeys.state, queryFn: ({ signal }) => ecosystemApi.state(signal), enabled: canManage });
  const sandbox = eco.data?.sandbox === true;
  const endpoints = useQuery({ queryKey: webhookKeys.echo, queryFn: ({ signal }) => webhooksApi.echoEndpoints(signal), enabled: sandbox });
  const [selected, setSelected] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [open, setOpen] = useState<EchoReceipt | null>(null);
  const current = selected ?? endpoints.data?.[0]?.id ?? null;
  const receipts = useQuery({
    queryKey: webhookKeys.receipts(current ?? ""),
    queryFn: ({ signal }) => webhooksApi.receipts(current ?? "", signal),
    enabled: current !== null,
    refetchInterval: 15_000,
  });
  if (!canManage || (eco.data && !sandbox))
    return (
      <>
        <PageHeader title="Echo endpoint" />
        <NoAccess what="the echo endpoint" />
      </>
    );
  return (
    <div className={styles.root}>
      <PageHeader title="Echo endpoint" subtitle="A built-in receiver for testing in your sandbox. It never leaves Talent OS." />
      <div className={styles.row}>
        <Field label="Label">
          <Input value={label} maxLength={80} onChange={(_, d) => setLabel(d.value)} />
        </Field>
        <Button
          appearance="primary"
          onClick={async () => {
            try {
              const ep = await webhooksApi.createEcho(label.trim() || null);
              setCreated(ep.url ?? null);
              setSelected(ep.id);
              setLabel("");
              void qc.invalidateQueries({ queryKey: webhookKeys.echo });
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        >
          Create echo endpoint
        </Button>
      </div>
      {created && (
        <MessageBar intent="success">
          <MessageBarBody>
            Use this URL as a webhook endpoint (shown once): <code>{created}</code>{" "}
            <Button size="small" onClick={() => void navigator.clipboard?.writeText(created)}>
              Copy
            </Button>
          </MessageBarBody>
        </MessageBar>
      )}
      {endpoints.error && <ErrorBar message={errorMessage(endpoints.error)} />}
      {(endpoints.data?.length ?? 0) > 0 && (
        <Field label="Endpoint">
          <Dropdown
            value={endpoints.data?.find((e) => e.id === current)?.label ?? "Echo endpoint"}
            selectedOptions={current ? [current] : []}
            onOptionSelect={(_, d) => setSelected(d.optionValue ?? null)}
          >
            {endpoints.data?.map((e) => (
              <Option key={e.id} value={e.id}>
                {e.label ?? `Echo endpoint (${formatDateTime(e.created_at)})`}
              </Option>
            ))}
          </Dropdown>
        </Field>
      )}
      {current && (
        <Table aria-label="Received deliveries">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Received</TableHeaderCell>
              <TableHeaderCell>Event type</TableHeaderCell>
              <TableHeaderCell>Signature</TableHeaderCell>
              <TableHeaderCell>Size</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(receipts.data ?? []).map((r) => (
              <TableRow key={r.id} onClick={() => setOpen(r)} style={{ cursor: "pointer" }}>
                <TableCell>{formatDateTime(r.received_at)}</TableCell>
                <TableCell>{r.event_type ?? "—"}</TableCell>
                <TableCell>
                  <Badge appearance="tint" color={r.signature_valid ? "success" : "danger"}>
                    {r.signature_valid ? "Valid" : "Invalid"}
                  </Badge>
                </TableCell>
                <TableCell>{r.size} B</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {current && receipts.data?.length === 0 && <Body1>Nothing received yet.</Body1>}
      {open && (
        <div>
          <Caption1>Headers and body</Caption1>
          <pre className={styles.pre}>{`${JSON.stringify(open.headers, null, 2)}\n\n${open.body}`}</pre>
        </div>
      )}
    </div>
  );
}
