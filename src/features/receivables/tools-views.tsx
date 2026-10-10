"use client";

import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Option,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, ArrowUpload20Regular, Play20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess, formatDateTime } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage } from "@/lib/api/errors";
import { receivablesApi, receivablesKeys } from "./api";
import { Amount, LegalEntitySelect, ReceivablesTabs, StatusPill, useRcvStyles } from "./components";
import { newIdempotencyKey, todayIso } from "./logic";
import type { BankImportOut, TdsOut } from "./types";

function Shell({ title, subtitle, perm, children }: { title: string; subtitle: string; perm: string[]; children: React.ReactNode }) {
  const s = useRcvStyles();
  const perms = usePermissions();
  if (!hasAnyPermission(perms, perm)) return <NoAccess what={title.toLowerCase()} />;
  return (
    <div className={s.page}>
      <PageHeader title={title} subtitle={subtitle} />
      <ReceivablesTabs />
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- bank import
/** Bank import wizard: upload -> preview (matched / unmatched / soft duplicate) -> select -> apply -> results. */
export function BankImportView() {
  const s = useRcvStyles();
  const qc = useQueryClient();
  const [le, setLe] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [batch, setBatch] = useState<BankImportOut | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [key] = useState(newIdempotencyKey);
  const preview = useMutation({
    mutationFn: () => receivablesApi.bankPreview(le!, file!, newIdempotencyKey()),
    onSuccess: (out) => {
      setBatch(out);
      setPicked(new Set(out.rows.filter((r) => r.match_kind === "matched" && r.client_id).map((r) => r.id)));
    },
  });
  const apply = useMutation({
    mutationFn: () => receivablesApi.bankApply(batch!.batch_id, [...picked], "neft", key),
    onSuccess: (out) => {
      setBatch(out);
      void qc.invalidateQueries({ queryKey: receivablesKeys.all });
    },
  });
  return (
    <Shell title="Bank import" subtitle="Match a bank statement CSV to issued invoices" perm={["payment:record"]}>
      <div className={s.row}>
        <LegalEntitySelect value={le} onChange={setLe} />
        <Field label="Statement CSV (date, amount, reference, narrative)">
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <Button icon={<ArrowUpload20Regular />} disabled={!le || !file || preview.isPending} onClick={() => preview.mutate()}>
          Preview
        </Button>
      </div>
      <ErrorBar message={preview.error ? errorMessage(preview.error) : apply.error ? errorMessage(apply.error) : null} />
      {batch && (
        <>
          <div className={s.scroll}>
            <Table size="small" aria-label="Statement rows">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell />
                  <TableHeaderCell>#</TableHeaderCell>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Amount</TableHeaderCell>
                  <TableHeaderCell>Reference / narrative</TableHeaderCell>
                  <TableHeaderCell>Match</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Select row ${r.row_no}`}
                        disabled={r.match_kind === "applied" || r.match_kind === "failed" || !r.client_id}
                        checked={picked.has(r.id)}
                        onChange={(_, d) =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (d.checked) next.add(r.id);
                            else next.delete(r.id);
                            return next;
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>{r.row_no}</TableCell>
                    <TableCell>{r.date ?? "-"}</TableCell>
                    <TableCell>
                      <Amount amount={r.amount} currency={r.currency} />
                    </TableCell>
                    <TableCell>
                      {r.reference} {r.narrative}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={r.match_kind} />
                      {r.error && <Text size={200}> {r.error}</Text>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button appearance="primary" disabled={picked.size === 0 || apply.isPending} onClick={() => apply.mutate()}>
            Apply {picked.size} row(s)
          </Button>
        </>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------- write-offs
export function WriteOffsView() {
  const s = useRcvStyles();
  const q = useQuery({ queryKey: receivablesKeys.writeOffs, queryFn: ({ signal }) => receivablesApi.writeOffs(signal) });
  return (
    <Shell title="Write-offs" subtitle="Requests run through approval; execution re-checks the open balance" perm={["receivables:read"]}>
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      {!q.data ? (
        <GridSkeleton />
      ) : q.data.length === 0 ? (
        <Text className={s.muted}>No write-off requests. Request one from an invoice&apos;s receivables actions.</Text>
      ) : (
        <div className={s.scroll}>
          <Table size="small" aria-label="Write-offs">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Requested</TableHeaderCell>
                <TableHeaderCell>Document</TableHeaderCell>
                <TableHeaderCell>Amount</TableHeaderCell>
                <TableHeaderCell>Reason</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>{formatDateTime(w.created_at)}</TableCell>
                  <TableCell>{w.document_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Amount amount={w.requested_amount} currency={w.currency} />
                  </TableCell>
                  <TableCell>{w.reason}</TableCell>
                  <TableCell>
                    <StatusPill status={w.status} />
                    {w.status_reason && <Text size={200}> {w.status_reason}</Text>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------- TDS receivable
export function TdsView() {
  const s = useRcvStyles();
  const perms = usePermissions();
  const [quarter, setQuarter] = useState("");
  const [status, setStatus] = useState("expected");
  const [editing, setEditing] = useState<TdsOut | null>(null);
  const filters = { quarter: quarter || undefined, status: status || undefined };
  const q = useQuery({ queryKey: receivablesKeys.tds(filters), queryFn: ({ signal }) => receivablesApi.tds(filters, signal) });
  return (
    <Shell title="TDS receivable" subtitle="Outstanding TDS and GST-TDS certificates by client and quarter" perm={["receivables:read"]}>
      <div className={s.row}>
        <Field label="Quarter" hint="e.g. 26-27 Q3">
          <Input value={quarter} onChange={(_, d) => setQuarter(d.value)} />
        </Field>
        <Field label="Certificate status">
          <Dropdown value={status || "any"} selectedOptions={[status]} onOptionSelect={(_, d) => setStatus(String(d.optionValue))}>
            <Option value="">any</Option>
            <Option value="expected">expected</Option>
            <Option value="received">received</Option>
            <Option value="mismatch">mismatch</Option>
          </Dropdown>
        </Field>
      </div>
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      {!q.data ? (
        <GridSkeleton />
      ) : (
        <div className={s.scroll}>
          <Table size="small" aria-label="TDS deductions">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Quarter</TableHeaderCell>
                <TableHeaderCell>Kind</TableHeaderCell>
                <TableHeaderCell>Section</TableHeaderCell>
                <TableHeaderCell>Amount</TableHeaderCell>
                <TableHeaderCell>Expected</TableHeaderCell>
                <TableHeaderCell>Certificate</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.quarter}</TableCell>
                  <TableCell>{t.kind === "gst_tds" ? "GST-TDS" : "TDS"}</TableCell>
                  <TableCell>{t.section_code ?? "-"}</TableCell>
                  <TableCell>
                    <Amount amount={t.amount} currency={t.currency} />
                    {t.variance_flag && <Badge color="warning"> variance</Badge>}
                  </TableCell>
                  <TableCell>
                    <Amount amount={t.expected_amount} currency={t.currency} />
                  </TableCell>
                  <TableCell>
                    <StatusPill status={t.certificate_status} /> {t.certificate_ref}
                  </TableCell>
                  <TableCell>
                    {hasAnyPermission(perms, ["tds:write"]) && (
                      <Button size="small" onClick={() => setEditing(t)}>
                        Certificate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && <CertificateDialog tds={editing} onClose={() => setEditing(null)} />}
    </Shell>
  );
}

function CertificateDialog({ tds, onClose }: { tds: TdsOut; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<TdsOut["certificate_status"]>(tds.certificate_status === "expected" ? "received" : tds.certificate_status);
  const [ref, setRef] = useState(tds.certificate_ref ?? "");
  const [date, setDate] = useState(tds.certificate_received_at ?? todayIso());
  const m = useMutation({
    mutationFn: () => receivablesApi.updateCertificate(tds.id, { certificate_status: status, certificate_ref: ref || null, certificate_received_at: status === "received" ? date : null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: receivablesKeys.all });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>TDS certificate</DialogTitle>
          <DialogContent>
            <Field label="Status">
              <Dropdown value={status} selectedOptions={[status]} onOptionSelect={(_, d) => setStatus(d.optionValue as TdsOut["certificate_status"])}>
                <Option value="expected">expected</Option>
                <Option value="received">received</Option>
                <Option value="mismatch">mismatch</Option>
              </Dropdown>
            </Field>
            <Field label="Certificate reference">
              <Input value={ref} onChange={(_, d) => setRef(d.value)} />
            </Field>
            {status === "received" && (
              <Field label="Received on">
                <Input type="date" value={date} onChange={(_, d) => setDate(d.value)} />
              </Field>
            )}
            <ErrorBar message={m.error ? errorMessage(m.error) : null} />
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={m.isPending} onClick={() => m.mutate()}>
              Save
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ---------------------------------------------------------------- statements
export function StatementsView() {
  const s = useRcvStyles();
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [start, setStart] = useState(`${todayIso().slice(0, 4)}-04-01`);
  const [end, setEnd] = useState(todayIso());
  const [currency, setCurrency] = useState("INR");
  const q = useQuery({
    queryKey: receivablesKeys.statement(client?.id ?? "", start, end, currency),
    queryFn: ({ signal }) => receivablesApi.statement(client!.id, start, end, currency, signal),
    enabled: !!client && !!start && !!end,
  });
  return (
    <Shell title="Statements" subtitle="Client statement of account with opening and closing balances" perm={["receivables:read"]}>
      <div className={s.row}>
        <ClientPicker value={client?.id ?? null} valueLabel={client?.name} onChange={setClient} className={s.grow} />
        <Field label="From">
          <Input type="date" value={start} onChange={(_, d) => setStart(d.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={end} onChange={(_, d) => setEnd(d.value)} />
        </Field>
        <Field label="Currency">
          <Input value={currency} maxLength={3} onChange={(_, d) => setCurrency(d.value.toUpperCase())} style={{ width: 80 }} />
        </Field>
        {client && (
          <Button as="a" href={receivablesApi.statementPdfUrl(client.id, start, end, currency)} target="_blank" icon={<ArrowDownload20Regular />}>
            PDF
          </Button>
        )}
      </div>
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      {q.data && <StatementTable data={q.data} />}
    </Shell>
  );
}

export function StatementTable({ data }: { data: import("./types").StatementOut }) {
  const s = useRcvStyles();
  return (
    <div className={s.stack}>
      <Text>
        Opening balance <Amount amount={data.opening_balance} currency={data.currency} strong />
      </Text>
      <div className={s.scroll}>
        <Table size="small" aria-label="Statement">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Reference</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell>Debit</TableHeaderCell>
              <TableHeaderCell>Credit</TableHeaderCell>
              <TableHeaderCell>Balance</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.lines.map((l, i) => (
              <TableRow key={`${l.date}-${i}`}>
                <TableCell>{l.date}</TableCell>
                <TableCell>{l.reference ?? ""}</TableCell>
                <TableCell>{l.description}</TableCell>
                <TableCell>{l.debit !== "0.00" && <Amount amount={l.debit} currency={data.currency} />}</TableCell>
                <TableCell>{l.credit !== "0.00" && <Amount amount={l.credit} currency={data.currency} />}</TableCell>
                <TableCell>
                  <Amount amount={l.balance} currency={data.currency} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Text>
        Closing balance <Amount amount={data.closing_balance} currency={data.currency} strong />
      </Text>
    </div>
  );
}

// ---------------------------------------------------------------- accounting export
export function ExportsView() {
  const s = useRcvStyles();
  const qc = useQueryClient();
  const [le, setLe] = useState<string | null>(null);
  const [from, setFrom] = useState(`${todayIso().slice(0, 8)}01`);
  const [to, setTo] = useState(todayIso());
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const templates = useQuery({ queryKey: receivablesKeys.exportTemplates, queryFn: ({ signal }) => receivablesApi.exportTemplates(signal) });
  const list = useQuery({ queryKey: receivablesKeys.exports(le ?? ""), queryFn: ({ signal }) => receivablesApi.exports(le!, signal), enabled: !!le });
  const m = useMutation({
    mutationFn: () => receivablesApi.createExport({ legal_entity_id: le!, from_date: from, to_date: to, template_id: templateId, format }, newIdempotencyKey()),
    onSuccess: () => void qc.invalidateQueries({ queryKey: receivablesKeys.exports(le ?? "") }),
  });
  return (
    <Shell title="Accounting export" subtitle="Generic ledger (CSV / XLSX) with realized FX and prior-period flags" perm={["accounting:export"]}>
      <div className={s.row}>
        <LegalEntitySelect value={le} onChange={setLe} />
        <Field label="From">
          <Input type="date" value={from} onChange={(_, d) => setFrom(d.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(_, d) => setTo(d.value)} />
        </Field>
        <Field label="Template">
          <Dropdown
            value={templates.data?.find((t) => t.id === templateId)?.name ?? "Generic ledger"}
            selectedOptions={[templateId ?? ""]}
            onOptionSelect={(_, d) => setTemplateId(d.optionValue ? String(d.optionValue) : null)}
          >
            <Option value="">Generic ledger</Option>
            {(templates.data ?? []).map((t) => (
              <Option key={t.id} value={t.id}>
                {t.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Format">
          <Dropdown value={format.toUpperCase()} selectedOptions={[format]} onOptionSelect={(_, d) => setFormat(d.optionValue as "csv" | "xlsx")}>
            <Option value="csv">CSV</Option>
            <Option value="xlsx">XLSX</Option>
          </Dropdown>
        </Field>
        <Button appearance="primary" disabled={!le || m.isPending} onClick={() => m.mutate()}>
          Export
        </Button>
      </div>
      <ErrorBar message={m.error ? errorMessage(m.error) : list.error ? errorMessage(list.error) : null} />
      <div className={s.scroll}>
        <Table size="small" aria-label="Export history">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Version</TableHeaderCell>
              <TableHeaderCell>Range</TableHeaderCell>
              <TableHeaderCell>Rows</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(list.data ?? []).map((e) => (
              <TableRow key={e.id}>
                <TableCell>v{e.version}</TableCell>
                <TableCell>
                  {e.from_date} to {e.to_date}
                </TableCell>
                <TableCell>
                  {e.row_count} {e.flagged_count > 0 && <Badge color="warning">{e.flagged_count} previously exported</Badge>}
                </TableCell>
                <TableCell>
                  <StatusPill status={e.status} />
                </TableCell>
                <TableCell>
                  <Button as="a" size="small" href={receivablesApi.exportDownloadUrl(e.id)} icon={<ArrowDownload20Regular />}>
                    {e.format.toUpperCase()}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- reconciliation
export function ReconciliationView() {
  const s = useRcvStyles();
  const qc = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const runs = useQuery({ queryKey: receivablesKeys.runs, queryFn: ({ signal }) => receivablesApi.runs(signal) });
  const findings = useQuery({ queryKey: receivablesKeys.findings(runId ?? ""), queryFn: ({ signal }) => receivablesApi.findings(runId!, signal), enabled: !!runId });
  const start = useMutation({
    mutationFn: () => receivablesApi.startRun(),
    onSuccess: (r) => {
      setRunId(r.id);
      void qc.invalidateQueries({ queryKey: receivablesKeys.runs });
    },
  });
  return (
    <Shell title="Reconciliation" subtitle="Nightly checks that every figure ties back to posted facts" perm={["reconciliation:read"]}>
      <Button icon={<Play20Regular />} disabled={start.isPending} onClick={() => start.mutate()}>
        Run now
      </Button>
      <ErrorBar message={runs.error ? errorMessage(runs.error) : start.error ? errorMessage(start.error) : null} />
      <div className={s.scroll}>
        <Table size="small" aria-label="Runs">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Started</TableHeaderCell>
              <TableHeaderCell>As of</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Findings</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(runs.data ?? []).map((r) => (
              <TableRow key={r.id} onClick={() => setRunId(r.id)} style={{ cursor: "pointer" }}>
                <TableCell>{formatDateTime(r.started_at)}</TableCell>
                <TableCell>{r.as_of}</TableCell>
                <TableCell>
                  <StatusPill status={r.status} />
                </TableCell>
                <TableCell>{r.findings_count === 0 ? <Badge color="success">0</Badge> : <Badge color="danger">{r.findings_count}</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {runId && findings.data && (
        <div className={s.stack}>
          <Text weight="semibold">Findings</Text>
          {findings.data.length === 0 && <Text className={s.muted}>No findings.</Text>}
          {findings.data.map((f) => (
            <div key={f.id} className={s.card}>
              <StatusPill status={f.severity} /> <Text weight="semibold">{f.check}</Text>{" "}
              <Text className={s.muted}>
                {f.subject_kind} {f.subject_id?.slice(0, 8)}
              </Text>
              <Text block size={200}>
                {JSON.stringify(f.details)}
              </Text>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
