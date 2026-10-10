"use client";

import {
  Button,
  createTableColumn,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, CheckmarkCircle20Regular, Play20Regular } from "@fluentui/react-icons";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { vendorsApi } from "./api";
import { formatDate, formatDecimalMoney } from "./format";
import { groupLines } from "./statement-lines";
import type { StatementLineOut, StatementOut } from "./types";
import { useStatement, useStatements, useVendorMutations } from "./use-vendors";
import { SimpleGrid } from "./ui";

const useStyles = makeStyles({
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "flex-end", marginBottom: tokens.spacingVerticalM },
  group: { marginTop: tokens.spacingVerticalL },
  total: { fontWeight: tokens.fontWeightSemibold },
  selected: { outline: `2px solid ${tokens.colorBrandStroke1}` },
});

/** `/vendors/statements`: build, review, finalize and download vendor payable statements. */
export function StatementsView() {
  const canRead = usePermission("payroll:read");
  const canBuild = usePermission("payroll:generate");
  const styles = useStyles();
  const toast = useAppToast();
  const { build } = useVendorMutations();
  const [le, setLe] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  if (!canRead) return <NoAccess what="vendor statements" />;
  const run = async () => {
    try {
      const out = await build.mutateAsync({ all: true, legal_entity_id: le.trim(), period_start: start, period_end: end });
      toast.success(`${out.statements.length} draft statement(s) built, ${out.skipped.length} vendor(s) with nothing to state`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      <PageHeader title="Vendor statements" subtitle="What you owe vendors for approved worker time and expenses." />
      {canBuild && (
        <div className={styles.row}>
          <Field label="Legal entity id" required>
            <Input value={le} onChange={(_, d) => setLe(d.value)} />
          </Field>
          <Field label="Period start" required>
            <Input type="date" value={start} onChange={(_, d) => setStart(d.value)} />
          </Field>
          <Field label="Period end" required>
            <Input type="date" value={end} onChange={(_, d) => setEnd(d.value)} />
          </Field>
          <Button appearance="primary" icon={<Play20Regular />} disabled={!le || !start || !end || build.isPending} onClick={run}>
            Build drafts
          </Button>
        </div>
      )}
      <VendorStatementsPanel />
    </>
  );
}

/** Statement list + detail (also the vendor detail page's Statements tab). */
export function VendorStatementsPanel({ vendorId }: { vendorId?: string }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const list = useStatements(vendorId);
  const [selected, setSelected] = useState<string | null>(null);
  const columns: TableColumnDefinition<StatementOut>[] = useMemo(
    () => [
      createTableColumn<StatementOut>({
        columnId: "id",
        renderHeaderCell: () => "Statement",
        renderCell: (s) => (
          <Button appearance="transparent" onClick={() => setSelected(s.id)}>
            {s.human_id}
          </Button>
        ),
      }),
      createTableColumn<StatementOut>({ columnId: "vendor", renderHeaderCell: () => "Vendor", renderCell: (s) => s.vendor_name ?? "—" }),
      createTableColumn<StatementOut>({
        columnId: "period",
        renderHeaderCell: () => "Period",
        renderCell: (s) => `${formatDate(s.period_start)} – ${formatDate(s.period_end)}`,
      }),
      createTableColumn<StatementOut>({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (s) => s.status }),
      createTableColumn<StatementOut>({
        columnId: "total",
        renderHeaderCell: () => "Total",
        renderCell: (s) => formatDecimalMoney(s.total_amount, s.currency),
      }),
    ],
    [],
  );
  return (
    <>
      <ErrorBar message={list.error ? errorMessage(list.error) : null} />
      <div className={admin.surface}>
        {list.isLoading ? (
          <GridSkeleton rows={3} />
        ) : !list.data?.length ? (
          <div className={admin.empty}>No statements yet.</div>
        ) : (
          <SimpleGrid items={list.data} columns={columns} />
        )}
      </div>
      {selected && (
        <div className={mergeClasses(styles.group)}>
          <StatementDetail id={selected} />
        </div>
      )}
    </>
  );
}

function StatementDetail({ id }: { id: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const canFinalize = usePermission("payroll:finalize");
  const { finalize } = useVendorMutations();
  const st = useStatement(id);
  const [confirm, setConfirm] = useState(false);
  if (st.isLoading) return <GridSkeleton rows={3} />;
  if (!st.data) return <ErrorBar message={errorMessage(st.error)} />;
  const s = st.data;
  const lineCols: TableColumnDefinition<StatementLineOut>[] = [
    createTableColumn({ columnId: "date", renderHeaderCell: () => "Date", renderCell: (l) => formatDate(l.work_date) }),
    createTableColumn({ columnId: "kind", renderHeaderCell: () => "Kind", renderCell: (l) => l.line_kind }),
    createTableColumn({ columnId: "cat", renderHeaderCell: () => "Category", renderCell: (l) => l.time_category ?? "—" }),
    createTableColumn({ columnId: "qty", renderHeaderCell: () => "Qty", renderCell: (l) => l.quantity }),
    createTableColumn({ columnId: "rate", renderHeaderCell: () => "Rate", renderCell: (l) => formatDecimalMoney(l.vendor_rate, l.currency, 4) }),
    createTableColumn({ columnId: "mult", renderHeaderCell: () => "×", renderCell: (l) => l.multiplier }),
    createTableColumn({ columnId: "amount", renderHeaderCell: () => "Amount", renderCell: (l) => formatDecimalMoney(l.amount, l.currency) }),
  ];
  return (
    <>
      <div className={styles.row}>
        <Subtitle2>
          {s.human_id} · {s.vendor_name} · {s.status}
        </Subtitle2>
        {s.status === "draft" && canFinalize && (
          <Button appearance="primary" icon={<CheckmarkCircle20Regular />} onClick={() => setConfirm(true)}>
            Finalize
          </Button>
        )}
        <Button icon={<ArrowDownload20Regular />} as="a" href={vendorsApi.downloadUrl(s.id, "pdf")}>
          PDF
        </Button>
        <Button icon={<ArrowDownload20Regular />} as="a" href={vendorsApi.downloadUrl(s.id, "csv")}>
          CSV
        </Button>
      </div>
      {groupLines(s.lines).map((g) => (
        <div key={g.worker} className={styles.group}>
          <Text weight="semibold">{g.worker}</Text>
          <SimpleGrid items={g.lines} columns={lineCols} />
          <Text className={styles.total}>Subtotal {formatDecimalMoney(g.subtotal, s.currency)}</Text>
        </div>
      ))}
      <Text className={styles.total}>Total {formatDecimalMoney(s.total_amount, s.currency)}</Text>
      <ConfirmDialog
        open={confirm}
        title="Finalize statement"
        confirmLabel="Finalize"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          try {
            await finalize.mutateAsync(s.id);
            toast.success(`${s.human_id} finalized`);
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        Finalizing posts every line to the payable ledger. A finalized statement can never be edited; corrections appear on
        the next statement.
      </ConfirmDialog>
    </>
  );
}
