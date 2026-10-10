"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, ArrowLeft20Regular, DocumentPdf20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, GridSkeleton, IdSelect, NoAccess } from "@/features/admin/ui";
import { downloadApiFile } from "@/lib/api/download";
import { errorMessage, isApiError } from "@/lib/api/errors";
import {
  cellText,
  DIMENSION_LABELS,
  formatDate,
  formatRate,
  formatRatio,
  fourFifthsBadge,
  hasScoring,
  isoDate,
  isRunActive,
  isSuppressedCell,
  METHOD_LABELS,
  orderedRows,
  packFileHref,
  RUN_STATUS,
  runParamsText,
  SELECTION_POINT_LABELS,
  tableTitle,
} from "./logic";
import type { AedtOut, RunOut, Snapshot, SnapshotTable } from "./types";
import { useAedts, useFairnessPermissions, useGeneratePack, usePublish, useRun } from "./use-fairness";

const useStyles = makeStyles({
  back: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXS, marginBottom: tokens.spacingVerticalS },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingHorizontalL },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  rowEnd: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground3 },
  tableWrap: { overflowX: "auto" },
  table: { minWidth: "640px" },
  num: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
  suppressed: { color: tokens.colorNeutralForeground3, fontStyle: "italic" },
  unknownRow: { backgroundColor: tokens.colorNeutralBackground2 },
  list: { margin: 0, paddingLeft: tokens.spacingHorizontalXL },
  picker: { minWidth: "240px" },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

/** `/fairness/runs/[id]`: one adverse-impact report (polls while queued / running). */
export function RunView({ runId }: { runId: string }) {
  const styles = useStyles();
  const { canRead } = useFairnessPermissions();
  const q = useRun(runId, canRead);
  if (!canRead) return <NoAccess what="fairness reports" />;
  return (
    <>
      <AppLink href="/fairness" className={styles.back}>
        <ArrowLeft20Regular aria-hidden /> Fairness reports
      </AppLink>
      {q.isPending ? (
        <GridSkeleton rows={6} />
      ) : q.isError ? (
        isApiError(q.error) && q.error.status === 404 ? (
          <ErrorBar message="This report was not found." />
        ) : (
          <ErrorBar title="Could not load the report." message={errorMessage(q.error)} />
        )
      ) : (
        <RunBody run={q.data} />
      )}
    </>
  );
}

function RunBody({ run }: { run: RunOut }) {
  const styles = useStyles();
  const s = RUN_STATUS[run.status] ?? { label: run.status, color: "subtle" as const };
  const params = runParamsText(run.selection_point, run.params);
  return (
    <>
      <PageHeader
        title={SELECTION_POINT_LABELS[run.selection_point] ?? "Report"}
        subtitle={`${params ? `${params} · ` : ""}${formatDate(run.date_from)} – ${formatDate(run.date_to)} · k = ${run.k}`}
      />
      <div className={styles.stack}>
        <div className={styles.row}>
          <Badge appearance="tint" color={s.color}>
            {s.label}
          </Badge>
          <Caption1 className={styles.muted}>
            Created {formatDateTime(run.created_at)}
            {run.completed_at ? ` · completed ${formatDateTime(run.completed_at)}` : ""}
          </Caption1>
        </div>
        {isRunActive(run.status) && <Spinner size="small" label="The report is being calculated. This page updates automatically." />}
        {run.status === "failed" && (
          <MessageBar intent="error">
            <MessageBarBody>The report failed{run.error_code ? ` (${run.error_code})` : ""}. Try running it again.</MessageBarBody>
          </MessageBar>
        )}
        {run.status === "completed" && run.snapshot && (
          <>
            <ReportSummary run={run} snapshot={run.snapshot} />
            {run.snapshot.tables.map((t) => (
              <ReportTable key={t.key} table={t} snapshot={run.snapshot as Snapshot} />
            ))}
            <PackCard run={run} />
          </>
        )}
      </div>
    </>
  );
}

function ReportSummary({ run, snapshot }: { run: RunOut; snapshot: Snapshot }) {
  const styles = useStyles();
  const unknown = run.unknown_counts ?? {};
  return (
    <Card className={styles.card}>
      <Subtitle2 as="h2">Method</Subtitle2>
      <Body1>{METHOD_LABELS[snapshot.method] ?? METHOD_LABELS[run.method] ?? snapshot.method}</Body1>
      <Caption1 className={styles.muted}>
        Impact ratio = category rate ÷ highest category rate. A ratio below 0.80 fails the four-fifths rule and is flagged. Cells
        under {snapshot.k} applicants show as &quot;{snapshot.suppressed_label}&quot;; a complementary cell is also suppressed.
        Categories version {snapshot.category_set_version}.
        {snapshot.median_score !== null ? ` Median score: ${snapshot.median_score}.` : ""}
      </Caption1>
      <Text>
        Total applicants: <strong>{run.total_applicants ?? "—"}</strong>
      </Text>
      {Object.keys(unknown).length > 0 && (
        <Text>
          Unknown / not disclosed:{" "}
          {Object.entries(unknown)
            .map(([k, v]) => `${DIMENSION_LABELS[k as keyof typeof DIMENSION_LABELS] ?? k} ${v}`)
            .join(" · ")}
        </Text>
      )}
      {snapshot.notes.length > 0 && (
        <ul className={styles.list}>
          {snapshot.notes.map((n) => (
            <li key={n}>
              <Caption1>{n}</Caption1>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReportTable({ table, snapshot }: { table: SnapshotTable; snapshot: Snapshot }) {
  const styles = useStyles();
  const rows = orderedRows(table.rows);
  const scoring = hasScoring(table.rows);
  const title = tableTitle(table.dimensions, table.key);
  const count = (v: number | string) => (
    <TableCell className={mergeClasses(styles.num, isSuppressedCell(v) ? styles.suppressed : undefined)}>
      {isSuppressedCell(v) ? <span aria-label={`suppressed, fewer than ${snapshot.k}`}>{cellText(v, snapshot.suppressed_label)}</span> : cellText(v)}
    </TableCell>
  );
  return (
    <Card className={styles.card}>
      <Subtitle2 as="h2">{title}</Subtitle2>
      <div className={styles.tableWrap}>
        <Table aria-label={`${title} adverse impact`} className={styles.table} size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell className={styles.num}>Applicants</TableHeaderCell>
              <TableHeaderCell className={styles.num}>Selected</TableHeaderCell>
              <TableHeaderCell className={styles.num}>Selection rate</TableHeaderCell>
              <TableHeaderCell className={styles.num}>Impact ratio</TableHeaderCell>
              <TableHeaderCell>Four-fifths</TableHeaderCell>
              {scoring && <TableHeaderCell className={styles.num}>Scoring rate</TableHeaderCell>}
              {scoring && <TableHeaderCell className={styles.num}>Scoring impact ratio</TableHeaderCell>}
              {scoring && <TableHeaderCell>Four-fifths (scoring)</TableHeaderCell>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const b = r.unknown ? null : fourFifthsBadge(r.flag);
              const sb = r.unknown ? null : fourFifthsBadge(r.scoring_flag);
              return (
                <TableRow key={r.category} className={r.unknown ? styles.unknownRow : undefined}>
                  <TableCell>{r.label}</TableCell>
                  {count(r.applicants)}
                  {count(r.selected)}
                  <TableCell className={styles.num}>{r.unknown ? "—" : formatRate(r.rate)}</TableCell>
                  <TableCell className={styles.num}>{r.unknown ? "—" : formatRatio(r.impact_ratio)}</TableCell>
                  <TableCell>
                    {b && (
                      <Badge appearance="tint" color={b.color} size="small">
                        {b.label}
                      </Badge>
                    )}
                  </TableCell>
                  {scoring && <TableCell className={styles.num}>{r.unknown ? "—" : formatRate(r.scoring_rate)}</TableCell>}
                  {scoring && <TableCell className={styles.num}>{r.unknown ? "—" : formatRatio(r.scoring_impact_ratio)}</TableCell>}
                  {scoring && (
                    <TableCell>
                      {sb && (
                        <Badge appearance="tint" color={sb.color} size="small">
                          {sb.label}
                        </Badge>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Caption1 className={styles.muted}>
        Totals: {table.totals.applicants} applicants, {table.totals.selected} selected. The unknown row is excluded from impact ratios.
      </Caption1>
    </Card>
  );
}

function aedtLabel(a: AedtOut): string {
  return `${a.name}${a.version ? ` ${a.version}` : ""}${a.status !== "active" ? ` (${a.status})` : ""}`;
}

function PackCard({ run }: { run: RunOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const { canConfigure } = useFairnessPermissions();
  const aedts = useAedts();
  const pack = useGeneratePack(run.id);
  const [aedtId, setAedtId] = useState<string | null>(run.pack?.aedt_id ?? null);
  const [publishing, setPublishing] = useState(false);
  const [now] = useState(() => Date.now());
  const options = (aedts.data ?? []).filter((a) => a.status !== "retired").map((a) => ({ id: a.id, label: aedtLabel(a) }));
  const current = pack.data ?? run.pack;
  const expired = current ? new Date(current.expires_at).getTime() < now : false;
  return (
    <Card className={styles.card}>
      <Subtitle2 as="h2">Auditor pack and public summary</Subtitle2>
      <Caption1 className={styles.muted}>
        Choose the automated employment decision tool (AEDT) this audit covers. The pack holds PDF and CSV files with the aggregate
        tables, data description, method and date range.
      </Caption1>
      {aedts.isError && <ErrorBar title="Could not load the AEDT inventory." message={errorMessage(aedts.error)} />}
      <div className={styles.rowEnd}>
        <IdSelect label="AEDT" options={options} value={aedtId} onChange={setAedtId} className={styles.picker} />
        <Button
          icon={pack.isPending ? <Spinner size="tiny" /> : <DocumentPdf20Regular />}
          disabled={!aedtId || pack.isPending}
          onClick={() =>
            aedtId &&
            pack.mutate(aedtId, {
              onSuccess: () => toast.success("Auditor pack generated."),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        >
          Generate auditor pack
        </Button>
        {canConfigure && (
          <Button appearance="primary" disabled={!aedtId} onClick={() => setPublishing(true)}>
            Publish summary
          </Button>
        )}
      </div>
      {current && (
        <div className={styles.form}>
          <Caption1 className={styles.muted}>
            Generated {formatDateTime(current.generated_at)} · {expired ? "expired" : `links valid until ${formatDateTime(current.expires_at)}`}
          </Caption1>
          {!expired && (
            <div className={styles.row}>
              {current.files.map((f) => (
                <Button
                  key={f.name}
                  icon={<ArrowDownload20Regular />}
                  onClick={() =>
                    downloadApiFile(packFileHref(f.url), f.name).catch((e) =>
                      toast.error(isApiError(e) && e.status === 410 ? "This pack has expired. Generate it again." : errorMessage(e)),
                    )
                  }
                >
                  {f.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
      {publishing && aedtId && <PublishDialog runId={run.id} aedtId={aedtId} onClose={() => setPublishing(false)} />}
    </Card>
  );
}

function PublishDialog({ runId, aedtId, onClose }: { runId: string; aedtId: string; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const publish = usePublish();
  const today = isoDate(new Date());
  const [auditDate, setAuditDate] = useState(today);
  const [distributionDate, setDistributionDate] = useState(today);
  const invalid = !auditDate || !distributionDate;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !publish.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Publish summary</DialogTitle>
          <DialogContent className={styles.form}>
            <Body1>
              The summary (selection rates and impact ratios, never suppressed values) appears on your career site with the audit date
              and the date the tool was first distributed.
            </Body1>
            <Field label="Audit date" required>
              <Input type="date" value={auditDate} onChange={(_, d) => setAuditDate(d.value)} />
            </Field>
            <Field label="Distribution date" required hint="The date the AEDT was first distributed or used.">
              <Input type="date" value={distributionDate} onChange={(_, d) => setDistributionDate(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button disabled={publish.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={invalid || publish.isPending}
              icon={publish.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() =>
                publish.mutate(
                  { run_id: runId, aedt_id: aedtId, audit_date: auditDate, distribution_date: distributionDate },
                  {
                    onSuccess: () => {
                      toast.success("Summary published to the career site.");
                      onClose();
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            >
              Publish
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
