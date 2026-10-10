"use client";

import {
  Badge,
  Button,
  Caption1,
  Combobox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens, mergeClasses } from "@fluentui/react-components";
import { ArrowDownload20Regular, ChevronDown20Regular, ChevronRight20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useDeferredValue, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { usePermission } from "@/features/auth/use-permission";
import { downloadApiFile } from "@/lib/api/download";
import type { AuditLogOut } from "@/lib/api/types";
import { adminApi, adminKeys, LOOKUP_PAGE_SIZE } from "./api";
import {
  AUDIT_ENTITY_TYPES,
  auditChangeRows,
  auditChangeSummary,
  auditDataRows,
  auditExportUrl,
  AUDIT_ACTOR_TYPES,
  type AuditFilters,
  EMPTY_AUDIT_FILTERS,
  formatAuditAction,
  hasActiveAuditFilters,
  invalidAuditRange,
  shortId,
} from "./audit-format";
import { adminErrorMessage } from "./errors";
import { DEFAULT_PAGE_SIZE, EMPTY_USER_FILTERS } from "./query";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess, PagingBar, useAdminStyles } from "./ui";
import { UserPicker, userLabel } from "./user-picker";

const useStyles = makeStyles({
  table: { minWidth: "860px" },
  expander: { width: "44px" },
  details: {
    backgroundColor: tokens.colorNeutralBackground2,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  changes: {
    borderCollapse: "collapse",
    width: "100%",
    "& th, & td": {
      textAlign: "left",
      padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
      borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
      verticalAlign: "top",
      overflowWrap: "anywhere",
    },
    "& th": { color: tokens.colorNeutralForeground3, fontWeight: tokens.fontWeightRegular },
  },
  old: { color: tokens.colorPaletteRedForeground1, textDecorationLine: "line-through" },
  new: { color: tokens.colorPaletteGreenForeground1 },
  code: { fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200 },
  dateInput: { minWidth: "150px" },
});

/** Audit log (story 1.6 API): filters, expandable rows with field changes, CSV export. */
export function AuditLogView() {
  const styles = useAdminStyles();
  const local = useStyles();
  const toast = useAppToast();
  const canRead = usePermission("audit:read");
  const canReadUsers = usePermission("user:read");

  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [actorLabel, setActorLabel] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const deferredFilters = useDeferredValue(filters);
  const rangeInvalid = invalidAuditRange(deferredFilters);

  const list = useQuery({
    queryKey: adminKeys.auditLogList(deferredFilters, page, DEFAULT_PAGE_SIZE),
    queryFn: ({ signal }) => adminApi.listAuditLogs(deferredFilters, page, DEFAULT_PAGE_SIZE, signal),
    enabled: canRead && !rangeInvalid,
    placeholderData: (prev) => prev,
  });
  // Actor names: the audit API returns ids only; resolve them from one page of users when allowed.
  const users = useQuery({
    queryKey: adminKeys.userList({ ...EMPTY_USER_FILTERS }, 1, LOOKUP_PAGE_SIZE),
    queryFn: ({ signal }) => adminApi.listUsers(EMPTY_USER_FILTERS, 1, LOOKUP_PAGE_SIZE, signal),
    enabled: canRead && canReadUsers,
    staleTime: 60_000,
  });
  const userNames = new Map((users.data?.items ?? []).map((u) => [u.id, userLabel(u)]));

  if (!canRead) return <NoAccess what="the audit log" />;

  const updateFilters = (patch: Partial<AuditFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const actorText = (row: AuditLogOut) => {
    if (!row.actor_id) return row.actor_type === "system" ? "System" : formatAuditAction(row.actor_type);
    const name = userNames.get(row.actor_id);
    if (name) return name;
    return row.actor_type === "user" ? shortId(row.actor_id) : `${formatAuditAction(row.actor_type)} ${shortId(row.actor_id)}`;
  };

  async function exportCsv() {
    setExporting(true);
    try {
      const { headers } = await downloadApiFile(auditExportUrl(filters), "audit-log.csv");
      const rows = headers.get("X-Export-Rows");
      if (headers.get("X-Export-Truncated") === "true") {
        toast.info(`Export limited to the newest ${rows ?? "50,000"} entries. Narrow the filters to export the rest.`);
      } else {
        toast.success(rows ? `Exported ${rows} entries` : "Export downloaded");
      }
    } catch (e) {
      toast.error(adminErrorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  const items = list.data?.items;
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every change to users, roles, teams and records, with who made it and when." />
      <div className={styles.toolbar}>
        <Field label="Entity type" className={styles.filter}>
          <Combobox
            freeform
            placeholder="All"
            value={filters.entityType}
            selectedOptions={filters.entityType ? [filters.entityType] : []}
            onChange={(e) => updateFilters({ entityType: e.target.value })}
            onOptionSelect={(_, d) => updateFilters({ entityType: d.optionValue ?? "" })}
          >
            {AUDIT_ENTITY_TYPES.map((t) => (
              <Option key={t} value={t}>
                {t}
              </Option>
            ))}
          </Combobox>
        </Field>
        <Field label="Entity id" className={styles.filter}>
          <Input
            value={filters.entityId}
            maxLength={64}
            placeholder="Any"
            onChange={(_, d) => updateFilters({ entityId: d.value })}
          />
        </Field>
        <Field label="Action starts with" className={styles.filter}>
          <Input
            value={filters.action}
            maxLength={100}
            placeholder="e.g. user. or auth.login"
            onChange={(_, d) => updateFilters({ action: d.value })}
          />
        </Field>
        {canReadUsers ? (
          <UserPicker
            className={styles.filter}
            label="Actor"
            value={filters.actorId}
            valueLabel={actorLabel}
            clearLabel="Anyone"
            placeholder="Anyone"
            activeOnly={false}
            onChange={(id, user) => {
              setActorLabel(user ? userLabel(user) : "");
              updateFilters({ actorId: id });
            }}
          />
        ) : (
          <Field label="Actor id" className={styles.filter}>
            <Input
              value={filters.actorId ?? ""}
              placeholder="Anyone"
              onChange={(_, d) => updateFilters({ actorId: d.value.trim() || null })}
            />
          </Field>
        )}
        <Field label="Actor type" className={styles.filter}>
          <Dropdown
            value={AUDIT_ACTOR_TYPES.find((t) => t.value === filters.actorType)?.label ?? "Any"}
            selectedOptions={[filters.actorType || "__any__"]}
            onOptionSelect={(_, d) => updateFilters({ actorType: d.optionValue === "__any__" ? "" : (d.optionValue ?? "") })}
          >
            <Option value="__any__">Any</Option>
            {AUDIT_ACTOR_TYPES.map((t) => (
              <Option key={t.value} value={t.value}>
                {t.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="From" className={local.dateInput}>
          <Input type="date" value={filters.fromDate} onChange={(_, d) => updateFilters({ fromDate: d.value })} />
        </Field>
        <Field
          label="To"
          className={local.dateInput}
          validationState={invalidAuditRange(filters) ? "error" : "none"}
          validationMessage={invalidAuditRange(filters) ? "Must be on or after From" : undefined}
        >
          <Input type="date" value={filters.toDate} onChange={(_, d) => updateFilters({ toDate: d.value })} />
        </Field>
        {hasActiveAuditFilters(filters) && (
          <Button
            appearance="subtle"
            onClick={() => {
              setActorLabel("");
              updateFilters(EMPTY_AUDIT_FILTERS);
            }}
          >
            Clear filters
          </Button>
        )}
        <span className={styles.grow} />
        <Button
          icon={exporting ? <Spinner size="tiny" /> : <ArrowDownload20Regular />}
          disabled={exporting || rangeInvalid}
          onClick={exportCsv}
        >
          Export CSV
        </Button>
      </div>

      {list.error && !items ? (
        <ErrorBar title="Could not load the audit log." message={adminErrorMessage(list.error)} />
      ) : (
        <div className={styles.surface}>
          {list.isPending && !items ? (
            <GridSkeleton />
          ) : (
            <Table aria-label="Audit log" className={local.table} size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell className={local.expander} aria-label="Details" />
                  <TableHeaderCell>When</TableHeaderCell>
                  <TableHeaderCell>Actor</TableHeaderCell>
                  <TableHeaderCell>Action</TableHeaderCell>
                  <TableHeaderCell>Entity</TableHeaderCell>
                  <TableHeaderCell>Changes</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(items ?? []).map((row) => {
                  const open = expanded.has(row.id);
                  return (
                    <Fragment key={row.id}>
                      <TableRow>
                        <TableCell className={local.expander}>
                          <Button
                            appearance="subtle"
                            size="small"
                            icon={open ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
                            aria-expanded={open}
                            aria-label={open ? "Hide details" : "Show details"}
                            onClick={() => toggle(row.id)}
                          />
                        </TableCell>
                        <TableCell>{formatDateTime(row.occurred_at)}</TableCell>
                        <TableCell>
                          <span className={styles.truncate}>{actorText(row)}</span>
                        </TableCell>
                        <TableCell>
                          <div className={styles.cellStack}>
                            <Text>{formatAuditAction(row.action)}</Text>
                            <Caption1 className={mergeClasses(styles.muted, local.code)}>{row.action}</Caption1>
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.entity_type ? (
                            <div className={styles.cellStack}>
                              <Text>{row.entity_type}</Text>
                              <Caption1 className={mergeClasses(styles.muted, local.code)} title={row.entity_id ?? undefined}>
                                {shortId(row.entity_id)}
                              </Caption1>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={styles.muted}>{auditChangeSummary(row.changes) || "—"}</span>
                        </TableCell>
                      </TableRow>
                      {open && (
                        <TableRow>
                          <TableCell colSpan={6} style={{ padding: 0 }}>
                            <AuditDetails row={row} actor={actorText(row)} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {items && items.length === 0 && (
            <div className={styles.empty}>
              {hasActiveAuditFilters(filters) ? "No audit entries match these filters." : "No audit entries yet."}
            </div>
          )}
          {list.data && (
            <PagingBar
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={list.data.total}
              onPageChange={setPage}
              busy={list.isFetching}
            />
          )}
        </div>
      )}
    </>
  );
}

function AuditDetails({ row, actor }: { row: AuditLogOut; actor: string }) {
  const styles = useAdminStyles();
  const local = useStyles();
  const changes = auditChangeRows(row.changes);
  const data = auditDataRows(row.data);
  return (
    <div className={local.details}>
      {changes.length > 0 && (
        <table className={local.changes} aria-label="Field changes">
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Old value</th>
              <th scope="col">New value</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.field}>
                <td>
                  {c.label}{" "}
                  {c.kind !== "changed" && (
                    <Badge size="small" appearance="tint" color={c.kind === "added" ? "success" : "danger"}>
                      {c.kind === "added" ? "set" : "cleared"}
                    </Badge>
                  )}
                </td>
                <td className={c.old === "—" ? styles.muted : local.old}>{c.old}</td>
                <td className={c.new === "—" ? styles.muted : local.new}>{c.new}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <dl className={styles.detailList}>
        <dt>Actor</dt>
        <dd>
          {actor} ({row.actor_type}
          {row.actor_id ? `, ${row.actor_id}` : ""})
        </dd>
        {row.entity_id && (
          <>
            <dt>Entity id</dt>
            <dd className={local.code}>{row.entity_id}</dd>
          </>
        )}
        {data.map((d) => (
          <Fragment key={d.key}>
            <dt>{d.label}</dt>
            <dd>{d.value}</dd>
          </Fragment>
        ))}
        <dt>IP address</dt>
        <dd>{row.ip ?? "—"}</dd>
        <dt>User agent</dt>
        <dd>{row.user_agent ?? "—"}</dd>
        <dt>Request id</dt>
        <dd className={local.code}>{row.request_id ?? "—"}</dd>
      </dl>
    </div>
  );
}
