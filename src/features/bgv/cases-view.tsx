"use client";

import {
  Badge,
  createTableColumn,
  Dropdown,
  Field,
  Link,
  makeStyles,
  mergeClasses,
  Option,
  Switch,
  type TableColumnDefinition,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { Clock16Regular, Warning16Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { NewBgvCaseButton } from "./new-case-dialog";
import { AdminGrid } from "@/features/admin/admin-grid";
import { NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { bgvApi, bgvKeys, type CaseFilters } from "./api";
import { CASE_STATUS_COLORS, CASE_STATUS_LABELS } from "./logic";
import type { CaseListItem, CaseStatus } from "./types";

const useStyles = makeStyles({
  flags: { display: "inline-flex", gap: tokens.spacingHorizontalXS, alignItems: "center" },
  warn: { color: tokens.colorPaletteMarigoldForeground2 },
  danger: { color: tokens.colorPaletteRedForeground1 },
});

const STATUSES = Object.keys(CASE_STATUS_LABELS) as CaseStatus[];
const ALL = "__all__";

/** `/bgv`: BGV cases with status badges, age, overdue / discrepancy flags and filters. */
export function BgvCasesView() {
  const admin = useAdminStyles();
  const styles = useStyles();
  const router = useRouter();
  const canRead = usePermission("bgv:read");
  const [status, setStatus] = useState<string>("");
  const [overdue, setOverdue] = useState(false);
  const filters: CaseFilters = { status: status || undefined, overdue: overdue || undefined };
  const list = useQuery({
    queryKey: bgvKeys.cases(filters),
    queryFn: ({ signal }) => bgvApi.cases(filters, signal),
    enabled: canRead,
  });
  if (!canRead) return <NoAccess what="background verification" />;
  const columns: TableColumnDefinition<CaseListItem>[] = [
    createTableColumn({
      columnId: "id",
      renderHeaderCell: () => "Case",
      renderCell: (c) => (
        <Link as="button" onClick={() => router.push(`/bgv/${c.id}`)}>
          {c.human_id}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "candidate", renderHeaderCell: () => "Candidate", renderCell: (c) => c.candidate_name ?? "—" }),
    createTableColumn({ columnId: "package", renderHeaderCell: () => "Package", renderCell: (c) => c.package_name ?? "—" }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (c) => (
        <Badge appearance="tint" color={CASE_STATUS_COLORS[c.status]}>
          {CASE_STATUS_LABELS[c.status]}
          {c.outcome_qualifier === "with_exceptions" ? " (exceptions)" : ""}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "required", renderHeaderCell: () => "Gate", renderCell: (c) => (c.required ? "Required" : "Ad hoc") }),
    createTableColumn({ columnId: "age", renderHeaderCell: () => "Age", renderCell: (c) => `${c.age_days} d`, compare: (a, b) => a.age_days - b.age_days }),
    createTableColumn({
      columnId: "flags",
      renderHeaderCell: () => "Flags",
      renderCell: (c) => (
        <span className={styles.flags}>
          {c.overdue_checks > 0 && (
            <Tooltip content={`${c.overdue_checks} overdue check(s)`} relationship="label">
              <Clock16Regular className={mergeClasses(styles.danger)} />
            </Tooltip>
          )}
          {c.open_discrepancies > 0 && (
            <Tooltip content={`${c.open_discrepancies} open discrepancy(ies)`} relationship="label">
              <Warning16Regular className={mergeClasses(styles.warn)} />
            </Tooltip>
          )}
        </span>
      ),
    }),
  ];
  return (
    <>
      <PageHeader title="Background verification" subtitle="BGV cases, checks and adjudication" />
      <div className={admin.toolbar}>
        <Field label="Status" className={admin.filter}>
          <Dropdown
            value={status ? CASE_STATUS_LABELS[status as CaseStatus] : "All statuses"}
            selectedOptions={[status || ALL]}
            onOptionSelect={(_, d) => setStatus(d.optionValue === ALL ? "" : String(d.optionValue))}
          >
            <Option value={ALL}>All statuses</Option>
            {STATUSES.map((s) => (
              <Option key={s} value={s}>
                {CASE_STATUS_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Switch label="Overdue checks only" checked={overdue} onChange={(_, d) => setOverdue(d.checked)} />
        <NewBgvCaseButton />
      </div>
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(c) => c.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No BGV cases match these filters."
        label="BGV cases"
        sortable
        onRowClick={(c) => router.push(`/bgv/${c.id}`)}
      />
    </>
  );
}
