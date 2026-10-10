"use client";

import {
  Badge,
  Button,
  Checkbox,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Option,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { Amount, useRcvStyles } from "../components";
import { tdsReconApi, tdsReconKeys } from "./api";
import { canConfirm, canReject, isOpenLine, MATCH_BADGE, RUN_STATUS_COLOR, tdsErrorMessage } from "./logic";
import type { TdsLine } from "./types";

const useStyles = makeStyles({
  split: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 3fr) minmax(300px, 2fr)",
    gap: tokens.spacingHorizontalL,
    alignItems: "start",
    "@media (max-width: 960px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  row: { cursor: "pointer" },
  selected: { backgroundColor: tokens.colorNeutralBackground1Selected },
  reasons: { margin: 0, paddingLeft: tokens.spacingHorizontalL },
});

/** `/finance/tds-reconciliation/[runId]`: statement lines on the left, the selected line's match on the right. */
export function TdsRunDetailView({ runId }: { runId: string }) {
  const s = useRcvStyles();
  const st = useStyles();
  const admin = useAdminStyles();
  const perms = usePermissions();
  const canRead = hasAnyPermission(perms, ["receivables:read", "tds_recon:write"]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: tdsReconKeys.run(runId),
    queryFn: ({ signal }) => tdsReconApi.run(runId, signal),
    enabled: canRead,
    refetchInterval: (query) => (query.state.data?.run.status === "parsing" ? 5_000 : false),
  });
  if (!canRead) return <NoAccess what="TDS reconciliation" />;
  const d = q.data;
  const selected = d?.lines.find((l) => l.id === selectedId) ?? null;
  return (
    <div className={s.page}>
      <PageHeader
        title={d ? `${d.run.statement_kind === "ais" ? "AIS" : "Form 26AS"} · FY ${d.run.fy} ${d.run.quarter}` : "Statement run"}
        subtitle={<Link href="/finance/tds-reconciliation">Back to TDS reconciliation</Link>}
      />
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      {!d ? (
        !q.error && <GridSkeleton />
      ) : (
        <>
          <div className={admin.badges}>
            <Badge appearance="tint" color={RUN_STATUS_COLOR[d.run.status] ?? "informative"}>
              {d.run.status}
            </Badge>
            <Badge appearance="tint" color="success">{d.run.confirmed} confirmed</Badge>
            <Badge appearance="tint" color="warning">{d.run.proposed} proposed</Badge>
            <Badge appearance="tint" color="informative">{d.run.unmatched} unmatched</Badge>
          </div>
          {d.run.error && <ErrorBar message={d.run.error} />}
          {d.errors.length > 0 && (
            <MessageBar intent="warning" layout="multiline">
              <MessageBarBody>
                {d.errors.length} line(s) could not be read:{" "}
                {d.errors
                  .slice(0, 5)
                  .map((e) => `line ${e.line_no}: ${e.message}`)
                  .join("; ")}
                {d.errors.length > 5 && " …"}
              </MessageBarBody>
            </MessageBar>
          )}
          <div className={st.split}>
            <div className={admin.surface}>
              <Table aria-label="Statement lines" size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Deductor</TableHeaderCell>
                    <TableHeaderCell>Section</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>TDS deducted</TableHeaderCell>
                    <TableHeaderCell>Match</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.lines.map((l) => {
                    const b = MATCH_BADGE[l.match?.status ?? "none"];
                    const isSel = l.id === selectedId;
                    return (
                      <TableRow
                        key={l.id}
                        className={mergeClasses(st.row, isSel && st.selected)}
                        aria-selected={isSel}
                        tabIndex={0}
                        onClick={() => setSelectedId(l.id)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedId(l.id)}
                      >
                        <TableCell>
                          <div className={admin.cellStack}>
                            <span>{l.client_name ?? l.deductor_name}</span>
                            <Text size={200} className={admin.muted}>
                              {l.deductor_tan}
                            </Text>
                          </div>
                        </TableCell>
                        <TableCell>{l.section}</TableCell>
                        <TableCell>{l.transaction_date}</TableCell>
                        <TableCell>
                          <Amount amount={l.tds_deducted} currency="INR" />
                        </TableCell>
                        <TableCell>
                          <Badge appearance="tint" color={b.color}>
                            {b.label}
                            {l.match?.status === "proposed" ? ` ${l.match.score}` : ""}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {d.lines.length === 0 && <div className={admin.empty}>No statement lines.</div>}
            </div>
            <div className={s.card}>
              {selected ? (
                <LinePanel key={selected.id} line={selected} />
              ) : (
                <Text className={s.muted}>Select a statement line to review its match.</Text>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LinePanel({ line }: { line: TdsLine }) {
  const s = useRcvStyles();
  const st = useStyles();
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canWrite = hasAnyPermission(perms, ["tds_recon:write"]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pairId, setPairId] = useState<string | null>(null);
  const [recordTan, setRecordTan] = useState(true);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const open = isOpenLine(line);
  const candidates = useQuery({
    queryKey: tdsReconKeys.candidates(line.id),
    queryFn: ({ signal }) => tdsReconApi.candidates(line.id, signal),
    enabled: canWrite && open,
  });
  const done = async () => {
    setErr(null);
    await qc.invalidateQueries({ queryKey: tdsReconKeys.all });
  };
  const onError = (e: unknown) => setErr(tdsErrorMessage(e));
  const confirm = useMutation({ mutationFn: (matchId: string) => tdsReconApi.confirm(matchId), onSuccess: done, onError });
  const reject = useMutation({ mutationFn: (matchId: string) => tdsReconApi.reject(matchId), onSuccess: done, onError });
  const pair = useMutation({
    mutationFn: () => tdsReconApi.pair(line.id, pairId!, recordTan && !line.client_id),
    onSuccess: async () => {
      setPairId(null);
      await done();
    },
    onError,
  });
  const ack = useMutation({
    mutationFn: () => tdsReconApi.acknowledge(line.id, note.trim()),
    onSuccess: async () => {
      setNote("");
      await done();
    },
    onError,
  });
  const m = line.match;
  const ded = m?.deduction ?? null;
  const busy = confirm.isPending || reject.isPending || pair.isPending || ack.isPending;
  const candidateLabel = (c: { client_name: string | null; section_code: string | null; inr_amount: string; deduction_date: string; score?: number }) =>
    `${c.client_name ?? "Client"} · ${c.section_code ?? "—"} · ₹${c.inr_amount} · ${c.deduction_date}${c.score !== undefined ? ` · score ${c.score}` : ""}`;
  const pairCandidate = candidates.data?.find((c) => c.id === pairId);
  return (
    <div className={s.stack}>
      <Text weight="semibold">Statement line {line.line_ref}</Text>
      <dl className={admin.detailList}>
        <dt>Deductor</dt>
        <dd>
          {line.deductor_name} ({line.deductor_tan})
        </dd>
        <dt>Client</dt>
        <dd>{line.client_name ?? "No TAN mapping"}</dd>
        <dt>Section</dt>
        <dd>{line.section}</dd>
        <dt>Date</dt>
        <dd>{line.transaction_date}</dd>
        <dt>Amount paid</dt>
        <dd>
          <Amount amount={line.amount_paid} currency="INR" />
        </dd>
        <dt>TDS deducted</dt>
        <dd>
          <Amount amount={line.tds_deducted} currency="INR" />
        </dd>
        <dt>TDS deposited</dt>
        <dd>{line.tds_deposited ? <Amount amount={line.tds_deposited} currency="INR" /> : "—"}</dd>
        <dt>Booking status</dt>
        <dd>{line.booking_status ?? "—"}</dd>
      </dl>

      <Text weight="semibold">Match</Text>
      {m ? (
        <div className={s.stack}>
          <div className={admin.badges}>
            <Badge appearance="tint" color={MATCH_BADGE[m.status].color}>
              {MATCH_BADGE[m.status].label}
            </Badge>
            <Badge appearance="outline">Score {m.score}</Badge>
          </div>
          {ded && (
            <dl className={admin.detailList}>
              <dt>Recorded deduction</dt>
              <dd>{ded.client_name ?? "—"}</dd>
              <dt>Section</dt>
              <dd>{ded.section_code ?? "—"}</dd>
              <dt>Amount</dt>
              <dd>
                <Amount amount={ded.inr_amount} currency="INR" />
              </dd>
              <dt>Date</dt>
              <dd>
                {ded.deduction_date} ({ded.quarter})
              </dd>
              {ded.invoice_id && (
                <>
                  <dt>Invoice</dt>
                  <dd>
                    <Link href={`/billing/invoices/${ded.invoice_id}`}>Open invoice</Link>
                  </dd>
                </>
              )}
            </dl>
          )}
          {m.reasons.length > 0 && (
            <ul className={st.reasons}>
              {m.reasons.map((r) => (
                <li key={r}>
                  <Text size={200}>{r}</Text>
                </li>
              ))}
            </ul>
          )}
          {m.note && <Text size={200}>Note: {m.note}</Text>}
        </div>
      ) : (
        <Text className={s.muted}>No recorded deduction was proposed for this line.</Text>
      )}

      <ErrorBar message={err} />

      {canWrite && m && (canConfirm(line) || canReject(line)) && (
        <div className={s.row}>
          <Button appearance="primary" disabled={!canConfirm(line) || busy} onClick={() => setConfirmOpen(true)}>
            Confirm
          </Button>
          <Button disabled={!canReject(line) || busy} onClick={() => reject.mutate(m.id)}>
            Reject
          </Button>
        </div>
      )}

      {canWrite && open && (
        <>
          <Field label="Pair manually" hint="Pick the recorded TDS deduction this line belongs to.">
            <Combobox
              placeholder={candidates.isLoading ? "Loading candidates…" : "Select a recorded deduction"}
              value={pairCandidate ? candidateLabel(pairCandidate) : ""}
              selectedOptions={pairId ? [pairId] : []}
              onOptionSelect={(_, d) => setPairId(d.optionValue ?? null)}
            >
              {(candidates.data ?? []).map((c) => (
                <Option key={c.id} value={c.id} text={candidateLabel(c)}>
                  {candidateLabel(c)}
                </Option>
              ))}
              {candidates.isSuccess && candidates.data.length === 0 && (
                <Option value="" disabled text="">
                  No candidate deductions
                </Option>
              )}
            </Combobox>
          </Field>
          {!line.client_id && (
            <Checkbox
              label={`Remember TAN ${line.deductor_tan} for this client`}
              checked={recordTan}
              onChange={(_, d) => setRecordTan(!!d.checked)}
            />
          )}
          <div className={s.row}>
            <Button disabled={!pairId || busy} onClick={() => pair.mutate()}>
              Pair
            </Button>
          </div>
          <Field label="Acknowledge without a match" hint="Record why this line has no recorded deduction.">
            <Textarea value={note} onChange={(_, d) => setNote(d.value)} />
          </Field>
          <div className={s.row}>
            <Button disabled={!note.trim() || busy} onClick={() => ack.mutate()}>
              Acknowledge
            </Button>
          </div>
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={(_, d) => setConfirmOpen(d.open)} modalType="alert">
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Confirm this match?</DialogTitle>
            <DialogContent>
              Statement line {line.line_ref} ({line.deductor_tan}, ₹{line.tds_deducted}) will be reconciled with the recorded deduction
              {ded ? ` of ₹${ded.inr_amount} on ${ded.deduction_date}` : ""}. The recorded deduction itself is not changed.
            </DialogContent>
            <DialogActions>
              <Button
                appearance="primary"
                disabled={busy}
                onClick={() => {
                  setConfirmOpen(false);
                  if (m && canConfirm(line)) confirm.mutate(m.id);
                }}
              >
                Confirm
              </Button>
              <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
