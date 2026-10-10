"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  SearchBox,
  Subtitle2,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  Textarea,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowLeft20Regular, Copy20Regular, Delete20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { ApprovalHistory } from "@/features/approvals/approval-history";
import { approvalsApi } from "@/features/approvals/api";
import { usePermission } from "@/features/auth/use-permission";
import { formatDate } from "@/features/commercials/format";
import { ApiError, errorMessage, isApiError } from "@/lib/api/errors";
import { ActualsTab } from "./actuals-tab";
import { workforceApi } from "./api";
import { ImportPanel } from "./import-panel";
import { LineDialog } from "./line-dialog";
import {
  CHANGE_KIND_COLORS,
  CHANGE_KIND_LABELS,
  displayMoney,
  formatMonth,
  LINE_TYPE_LABELS,
  PERM_APPROVE,
  PERM_READ,
  PERM_WRITE,
  planActions,
  type PlanActionDef,
  RATE_UNIT_LABELS,
  WORK_MODE_LABELS,
} from "./logic";
import { CopyPlanDialog, PlanStatusBadge } from "./plans-view";
import { RevisionsTab } from "./revisions-tab";
import { SlotsTab } from "./slots-tab";
import type { LineOut, PlanOut } from "./types";
import { usePlan, usePlanLines, useRefreshWorkforce, useWorkforceSettings } from "./use-workforce";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalS },
  grow: { flex: 1 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  meta: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL, marginBottom: tokens.spacingVerticalM, color: tokens.colorNeutralForeground3 },
  tabs: { marginBottom: tokens.spacingVerticalL, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  card: { padding: tokens.spacingHorizontalL, marginBottom: tokens.spacingVerticalL },
  bars: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalM },
  num: { fontVariantNumeric: "tabular-nums" },
});

type TabKey = "lines" | "import" | "slots" | "actuals" | "revisions";

/** A readable message for a lifecycle error (`budget_missing` lists the lines without a budget). */
function actionError(e: unknown): { title: string; body: string } {
  if (!isApiError(e)) return { title: "Action failed", body: errorMessage(e) };
  const err: ApiError = e;
  if (err.code === "budget_missing") {
    const lines = Array.isArray(err.details.lines) ? err.details.lines : [];
    const names = lines
      .map((l) => (typeof l === "string" ? l : typeof l === "object" && l !== null && "role_title" in l ? String((l as { role_title: unknown }).role_title) : null))
      .filter((x): x is string => !!x);
    return { title: "Budget missing", body: names.length ? `Add a budget to: ${names.join(", ")}.` : err.message };
  }
  if (err.code === "invalid_transition") return { title: "Not allowed now", body: err.message };
  return { title: "Action failed", body: errorMessage(err) };
}

/** `/workforce/[id]`: plan header with lifecycle actions, approval status and the five tabs. */
export function PlanDetail({ planId }: { planId: string }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const canRead = usePermission(PERM_READ);
  const canWrite = usePermission(PERM_WRITE);
  const refresh = useRefreshWorkforce();
  const q = usePlan(planId, canRead);
  const [tab, setTab] = useState<TabKey>("lines");
  const [confirm, setConfirm] = useState<PlanActionDef | null>(null);
  const [revising, setRevising] = useState(false);
  const [copying, setCopying] = useState(false);
  const [failure, setFailure] = useState<{ title: string; body: string } | null>(null);
  const act = useMutation({
    mutationFn: ({ action, reason }: { action: PlanActionDef["action"]; reason?: string }) =>
      workforceApi.action(planId, action, action === "start-revision" ? { reason: reason?.trim() || null } : undefined),
    onSuccess: async () => {
      setFailure(null);
      toast.success("Plan updated");
      await refresh();
    },
    onError: (e) => setFailure(actionError(e)),
  });

  if (!canRead) return <NoAccess what="workforce plans" />;
  const back = (
    <div className={styles.back}>
      <AppLink href="/workforce">
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Workforce plans
      </AppLink>
    </div>
  );
  if (q.isPending) return <>{back}<GridSkeleton rows={6} /></>;
  if (q.isError) {
    return (
      <>
        {back}
        {isApiError(q.error) && q.error.status === 404 ? (
          <Card style={{ maxWidth: 560 }}>
            <CardHeader header={<Subtitle2 as="h1">Plan not found</Subtitle2>} description={<Body1>This plan does not exist or you do not have access to it.</Body1>} />
          </Card>
        ) : (
          <ErrorBar title="Could not load this plan." message={errorMessage(q.error)} />
        )}
      </>
    );
  }
  const p = q.data;
  const actions = planActions(p.status, canWrite);
  const run = (a: PlanActionDef) => {
    if (a.action === "start-revision") return setRevising(true);
    if (a.confirm || a.action === "submit") return setConfirm(a);
    act.mutate({ action: a.action });
  };

  return (
    <>
      {back}
      <div className={styles.header}>
        <Title2 as="h1">{p.name}</Title2>
        <PlanStatusBadge status={p.status} />
        {p.origin === "client_forecast" && (
          <Badge appearance="outline" color="brand">
            Client forecast
          </Badge>
        )}
        {p.current_revision > 0 && <Badge appearance="tint" color="subtle">{`Revision ${p.current_revision}`}</Badge>}
        <span className={styles.grow} />
        <div className={styles.actions}>
          {canWrite && (
            <Button icon={<Copy20Regular />} onClick={() => setCopying(true)}>
              Copy
            </Button>
          )}
          {actions.map((a) => (
            <Button key={a.action} appearance={a.primary ? "primary" : "secondary"} disabled={act.isPending} onClick={() => run(a)}>
              {a.label}
            </Button>
          ))}
        </div>
      </div>
      <div className={styles.meta}>
        <Text>{p.fiscal_label ?? `${formatDate(p.period_start)} – ${formatDate(p.period_end)}`}</Text>
        <Text>{p.client_name ? `Client: ${p.client_name}` : "Internal plan"}</Text>
        <Text>{`Owner: ${p.owner_name ?? "—"}`}</Text>
        <Text className={styles.num}>{`${p.total_headcount} headcount · ${p.line_count} lines`}</Text>
        <Text className={styles.num}>{`Budget ${displayMoney(p.total_budget, p.currency)}`}</Text>
      </div>
      <div className={styles.bars}>
        {failure && (
          <MessageBar intent="error" layout="multiline">
            <MessageBarBody>
              <MessageBarTitle>{failure.title}</MessageBarTitle>
              {failure.body}
            </MessageBarBody>
          </MessageBar>
        )}
        {p.origin === "client_forecast" && p.status === "draft" && (
          <MessageBar intent="info">
            <MessageBarBody>Submitted by the client as a hiring forecast. Review the lines and add budgets before approval.</MessageBarBody>
          </MessageBar>
        )}
        {p.approval_request_id && <ApprovalStatus requestId={p.approval_request_id} />}
      </div>
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabKey)} aria-label="Plan sections">
        <Tab value="lines">Lines</Tab>
        {canWrite && p.editable && <Tab value="import">Import</Tab>}
        <Tab value="slots">Slots</Tab>
        <Tab value="actuals">Plan vs actual</Tab>
        <Tab value="revisions">Revisions</Tab>
      </TabList>
      {tab === "lines" && <LinesTab plan={p} canWrite={canWrite} onChanged={refresh} />}
      {tab === "import" && <ImportPanel plan={p} onImported={refresh} />}
      {tab === "slots" && <SlotsTab plan={p} onChanged={refresh} />}
      {tab === "actuals" && <ActualsTab plan={p} />}
      {tab === "revisions" && <RevisionsTab plan={p} />}

      <ConfirmDialog
        open={!!confirm}
        title={confirm ? `${confirm.label}?` : ""}
        confirmLabel={confirm?.label ?? "Confirm"}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await act.mutateAsync({ action: confirm!.action }).catch(() => undefined);
          setConfirm(null);
        }}
      >
        {confirm?.confirm ?? `"${p.name}" will be sent to the approval chain. Lines cannot be edited while it is pending.`}
      </ConfirmDialog>
      {revising && (
        <StartRevisionDialog
          busy={act.isPending}
          onClose={() => setRevising(false)}
          onStart={async (reason) => {
            await act.mutateAsync({ action: "start-revision", reason }).catch(() => undefined);
            setRevising(false);
          }}
        />
      )}
      {copying && (
        <CopyPlanDialog
          plan={p}
          onClose={() => setCopying(false)}
          onCopied={async (c) => {
            await refresh();
            router.push(`/workforce/${c.id}`);
          }}
        />
      )}
    </>
  );
}

/** The plan's P2 approval request (status + decisions); falls back to a link to the approvals inbox. */
function ApprovalStatus({ requestId }: { requestId: string }) {
  const styles = useStyles();
  const canApprove = usePermission(PERM_APPROVE);
  const request = useQuery({
    queryKey: ["approvals", "request", requestId],
    queryFn: ({ signal }) => approvalsApi.get(requestId, signal),
    retry: false,
  });
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Approval</Subtitle2>}
        action={canApprove ? <AppLink href="/approvals">Open approvals inbox</AppLink> : undefined}
      />
      {request.isPending ? (
        <GridSkeleton rows={2} />
      ) : request.isError ? (
        <Body1>
          Approval status is not available to you here. See the <AppLink href="/approvals">approvals inbox</AppLink>.
        </Body1>
      ) : (
        <ApprovalHistory requests={[request.data]} />
      )}
    </Card>
  );
}

function StartRevisionDialog({ busy, onClose, onStart }: { busy: boolean; onClose: () => void; onStart: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Start revision</DialogTitle>
          <DialogContent>
            <Field label="Reason" hint="Approvers see this with the changed lines.">
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={busy} onClick={() => void onStart(reason)}>
              Start revision
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

const ALL = "";

/** Lines grid: search by role / skill, filter by start month; add / edit / delete while the plan is editable. */
function LinesTab({ plan, canWrite, onChanged }: { plan: PlanOut; canWrite: boolean; onChanged: () => Promise<unknown> }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const toast = useAppToast();
  const lines = usePlanLines(plan.id, plan.current_revision);
  const settings = useWorkforceSettings(canWrite && plan.editable);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(ALL);
  const [editing, setEditing] = useState<LineOut | "new" | null>(null);
  const [deleting, setDeleting] = useState<LineOut | null>(null);
  const editable = canWrite && plan.editable;
  const inRevision = plan.status === "revision_draft" || plan.current_revision > 0;

  const months = useMemo(() => [...new Set((lines.data ?? []).map((l) => l.start_month))].sort(), [lines.data]);
  const items = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (lines.data ?? [])
      .filter((l) => !month || l.start_month === month)
      .filter((l) => !t || l.role_title.toLowerCase().includes(t) || l.skills.some((s) => s.name.toLowerCase().includes(t)))
      .sort((a, b) => a.start_month.localeCompare(b.start_month) || a.role_title.localeCompare(b.role_title));
  }, [lines.data, search, month]);

  const columns: TableColumnDefinition<LineOut>[] = [
    createTableColumn({
      columnId: "role",
      renderHeaderCell: () => "Role",
      renderCell: (l) => (
        <span className={admin.cellStack}>
          <Text weight="semibold" strikethrough={l.change_kind === "removed"}>
            {l.role_title}
          </Text>
          <Text size={200} className={admin.muted}>
            {[LINE_TYPE_LABELS[l.line_type], l.location_text, l.work_mode ? WORK_MODE_LABELS[l.work_mode] : null].filter(Boolean).join(" · ")}
          </Text>
          {l.client_comment && (
            <Text size={200} className={admin.muted}>{`Client: ${l.client_comment}`}</Text>
          )}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "skills",
      renderHeaderCell: () => "Skills",
      renderCell: (l) => (
        <span className={admin.badges}>
          {l.skills.length === 0
            ? "—"
            : l.skills.map((s) => (
                <Badge key={s.skill_key ?? s.name} appearance="outline" color="informative">
                  {s.min_proficiency ? `${s.name} ≥${s.min_proficiency}` : s.name}
                </Badge>
              ))}
        </span>
      ),
    }),
    createTableColumn({ columnId: "hc", renderHeaderCell: () => "Headcount", renderCell: (l) => <span className={styles.num}>{l.headcount}</span> }),
    createTableColumn({ columnId: "month", renderHeaderCell: () => "Start", renderCell: (l) => formatMonth(l.start_month) }),
    createTableColumn({
      columnId: "budget",
      renderHeaderCell: () => "Budget",
      renderCell: (l) => <span className={styles.num}>{displayMoney(l.budget_amount, plan.currency)}</span>,
    }),
    createTableColumn({
      columnId: "rate",
      renderHeaderCell: () => "Bill rate",
      renderCell: (l) => (
        <span className={styles.num}>
          {l.bill_rate_amount ? `${displayMoney(l.bill_rate_amount, plan.currency)} ${l.rate_unit ? RATE_UNIT_LABELS[l.rate_unit] : ""}` : "—"}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "slots",
      renderHeaderCell: () => "Slots",
      renderCell: (l) => <span className={styles.num}>{`${l.slots.open} open · ${l.slots.requisitioned} req · ${l.slots.filled} filled`}</span>,
    }),
    ...(inRevision
      ? [
          createTableColumn<LineOut>({
            columnId: "change",
            renderHeaderCell: () => "Change",
            renderCell: (l) =>
              l.change_kind === "unchanged" ? (
                "—"
              ) : (
                <Badge appearance="tint" color={CHANGE_KIND_COLORS[l.change_kind]}>
                  {CHANGE_KIND_LABELS[l.change_kind]}
                </Badge>
              ),
          }),
        ]
      : []),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => <span className={admin.muted}>Actions</span>,
      renderCell: (l) => (
        <RowActions
          label={l.role_title}
          actions={
            editable && l.change_kind !== "removed"
              ? [
                  { label: "Edit", icon: <Edit20Regular />, onClick: () => setEditing(l) },
                  { label: "Delete", icon: <Delete20Regular />, onClick: () => setDeleting(l) },
                ]
              : []
          }
        />
      ),
    }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        <SearchBox className={admin.search} placeholder="Search role or skill" value={search} onChange={(_, d) => setSearch(d.value)} aria-label="Search lines" />
        <Dropdown
          className={admin.filter}
          aria-label="Start month"
          value={month ? formatMonth(month) : "All months"}
          selectedOptions={[month]}
          onOptionSelect={(_, d) => setMonth(d.optionValue ?? ALL)}
        >
          <Option value={ALL}>All months</Option>
          {months.map((m) => (
            <Option key={m} value={m}>
              {formatMonth(m)}
            </Option>
          ))}
        </Dropdown>
        <span className={admin.grow} />
        {editable && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
            Add line
          </Button>
        )}
      </div>
      {!plan.editable && canWrite && (
        <Text size={200} className={admin.muted} as="p">
          {plan.status === "approved" ? "This plan is approved. Start a revision to change lines." : "Lines cannot be edited in this status."}
        </Text>
      )}
      <AdminGrid
        items={lines.data ? items : undefined}
        columns={columns}
        getRowId={(l) => l.id}
        loading={lines.isPending}
        error={lines.error}
        emptyText={lines.data?.length ? "No lines match these filters." : "No lines yet. Add a line or import a file."}
        label="Plan lines"
      />
      {editing && (
        <LineDialog
          plan={plan}
          line={editing === "new" ? null : editing}
          maxHeadcount={settings.data?.max_headcount_per_line}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            toast.success(editing === "new" ? "Line added" : "Line saved");
            await onChanged();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete line?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await workforceApi.deleteLine(plan.id, deleting!.id);
            toast.success(plan.status === "revision_draft" ? "Line marked as removed" : "Line deleted");
            await onChanged();
          } catch (e) {
            toast.error(errorMessage(e));
          }
          setDeleting(null);
        }}
      >
        {plan.status === "revision_draft"
          ? `"${deleting?.role_title}" will be marked as removed in this revision.`
          : `"${deleting?.role_title}" will be deleted.`}
      </ConfirmDialog>
    </>
  );
}
