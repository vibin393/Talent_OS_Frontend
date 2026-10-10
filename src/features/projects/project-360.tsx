"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  createTableColumn,
  Field,
  Input,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Subtitle2,
  Tab,
  TabList,
  type TableColumnDefinition,
  Textarea,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowLeft20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ConfirmDialog, DetailsDrawer, ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { formatDate, formatMoney } from "@/features/commercials/format";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { projectsApi } from "./api";
import { BudgetCard } from "./budget-card";
import { DeliverableDrawer } from "./deliverable-drawer";
import {
  DELIVERABLE_STATUS_COLORS,
  DELIVERABLE_STATUS_LABELS,
  PROJECT_TRANSITIONS,
  RISK_LABELS,
  ROLE_STATUS_COLORS,
  ROLE_STATUS_LABELS,
} from "./logic";
import { BurnCell, ProjectStatusBadge } from "./projects-view";
import { ResourceTimelineCard } from "./resource-timeline";
import { AssignDialog, AssignmentWarnings, EndAssignmentDialog, RoleDialog } from "./role-dialogs";
import type { AssignmentOut, DeliverableOut, Project360 as P360, ProjectInvoiceRef, ProjectMilestone, ProjectOut, ProjectRoleOut, ProjectStatus } from "./types";
import { useProject360, useRefreshProjects } from "./use-projects";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  grow: { flex: 1 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  tabs: { marginBottom: tokens.spacingVerticalL, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  card: { padding: tokens.spacingHorizontalL, marginBottom: tokens.spacingVerticalL },
  cards: { display: "grid", gap: tokens.spacingHorizontalL, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", marginBottom: tokens.spacingVerticalL },
  risks: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, marginBottom: tokens.spacingVerticalM },
  section: { marginTop: tokens.spacingVerticalXL, marginBottom: tokens.spacingVerticalS },
});

type TabKey = "overview" | "roles" | "deliverables" | "milestones" | "budget" | "invoices";

/** `/projects/[id]`: header with status transitions, risks and the six 360 tabs. */
export function Project360({ projectId }: { projectId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const canRead = usePermission("project:read");
  const canWrite = usePermission("project:write");
  const canRecord = usePermission("deliverable:record");
  const refresh = useRefreshProjects();
  const [tab, setTab] = useState<TabKey>("overview");
  const [confirm, setConfirm] = useState<{ to: ProjectStatus; label: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const q = useProject360(projectId, canRead);
  const transition = useMutation({
    mutationFn: (to: ProjectStatus) => projectsApi.transition(projectId, to),
    onSuccess: async () => {
      toast.success("Project status updated");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!canRead) return <NoAccess what="projects" />;
  const back = (
    <div className={styles.back}>
      <AppLink href="/projects">
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Projects
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
            <CardHeader header={<Subtitle2 as="h1">Project not found</Subtitle2>} description={<Body1>This project does not exist or you do not have access to it.</Body1>} />
          </Card>
        ) : (
          <ErrorBar title="Could not load this project." message={errorMessage(q.error)} />
        )}
      </>
    );
  }
  const data = q.data;
  const p = data.project;
  const transitions = canWrite ? PROJECT_TRANSITIONS[p.status] : [];

  return (
    <>
      {back}
      <div className={styles.header}>
        <Title2 as="h1">
          {p.human_id} · {p.name}
        </Title2>
        <ProjectStatusBadge status={p.status} />
        <span className={styles.grow} />
        <div className={styles.actions}>
          {canWrite && (
            <Button icon={<Edit20Regular />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {transitions.map((t, i) => (
            <Button
              key={t.to}
              appearance={i === 0 && t.to !== "cancelled" ? "primary" : "secondary"}
              disabled={transition.isPending}
              onClick={() => setConfirm(t)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>
      {data.risks.length > 0 && (
        <div className={styles.risks}>
          {data.risks.map((r, i) => (
            <MessageBar key={`${r.kind}-${r.ref_id ?? i}`} intent={r.kind === "over_allocation" || r.kind === "budget_threshold" ? "error" : "warning"}>
              <MessageBarBody>
                <MessageBarTitle>{RISK_LABELS[r.kind] ?? r.kind}</MessageBarTitle>
                {r.message}
              </MessageBarBody>
            </MessageBar>
          ))}
        </div>
      )}
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabKey)} aria-label="Project sections">
        <Tab value="overview">Overview</Tab>
        <Tab value="roles">Roles &amp; resourcing</Tab>
        <Tab value="deliverables">Deliverables</Tab>
        <Tab value="milestones">Milestones</Tab>
        <Tab value="budget">Budget &amp; burn</Tab>
        <Tab value="invoices">Invoices</Tab>
      </TabList>
      {tab === "overview" && <Overview data={data} />}
      {tab === "roles" && <RolesTab data={data} canWrite={canWrite} onChanged={refresh} />}
      {tab === "deliverables" && <DeliverablesTab data={data} canWrite={canWrite} canRecord={canRecord} onChanged={refresh} />}
      {tab === "milestones" && <MilestonesTab data={data} />}
      {tab === "budget" && (
        <BudgetCard projectId={p.id} currency={p.currency} budgets={data.budgets} burn={data.burn} canWrite={canWrite} onChanged={refresh} />
      )}
      {tab === "invoices" && <InvoicesTab invoices={data.invoices} />}
      <ConfirmDialog
        open={!!confirm}
        title={confirm ? `${confirm.label}?` : ""}
        confirmLabel={confirm?.label ?? "Confirm"}
        onClose={() => setConfirm(null)}
        onConfirm={() => transition.mutateAsync(confirm!.to)}
      >
        {p.human_id} will move to {confirm?.to.replace("_", " ")}.
      </ConfirmDialog>
      {editing && <EditProjectDrawer project={p} onClose={() => setEditing(false)} onSaved={refresh} />}
    </>
  );
}

function Overview({ data }: { data: P360 }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const p = data.project;
  const cost = data.burn.find((b) => b.dimension === "cost");
  return (
    <div className={styles.cards}>
      <Card className={styles.card}>
        <CardHeader header={<Subtitle2 as="h2">Details</Subtitle2>} />
        <dl className={admin.detailList}>
          <dt>Client</dt>
          <dd>
            <AppLink href={`/clients/${p.client_id}`}>{p.client_name ?? "Client"}</AppLink>
          </dd>
          <dt>Owner</dt>
          <dd>{p.owner_name ?? "—"}</dd>
          <dt>Start</dt>
          <dd>{formatDate(p.start_date)}</dd>
          <dt>End</dt>
          <dd>{formatDate(p.end_date)}</dd>
          <dt>Currency</dt>
          <dd>{p.currency}</dd>
          {p.description && (
            <>
              <dt>Description</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{p.description}</dd>
            </>
          )}
          {p.risk_note && (
            <>
              <dt>Risk note</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{p.risk_note}</dd>
            </>
          )}
        </dl>
      </Card>
      <Card className={styles.card}>
        <CardHeader header={<Subtitle2 as="h2">SOW</Subtitle2>} />
        {data.sow ? (
          <dl className={admin.detailList}>
            <dt>Contract</dt>
            <dd>
              <AppLink href={`/contracts/${data.sow.contract_id}`}>{data.sow.human_id}</AppLink> {data.sow.title ? `· ${data.sow.title}` : ""}
            </dd>
            <dt>Status</dt>
            <dd>{data.sow.status.replace("_", " ")}</dd>
            <dt>Pricing model</dt>
            <dd>{data.sow.pricing_model ? data.sow.pricing_model.replace(/_/g, " ") : "—"}</dd>
            <dt>Total value</dt>
            <dd>{data.sow.total_value ? formatMoney(data.sow.total_value.amount, data.sow.total_value.currency) : "—"}</dd>
            <dt>Term</dt>
            <dd>
              {formatDate(data.sow.start_date)} – {formatDate(data.sow.end_date)}
            </dd>
          </dl>
        ) : (
          <Body1 className={admin.muted}>No SOW linked.</Body1>
        )}
      </Card>
      <Card className={styles.card}>
        <CardHeader header={<Subtitle2 as="h2">At a glance</Subtitle2>} />
        <dl className={admin.detailList}>
          <dt>Roles</dt>
          <dd>{data.roles.length}</dd>
          <dt>Active assignments</dt>
          <dd>{data.assignments.filter((a) => a.status === "active").length}</dd>
          <dt>Staffing gaps</dt>
          <dd>{data.gap_count}</dd>
          <dt>Over-allocated</dt>
          <dd>{data.over_allocation_count}</dd>
          <dt>Awaiting acceptance</dt>
          <dd>{data.deliverables.filter((d) => d.status === "submitted").length}</dd>
          <dt>Cost burn</dt>
          <dd>
            <BurnCell pct={cost?.pct ?? null} />
          </dd>
        </dl>
      </Card>
    </div>
  );
}

function RolesTab({ data, canWrite, onChanged }: { data: P360; canWrite: boolean; onChanged: () => Promise<unknown> }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const router = useRouter();
  const p = data.project;
  const [roleDialog, setRoleDialog] = useState<ProjectRoleOut | "new" | null>(null);
  const [assigning, setAssigning] = useState<ProjectRoleOut | null>(null);
  const [ending, setEnding] = useState<AssignmentOut | null>(null);
  const [deleting, setDeleting] = useState<ProjectRoleOut | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const demand = useMutation({
    mutationFn: (r: ProjectRoleOut) => projectsApi.createDemand(p.id, r.id),
    onSuccess: async (d) => {
      toast.success("Demand created");
      await onChanged();
      router.push(`/demands/${d.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const roleStatus = useMutation({
    mutationFn: (v: { r: ProjectRoleOut; status: "open" | "closed" | "cancelled" }) => projectsApi.updateRole(v.r.id, { status: v.status }),
    onSuccess: onChanged,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const roleCols: TableColumnDefinition<ProjectRoleOut>[] = [
    createTableColumn({ columnId: "title", renderHeaderCell: () => "Role", renderCell: (r) => r.title }),
    createTableColumn({ columnId: "hc", renderHeaderCell: () => "Filled / headcount", renderCell: (r) => `${Number(r.filled_fte)} / ${r.headcount}` }),
    createTableColumn({ columnId: "dates", renderHeaderCell: () => "Dates", renderCell: (r) => `${formatDate(r.start_date)} – ${formatDate(r.end_date)}` }),
    createTableColumn({
      columnId: "skills",
      renderHeaderCell: () => "Skills",
      renderCell: (r) => r.skills.map((s) => s.label || s.skill_key).join(", ") || "—",
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <span className={admin.badges}>
          <Badge appearance="tint" color={ROLE_STATUS_COLORS[r.status]}>
            {ROLE_STATUS_LABELS[r.status]}
          </Badge>
          {r.demand_ids.map((id, i) => (
            <AppLink key={id} href={`/demands/${id}`}>
              Demand {r.demand_ids.length > 1 ? i + 1 : ""}
            </AppLink>
          ))}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (r) =>
        canWrite ? (
          <RowActions
            label={r.title}
            actions={[
              ...(r.status === "open" ? [{ label: "Assign placement", onClick: () => setAssigning(r) }] : []),
              ...(r.status === "open" ? [{ label: "Create demand", onClick: () => demand.mutate(r), disabled: demand.isPending }] : []),
              { label: "Edit", onClick: () => setRoleDialog(r) },
              ...(r.status === "open" || r.status === "filled" ? [{ label: "Close role", onClick: () => roleStatus.mutate({ r, status: "closed" }) }] : []),
              ...(r.status === "closed" ? [{ label: "Reopen role", onClick: () => roleStatus.mutate({ r, status: "open" }) }] : []),
              ...(r.status !== "cancelled" ? [{ label: "Cancel role", onClick: () => roleStatus.mutate({ r, status: "cancelled" }) }] : []),
              ...(r.active_assignments === 0 ? [{ label: "Delete", onClick: () => setDeleting(r) }] : []),
            ]}
          />
        ) : null,
    }),
  ];
  const asgCols: TableColumnDefinition<AssignmentOut>[] = [
    createTableColumn({
      columnId: "worker",
      renderHeaderCell: () => "Worker",
      renderCell: (a) => (
        <AppLink href={`/placements/${a.placement_id}`}>
          {a.worker_name ?? "Worker"} {a.placement_human_id ? `(${a.placement_human_id})` : ""}
        </AppLink>
      ),
    }),
    createTableColumn({ columnId: "role", renderHeaderCell: () => "Role", renderCell: (a) => a.role_title ?? "—" }),
    createTableColumn({ columnId: "pct", renderHeaderCell: () => "Allocation", renderCell: (a) => `${Number(a.allocation_pct)}%` }),
    createTableColumn({ columnId: "dates", renderHeaderCell: () => "Dates", renderCell: (a) => `${formatDate(a.start_date)} – ${formatDate(a.end_date)}` }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (a) => (
        <Badge appearance="tint" color={a.status === "active" ? "success" : "subtle"}>
          {a.status === "active" ? "Active" : `Ended${a.ended_reason ? ` · ${a.ended_reason}` : ""}`}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (a) =>
        canWrite && a.status === "active" ? <RowActions label={a.worker_name ?? "assignment"} actions={[{ label: "End assignment", onClick: () => setEnding(a) }]} /> : null,
    }),
  ];
  return (
    <>
      <AssignmentWarnings warnings={warnings} />
      <div className={admin.toolbar}>
        <Subtitle2 as="h2">Roles</Subtitle2>
        <span className={admin.grow} />
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setRoleDialog("new")}>
            Add role
          </Button>
        )}
      </div>
      <AdminGrid items={data.roles} columns={roleCols} getRowId={(r) => r.id} loading={false} error={null} emptyText="No roles yet." label="Project roles" />
      <Subtitle2 as="h2" className={styles.section} block>
        Assignments
      </Subtitle2>
      <AdminGrid items={data.assignments} columns={asgCols} getRowId={(a) => a.id} loading={false} error={null} emptyText="No assignments yet." label="Assignments" />
      <Subtitle2 as="h2" className={styles.section} block>
        Resource timeline
      </Subtitle2>
      <ResourceTimelineCard projectId={p.id} />
      {roleDialog && <RoleDialog projectId={p.id} role={roleDialog === "new" ? null : roleDialog} onClose={() => setRoleDialog(null)} onSaved={onChanged} />}
      {assigning && (
        <AssignDialog
          role={assigning}
          clientId={p.client_id}
          onClose={() => setAssigning(null)}
          onSaved={async (a) => {
            setWarnings(a.warnings ?? []);
            await onChanged();
          }}
        />
      )}
      {ending && <EndAssignmentDialog assignment={ending} onClose={() => setEnding(null)} onSaved={onChanged} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete role?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await projectsApi.deleteRole(deleting!.id);
            await onChanged();
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        {deleting?.title} will be removed from this project.
      </ConfirmDialog>
    </>
  );
}

function DeliverablesTab({ data, canWrite, canRecord, onChanged }: { data: P360; canWrite: boolean; canRecord: boolean; onChanged: () => Promise<unknown> }) {
  const admin = useAdminStyles();
  const [open, setOpen] = useState<DeliverableOut | "new" | null>(null);
  const columns: TableColumnDefinition<DeliverableOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Deliverable",
      renderCell: (d) => (
        <Link as="button" onClick={() => setOpen(d)}>
          {d.name}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "milestone", renderHeaderCell: () => "Milestone", renderCell: (d) => d.milestone_name ?? "—" }),
    createTableColumn({ columnId: "due", renderHeaderCell: () => "Due", renderCell: (d) => formatDate(d.due_date) }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (d) => (
        <Badge appearance="tint" color={DELIVERABLE_STATUS_COLORS[d.status]}>
          {DELIVERABLE_STATUS_LABELS[d.status]}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "accepted", renderHeaderCell: () => "Accepted", renderCell: (d) => (d.accepted_at ? formatDate(d.accepted_at.slice(0, 10)) : "—") }),
  ];
  return (
    <>
      {canWrite && (
        <div className={admin.toolbar}>
          <span className={admin.grow} />
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setOpen("new")}>
            New deliverable
          </Button>
        </div>
      )}
      <AdminGrid
        items={data.deliverables}
        columns={columns}
        getRowId={(d) => d.id}
        loading={false}
        error={null}
        emptyText="No deliverables yet."
        label="Deliverables"
        onRowClick={(d) => setOpen(d)}
      />
      {open && (
        <DeliverableDrawer
          key={open === "new" ? "new" : open.id}
          projectId={data.project.id}
          clientId={data.project.client_id}
          deliverable={open === "new" ? null : open}
          milestones={data.milestones}
          canWrite={canWrite}
          canRecord={canRecord}
          onClose={() => setOpen(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

function MilestonesTab({ data }: { data: P360 }) {
  const admin = useAdminStyles();
  const columns: TableColumnDefinition<ProjectMilestone>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Milestone", renderCell: (m) => m.name }),
    createTableColumn({ columnId: "amount", renderHeaderCell: () => "Amount", renderCell: (m) => formatMoney(m.amount.amount, m.amount.currency) }),
    createTableColumn({ columnId: "due", renderHeaderCell: () => "Due", renderCell: (m) => formatDate(m.due_date) }),
    createTableColumn({
      columnId: "deliverables",
      renderHeaderCell: () => "Deliverables accepted",
      renderCell: (m) => {
        const ds = data.deliverables.filter((d) => d.milestone_id === m.id && d.status !== "cancelled");
        return ds.length ? `${ds.filter((d) => d.status === "accepted").length} / ${ds.length}` : "—";
      },
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (m) => (
        <span className={admin.badges}>
          <Badge appearance="tint" color={m.status === "accepted" ? "success" : m.status === "cancelled" ? "subtle" : "informative"}>
            {m.status === "accepted" ? "Accepted (billable)" : m.status === "cancelled" ? "Cancelled" : "Planned"}
          </Badge>
          {m.billed && (
            <Badge appearance="filled" color="brand">
              Billed
            </Badge>
          )}
        </span>
      ),
    }),
  ];
  return (
    <>
      {data.sow && (
        <div className={admin.toolbar}>
          <Body1 className={admin.muted}>
            Milestones belong to <AppLink href={`/contracts/${data.sow.contract_id}`}>{data.sow.human_id}</AppLink>; a milestone becomes billable when all its
            deliverables are accepted.
          </Body1>
        </div>
      )}
      <AdminGrid items={data.milestones} columns={columns} getRowId={(m) => m.id} loading={false} error={null} emptyText="No milestones on the SOW." label="Milestones" />
    </>
  );
}

function InvoicesTab({ invoices }: { invoices: ProjectInvoiceRef[] }) {
  const columns: TableColumnDefinition<ProjectInvoiceRef>[] = [
    createTableColumn({
      columnId: "number",
      renderHeaderCell: () => "Document",
      renderCell: (i) => (
        <AppLink href={`/billing/${i.kind === "credit_note" ? "credit-notes" : "invoices"}/${i.id}`}>
          {i.kind === "credit_note" ? "Credit note" : "Invoice"} {i.number ?? "(draft)"}
        </AppLink>
      ),
    }),
    createTableColumn({ columnId: "date", renderHeaderCell: () => "Date", renderCell: (i) => formatDate(i.doc_date) }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (i) => i.status.replace(/_/g, " ") }),
    createTableColumn({ columnId: "amount", renderHeaderCell: () => "Amount", renderCell: (i) => formatMoney(i.amount.amount, i.amount.currency) }),
  ];
  return <AdminGrid items={invoices} columns={columns} getRowId={(i) => `${i.kind}-${i.id}`} loading={false} error={null} emptyText="No invoices for this project yet." label="Invoices" />;
}

function EditProjectDrawer({ project, onClose, onSaved }: { project: ProjectOut; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const admin = useAdminStyles();
  const [form, setForm] = useState({
    name: project.name,
    start_date: project.start_date ?? "",
    end_date: project.end_date ?? "",
    description: project.description ?? "",
    risk_note: project.risk_note ?? "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: () =>
      projectsApi.update(project.id, {
        name: form.name.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        description: form.description.trim() || null,
        risk_note: form.risk_note.trim() || null,
      }),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  return (
    <DetailsDrawer
      open
      title={`Edit ${project.human_id}`}
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      }
    >
      <div className={admin.form}>
        <ErrorBar message={save.error ? errorMessage(save.error) : null} />
        <Field label="Name" required>
          <Input value={form.name} onChange={(_, d) => set("name", d.value)} />
        </Field>
        <Field label="Start date">
          <Input type="date" value={form.start_date} onChange={(_, d) => set("start_date", d.value)} />
        </Field>
        <Field label="End date">
          <Input type="date" value={form.end_date} onChange={(_, d) => set("end_date", d.value)} />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(_, d) => set("description", d.value)} />
        </Field>
        <Field label="Risk note">
          <Textarea value={form.risk_note} onChange={(_, d) => set("risk_note", d.value)} />
        </Field>
      </div>
    </DetailsDrawer>
  );
}
