"use client";

import {
  Button,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Switch,
  Tab,
  TabList,
  type TableColumnDefinition,
  type TableRowId,
  Text,
  Textarea,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess, formatDateTime } from "@/features/admin/ui";
import { AgentStateCell, CollectionsAgentSection } from "@/features/agents/finance/collections-agent-section";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { receivablesApi, receivablesKeys } from "./api";
import { Amount, LegalEntitySelect, ReceivablesTabs, StatusPill, useRcvStyles } from "./components";
import { todayIso, validatePtp } from "./logic";
import type { ActivityKind, DisputeOut, QueueRow, ReminderOut } from "./types";

const VIEW_KEY = "rcv.collections.view";

function loadView(): string {
  try {
    return window.localStorage.getItem(VIEW_KEY) ?? "all";
  } catch {
    return "all";
  }
}

/** Collections (`/receivables/collections`): keyboard-first overdue queue with saved views, a client panel with
 * the activity timeline, Log activity (PTP), Send reminder, Do-not-remind and the Disputes tab. */
export function CollectionsView() {
  const s = useRcvStyles();
  const perms = usePermissions();
  const allowed = hasAnyPermission(perms, ["receivables:read"]);
  const canWrite = hasAnyPermission(perms, ["collections:write"]);
  const [tab, setTab] = useState<"queue" | "disputes">("queue");
  const [le, setLe] = useState<string | null>(null);
  const [view, setView] = useState<string>(() => (typeof window === "undefined" ? "all" : loadView()));
  const [selected, setSelected] = useState<Set<TableRowId>>(new Set());
  const [client, setClient] = useState<QueueRow | null>(null);
  const [reminding, setReminding] = useState(false);
  const q = useQuery({
    queryKey: receivablesKeys.queue(le ?? ""),
    queryFn: ({ signal }) => receivablesApi.queue(le!, signal),
    enabled: allowed && !!le,
  });
  const rows = useMemo(() => {
    const all = q.data ?? [];
    if (view === "over60") return all.filter((r) => r.days_overdue > 60);
    if (view === "remindable") return all.filter((r) => !r.do_not_remind && r.disputed_amount === "0.00");
    if (view === "ptp") return all.filter((r) => r.open_ptp_date);
    return all;
  }, [q.data, view]);
  const columns: TableColumnDefinition<QueueRow>[] = useMemo(
    () => [
      createTableColumn<QueueRow>({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (r) => r.client_name ?? r.client_id.slice(0, 8) }),
      createTableColumn<QueueRow>({ columnId: "doc", renderHeaderCell: () => "Document", renderCell: (r) => r.number ?? "-" }),
      createTableColumn<QueueRow>({ columnId: "due", renderHeaderCell: () => "Due", renderCell: (r) => r.due_date ?? "-" }),
      createTableColumn<QueueRow>({ columnId: "age", renderHeaderCell: () => "Days overdue", renderCell: (r) => r.days_overdue }),
      createTableColumn<QueueRow>({ columnId: "open", renderHeaderCell: () => "Open", renderCell: (r) => <Amount amount={r.open_amount} currency={r.currency} /> }),
      createTableColumn<QueueRow>({ columnId: "disputed", renderHeaderCell: () => "Disputed", renderCell: (r) => <Amount amount={r.disputed_amount} currency={r.currency} /> }),
      createTableColumn<QueueRow>({ columnId: "ptp", renderHeaderCell: () => "PTP", renderCell: (r) => r.open_ptp_date ?? "" }),
      createTableColumn<QueueRow>({ columnId: "flags", renderHeaderCell: () => "", renderCell: (r) => (r.do_not_remind ? <StatusPill status="do not remind" /> : null) }),
      // Epic 63: Collections Agent state (Active / Paused / Taken over).
      createTableColumn<QueueRow>({ columnId: "agent", renderHeaderCell: () => "Agent", renderCell: (r) => <AgentStateCell clientId={r.client_id} documentId={r.document_id} /> }),
    ],
    [],
  );
  if (!allowed) return <NoAccess what="collections" />;
  const chooseView = (v: string) => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* per-viewer convenience only */
    }
  };
  return (
    <div className={s.page}>
      <PageHeader title="Collections" subtitle="Overdue documents, promises to pay, reminders and disputes" />
      <ReceivablesTabs />
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as typeof tab)}>
        <Tab value="queue">Queue</Tab>
        <Tab value="disputes">Disputes</Tab>
      </TabList>
      {tab === "disputes" ? (
        <DisputesTab canWrite={hasAnyPermission(perms, ["dispute:write"])} />
      ) : (
        <>
          <div className={s.row}>
            <LegalEntitySelect value={le} onChange={setLe} />
            <Field label="Saved view">
              <Dropdown value={{ all: "All overdue", over60: "Over 60 days", remindable: "Remindable", ptp: "With open PTP" }[view] ?? view} selectedOptions={[view]} onOptionSelect={(_, d) => chooseView(String(d.optionValue))}>
                <Option value="all">All overdue</Option>
                <Option value="over60">Over 60 days</Option>
                <Option value="remindable">Remindable</Option>
                <Option value="ptp">With open PTP</Option>
              </Dropdown>
            </Field>
            {canWrite && (
              <Button disabled={selected.size === 0} onClick={() => setReminding(true)}>
                Send reminder ({selected.size})
              </Button>
            )}
          </div>
          <ErrorBar message={q.error ? errorMessage(q.error) : null} />
          {!q.data ? (
            <GridSkeleton />
          ) : (
            <div className={s.scroll}>
              <DataGrid
                items={rows}
                columns={columns}
                getRowId={(r) => r.document_id}
                selectionMode="multiselect"
                selectedItems={selected}
                onSelectionChange={(_, d) => setSelected(d.selectedItems)}
                focusMode="composite"
                aria-label="Collections queue"
              >
                <DataGridHeader>
                  <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
                </DataGridHeader>
                <DataGridBody<QueueRow>>
                  {({ item, rowId }) => (
                    <DataGridRow<QueueRow> key={rowId} onDoubleClick={() => setClient(item)} onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter") setClient(item);
                      }}>
                      {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                    </DataGridRow>
                  )}
                </DataGridBody>
              </DataGrid>
              <Text size={200} className={s.muted}>
                Double-click or press Enter on a row to open the client panel.
              </Text>
            </div>
          )}
          {client && <ClientPanel row={client} canWrite={canWrite} onClose={() => setClient(null)} />}
          {reminding && <ReminderDialog documentIds={[...selected].map(String)} onClose={() => setReminding(false)} />}
        </>
      )}
    </div>
  );
}

function ClientPanel({ row, canWrite, onClose }: { row: QueueRow; canWrite: boolean; onClose: () => void }) {
  const s = useRcvStyles();
  const qc = useQueryClient();
  const acts = useQuery({ queryKey: receivablesKeys.activities(row.client_id), queryFn: ({ signal }) => receivablesApi.activities(row.client_id, signal) });
  const settings = useQuery({ queryKey: receivablesKeys.collectionSettings(row.client_id), queryFn: ({ signal }) => receivablesApi.collectionSettings(row.client_id, signal) });
  const [logging, setLogging] = useState(false);
  const dnr = useMutation({
    mutationFn: (value: boolean) => receivablesApi.putCollectionSettings(row.client_id, { do_not_remind: value }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: receivablesKeys.all }),
  });
  return (
    <>
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface style={{ maxWidth: 720 }}>
        <DialogBody>
          <DialogTitle>{row.client_name ?? "Client"} - collections</DialogTitle>
          <DialogContent>
            <div className={s.stack}>
              <Switch
                label="Do not remind"
                checked={!!settings.data?.do_not_remind}
                disabled={!canWrite || dnr.isPending}
                onChange={(_, d) => dnr.mutate(d.checked)}
              />
              {canWrite && <Button onClick={() => setLogging(true)}>Log activity</Button>}
              {/* Epic 63: Collections Agent section slot. */}
              <CollectionsAgentSection clientId={row.client_id} clientName={row.client_name ?? "the client"} invoiceId={row.document_id} invoiceNumber={row.number} />
              {(acts.data ?? []).length === 0 && <Text className={s.muted}>No activities yet.</Text>}
              {(acts.data ?? []).map((a) => (
                <div key={a.id} className={s.card}>
                  <div className={s.row}>
                    <StatusPill status={a.kind} />
                    {a.ptp_status && <StatusPill status={a.ptp_status} />}
                    <Text className={s.muted}>{formatDateTime(a.occurred_at)}</Text>
                  </div>
                  {a.kind === "promise_to_pay" && (
                    <Text>
                      Promised <Amount amount={a.ptp_amount} currency={a.ptp_currency ?? "INR"} /> by {a.ptp_date}
                    </Text>
                  )}
                  {a.body && <Text>{a.body}</Text>}
                </div>
              ))}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
    {logging && <LogActivityDialog row={row} onClose={() => setLogging(false)} />}
    </>
  );
}

function LogActivityDialog({ row, onClose }: { row: QueueRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<ActivityKind>("call");
  const [body, setBody] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const errors = validatePtp({ kind, ptp_amount: amount, ptp_date: date }, todayIso());
  const m = useMutation({
    mutationFn: () =>
      receivablesApi.logActivity({
        client_id: row.client_id,
        document_kind: row.document_kind,
        document_id: row.document_id,
        kind,
        body: body || null,
        ptp_amount: kind === "promise_to_pay" ? amount : null,
        ptp_currency: kind === "promise_to_pay" ? row.currency : null,
        ptp_date: kind === "promise_to_pay" ? date : null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: receivablesKeys.all });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Log activity - {row.number}</DialogTitle>
          <DialogContent>
            <Field label="Kind">
              <Dropdown value={kind.replace(/_/g, " ")} selectedOptions={[kind]} onOptionSelect={(_, d) => setKind(d.optionValue as ActivityKind)}>
                {(["call", "email", "meeting", "note", "promise_to_pay"] as ActivityKind[]).map((k) => (
                  <Option key={k} value={k}>
                    {k.replace(/_/g, " ")}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            {kind === "promise_to_pay" && (
              <>
                <Field label={`Promised amount (${row.currency})`} required validationMessage={errors.ptp_amount}>
                  <Input inputMode="decimal" value={amount} onChange={(_, d) => setAmount(d.value)} />
                </Field>
                <Field label="Promised date" required validationMessage={errors.ptp_date}>
                  <Input type="date" value={date} onChange={(_, d) => setDate(d.value)} />
                </Field>
              </>
            )}
            <Field label="Notes">
              <Textarea value={body} onChange={(_, d) => setBody(d.value)} />
            </Field>
            <ErrorBar message={m.error ? errorMessage(m.error) : null} />
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={Object.keys(errors).length > 0 || m.isPending} onClick={() => m.mutate()}>
              Save
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function ReminderDialog({ documentIds, onClose }: { documentIds: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("Payment reminder: {number}");
  const [body, setBody] = useState("<p>Invoice {number} has {currency} {open_amount} outstanding (due {due_date}). Please arrange payment.</p>");
  const [result, setResult] = useState<ReminderOut | null>(null);
  const m = useMutation({
    mutationFn: () => receivablesApi.sendReminders(documentIds, subject, body),
    onSuccess: (out) => {
      setResult(out);
      void qc.invalidateQueries({ queryKey: receivablesKeys.all });
    },
  });
  const preview = body.replace("{number}", "INV-0001").replace("{currency}", "INR").replace("{open_amount}", "1,18,000.00").replace("{due_date}", todayIso());
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Send reminder ({documentIds.length})</DialogTitle>
          <DialogContent>
            <Field label="Subject">
              <Input value={subject} onChange={(_, d) => setSubject(d.value)} />
            </Field>
            <Field label="Body (HTML)" hint="Placeholders: {number} {currency} {open_amount} {due_date}">
              <Textarea value={body} onChange={(_, d) => setBody(d.value)} resize="vertical" />
            </Field>
            <Field label="Preview">
              <Text>{/* NOSONAR */ preview.replace(/<[^>]+>/g, "")}</Text>
            </Field>
            <Text size={200}>Disputed documents and clients marked do-not-remind are skipped.</Text>
            {result && (
              <MessageBar intent={result.skipped.length ? "warning" : "success"}>
                <MessageBarBody>
                  Sent {result.sent.length}; skipped {result.skipped.length}
                  {result.skipped.length > 0 && ` (${result.skipped.map((x) => x.reason.replace(/_/g, " ")).join(", ")})`}
                </MessageBarBody>
              </MessageBar>
            )}
            <ErrorBar message={m.error ? errorMessage(m.error) : null} />
          </DialogContent>
          <DialogActions>
            {!result && (
              <Button appearance="primary" disabled={m.isPending} onClick={() => m.mutate()}>
                Send
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function DisputesTab({ canWrite }: { canWrite: boolean }) {
  const s = useRcvStyles();
  const qc = useQueryClient();
  const [status, setStatus] = useState("open");
  const q = useQuery({ queryKey: receivablesKeys.disputes(status), queryFn: ({ signal }) => receivablesApi.disputes(status, signal) });
  const resolve = useMutation({
    mutationFn: ({ d, outcome }: { d: DisputeOut; outcome: DisputeOut["status"] }) => receivablesApi.resolveDispute(d.id, { status: outcome, resolution_note: `Resolved: ${outcome.replace(/_/g, " ")}` }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: receivablesKeys.all }),
  });
  return (
    <div className={s.stack}>
      <Field label="Status">
        <Dropdown value={status} selectedOptions={[status]} onOptionSelect={(_, d) => setStatus(String(d.optionValue))}>
          {["open", "resolved_credit_note", "resolved_reissue", "rejected"].map((x) => (
            <Option key={x} value={x}>
              {x}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <ErrorBar message={q.error ? errorMessage(q.error) : resolve.error ? errorMessage(resolve.error) : null} />
      {(q.data ?? []).length === 0 && <Text className={s.muted}>No disputes.</Text>}
      {(q.data ?? []).map((d) => (
        <div key={d.id} className={s.card}>
          <div className={s.row}>
            <StatusPill status={d.status} />
            <Amount amount={d.amount} currency={d.currency} strong />
            <Text className={s.muted}>{d.age_days} days old</Text>
          </div>
          <Text>{d.reason}</Text>
          {canWrite && d.status === "open" && (
            <div className={s.row}>
              <Button size="small" onClick={() => resolve.mutate({ d, outcome: "resolved_reissue" })}>
                Resolved by reissue
              </Button>
              <Button size="small" onClick={() => resolve.mutate({ d, outcome: "rejected" })}>
                Reject dispute
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
