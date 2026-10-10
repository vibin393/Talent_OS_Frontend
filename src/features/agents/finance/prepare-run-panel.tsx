"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Sparkle20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { ErrorBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { ClientPicker } from "@/features/demands/client-picker";
import { LegalEntitySelect } from "@/features/receivables/components";
import { errorMessage } from "@/lib/api/errors";
import { financeAgentApi, financeAgentKeys } from "./api";
import { DRAFTS_NOTE, exceptionLabels, runStartedMessage } from "./logic";
import type { BillingResult } from "./types";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  card: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalM },
  muted: { color: tokens.colorNeutralForeground3 },
});

function previousMonth(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** "Prepare invoice run" (Epic 63, `billing:prepare`): starts the Billing Agent for a period; the result card lists
 * the drafts and exceptions and links the run Proposal. */
export function PrepareRunPanel() {
  const styles = useStyles();
  const canPrepare = usePermission("billing:prepare");
  const [open, setOpen] = useState(false);
  const period = previousMonth();
  const [le, setLe] = useState<string | null>(null);
  const [start, setStart] = useState(period.start);
  const [end, setEnd] = useState(period.end);
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const prepare = useMutation({
    mutationFn: () => financeAgentApi.prepareRun({ legal_entity_id: String(le), period_start: start, period_end: end, client_id: client?.id ?? null }),
    onSuccess: (ref) => {
      const msg = runStartedMessage(ref, "Billing Agent");
      setOpen(false);
      if (msg.intent === "success" && ref.run_id) setRunId(ref.run_id);
      else setNotice(msg.text);
    },
  });
  const run = useQuery({
    queryKey: financeAgentKeys.run(runId ?? ""),
    queryFn: ({ signal }) => financeAgentApi.run(String(runId), signal),
    enabled: Boolean(runId),
    refetchInterval: (q) => (q.state.data && ["completed", "failed", "stopped", "cancelled"].includes(q.state.data.status) ? false : 3000),
  });
  if (!canPrepare) return null;
  const result = (run.data?.result ?? null) as BillingResult | null;
  const proposal = run.data?.proposals?.[0];
  const finished = run.data && ["completed", "failed", "stopped", "cancelled"].includes(run.data.status);
  return (
    <>
      <Button icon={<Sparkle20Regular />} onClick={() => setOpen(true)}>
        Prepare invoice run
      </Button>
      {notice && (
        <MessageBar intent="warning">
          <MessageBarBody>{notice}</MessageBarBody>
        </MessageBar>
      )}
      {runId && (
        <Card className={styles.card} aria-label="Invoice run preparation">
          <CardHeader header={<Text weight="semibold">Invoice run ready to start <AiBadge agentName="Billing Agent" mode="suggest" /></Text>} />
          {!finished ? (
            <Spinner size="tiny" label="Billing Agent is preparing…" />
          ) : (
            <>
              <Table aria-label="Prepared invoice run" size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Client</TableHeaderCell>
                    <TableHeaderCell>Drafts</TableHeaderCell>
                    <TableHeaderCell>Total</TableHeaderCell>
                    <TableHeaderCell>Exceptions</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(result?.clients ?? []).map((c) => (
                    <TableRow key={c.client_id}>
                      <TableCell>{c.client_id.slice(0, 8)}</TableCell>
                      <TableCell>{c.drafts}</TableCell>
                      <TableCell>{`${c.currency ?? ""} ${c.total}`.trim()}</TableCell>
                      <TableCell>{exceptionLabels(c.exceptions)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {result?.summary && <Body1>{result.summary}</Body1>}
              <div className={styles.row}>
                {proposal && (
                  <Button appearance="primary" as="a" href={`/proposals/${proposal.id}`}>
                    Review proposal
                  </Button>
                )}
                <Button as="a" href={`/admin/ai/runs/${runId}`}>
                  View agent run
                </Button>
              </div>
            </>
          )}
          <Caption1 className={styles.muted}>{DRAFTS_NOTE}</Caption1>
          <ErrorBar message={run.isError ? errorMessage(run.error) : null} />
        </Card>
      )}
      <Dialog open={open} onOpenChange={(_, d) => setOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Prepare invoice run</DialogTitle>
            <DialogContent className={styles.stack}>
              <LegalEntitySelect value={le} onChange={setLe} />
              <Field label="Period" hint="Start and end date">
                <div className={styles.row}>
                  <Input type="date" aria-label="Period start" value={start} onChange={(_, d) => setStart(d.value)} />
                  <Input type="date" aria-label="Period end" value={end} onChange={(_, d) => setEnd(d.value)} />
                </div>
              </Field>
              <ClientPicker label="Client (optional)" value={client?.id ?? null} valueLabel={client?.name} onChange={setClient} clearLabel="All clients" />
              <Caption1 className={styles.muted}>{DRAFTS_NOTE}</Caption1>
              <ErrorBar message={prepare.isError ? errorMessage(prepare.error) : null} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button appearance="primary" disabled={!le || !start || !end || end < start || prepare.isPending} onClick={() => prepare.mutate()}>
                Prepare
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
