"use client";

import {
  Badge,
  Card,
  CardHeader,
  createTableColumn,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowRight16Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, formatDateTime, GridSkeleton, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { CHANGE_KIND_COLORS, CHANGE_KIND_LABELS, changedDiffLines, diffRows } from "./logic";
import type { PlanOut, RevisionOut } from "./types";
import { usePlanRevisions, useRevisionDiff } from "./use-workforce";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, marginTop: tokens.spacingVerticalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  line: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  before: { color: tokens.colorNeutralForeground3, textDecorationLine: "line-through" },
  after: { fontWeight: tokens.fontWeightSemibold },
});

/** Revision history; selecting a revision shows only its changed lines, before -> after per changed field. */
export function RevisionsTab({ plan }: { plan: PlanOut }) {
  const admin = useAdminStyles();
  const revisions = usePlanRevisions(plan.id);
  const [selected, setSelected] = useState<number | null>(null);
  const columns: TableColumnDefinition<RevisionOut>[] = [
    createTableColumn({
      columnId: "no",
      renderHeaderCell: () => "Revision",
      renderCell: (r) => (
        <Link as="button" onClick={() => setSelected(r.revision_no)}>
          {r.revision_no === 0 ? "Original" : `Revision ${r.revision_no}`}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (r) => <Badge appearance="tint">{r.status.replace(/_/g, " ")}</Badge> }),
    createTableColumn({ columnId: "changed", renderHeaderCell: () => "Changed lines", renderCell: (r) => r.changed_lines }),
    createTableColumn({ columnId: "reason", renderHeaderCell: () => "Reason", renderCell: (r) => r.reason ?? "—" }),
    createTableColumn({ columnId: "created", renderHeaderCell: () => "Started", renderCell: (r) => formatDateTime(r.created_at) }),
    createTableColumn({ columnId: "decided", renderHeaderCell: () => "Decided", renderCell: (r) => formatDateTime(r.decided_at) }),
  ];
  return (
    <>
      <AdminGrid
        items={revisions.data}
        columns={columns}
        getRowId={(r) => r.id}
        loading={revisions.isPending}
        error={revisions.error}
        emptyText="No revisions yet. Revisions start when an approved plan is changed."
        label="Plan revisions"
        onRowClick={(r) => setSelected(r.revision_no)}
      />
      {selected !== null && <RevisionDiff plan={plan} revision={selected} />}
      {selected === null && (revisions.data?.length ?? 0) > 0 && (
        <Text as="p" size={200} className={admin.muted}>
          Select a revision to see what changed.
        </Text>
      )}
    </>
  );
}

function RevisionDiff({ plan, revision }: { plan: PlanOut; revision: number }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const diff = useRevisionDiff(plan.id, revision);
  if (diff.isPending) return <GridSkeleton rows={4} />;
  if (diff.isError) return <ErrorBar message={errorMessage(diff.error)} />;
  const lines = changedDiffLines(diff.data.lines);
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">{`Changes in revision ${revision}`}</Subtitle2>} description={`${lines.length} changed line${lines.length === 1 ? "" : "s"}`} />
      {diff.data.money_masked && (
        <MessageBar intent="info">
          <MessageBarBody>Budget and rate changes are hidden (no compensation access).</MessageBarBody>
        </MessageBar>
      )}
      {lines.length === 0 && <Text className={admin.muted}>No lines changed in this revision.</Text>}
      {lines.map((l) => (
        <div key={l.lineage_id} className={styles.line}>
          <div className={styles.head}>
            <Text weight="semibold">{l.role_title}</Text>
            <Badge appearance="tint" color={CHANGE_KIND_COLORS[l.change_kind]}>
              {CHANGE_KIND_LABELS[l.change_kind]}
            </Badge>
          </div>
          <Table size="small" aria-label={`Changes to ${l.role_title}`}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Field</TableHeaderCell>
                <TableHeaderCell>Before</TableHeaderCell>
                <TableHeaderCell aria-hidden />
                <TableHeaderCell>After</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diffRows(l, plan.currency).map((row) => (
                <TableRow key={row.field}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell>
                    <span className={row.before !== "—" ? styles.before : undefined}>{row.before}</span>
                  </TableCell>
                  <TableCell aria-hidden>
                    <ArrowRight16Regular />
                  </TableCell>
                  <TableCell>
                    <span className={styles.after}>{row.after}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </Card>
  );
}
