"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Link,
  makeStyles,
  Option,
  ProgressBar,
  SearchBox,
  type TableColumnDefinition,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, IdSelect, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { UserPicker } from "@/features/admin/user-picker";
import { usePermission } from "@/features/auth/use-permission";
import { clientKeys, clientsApi } from "@/features/clients/api";
import { DEFAULT_CLIENT_SORT, EMPTY_CLIENT_FILTERS } from "@/features/clients/query";
import { commercialsApi, commercialsKeys } from "@/features/commercials/api";
import { useDebounced } from "@/lib/use-debounced";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { projectsApi } from "./api";
import { burnColor, pctRatio, PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS } from "./logic";
import type { ProjectFilters, ProjectIn, ProjectListItem, ProjectOut, ProjectStatus } from "./types";
import { useProjects, useRefreshProjects } from "./use-projects";

const useStyles = makeStyles({
  burn: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, minWidth: "120px" },
  burnBar: { flex: 1 },
  num: { fontVariantNumeric: "tabular-nums" },
});

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge appearance="tint" color={PROJECT_STATUS_COLORS[status]}>
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function BurnCell({ pct }: { pct: string | null }) {
  const styles = useStyles();
  const ratio = pctRatio(pct);
  if (ratio === null) return <Text className={styles.num}>—</Text>;
  return (
    <span className={styles.burn}>
      <ProgressBar className={styles.burnBar} value={ratio} color={burnColor(pct)} thickness="large" aria-label={`Burn ${pct}%`} />
      <Text size={200} className={styles.num}>
        {Math.round(Number(pct))}%
      </Text>
    </span>
  );
}

/** Projects grid (PRJ id, name, client, SOW, owner, status, burn, risks), used by the list and Client 360. */
export function ProjectsGrid({ filters, emptyText, hideClient }: { filters: ProjectFilters; emptyText: string; hideClient?: boolean }) {
  const router = useRouter();
  const list = useProjects(filters);
  const columns: TableColumnDefinition<ProjectListItem>[] = [
    createTableColumn({
      columnId: "id",
      renderHeaderCell: () => "Project",
      renderCell: (p) => (
        <Link as="button" onClick={() => router.push(`/projects/${p.id}`)}>
          {p.human_id}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Name", renderCell: (p) => p.name }),
    ...(hideClient
      ? []
      : [createTableColumn<ProjectListItem>({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (p) => p.client_name ?? "—" })]),
    createTableColumn({ columnId: "sow", renderHeaderCell: () => "SOW", renderCell: (p) => p.contract_human_id ?? "—" }),
    createTableColumn({ columnId: "owner", renderHeaderCell: () => "Owner", renderCell: (p) => p.owner_name ?? "—" }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (p) => <ProjectStatusBadge status={p.status} /> }),
    createTableColumn({ columnId: "burn", renderHeaderCell: () => "Burn", renderCell: (p) => <BurnCell pct={p.burn_pct} /> }),
    createTableColumn({
      columnId: "risks",
      renderHeaderCell: () => "Risks",
      renderCell: (p) =>
        p.risks_count > 0 ? (
          <Badge appearance="filled" color="danger">
            {p.risks_count}
          </Badge>
        ) : (
          "—"
        ),
    }),
  ];
  return (
    <AdminGrid
      items={list.data}
      columns={columns}
      getRowId={(p) => p.id}
      loading={list.isPending}
      error={list.error}
      emptyText={emptyText}
      label="Projects"
      onRowClick={(p) => router.push(`/projects/${p.id}`)}
    />
  );
}

/** `/projects`: list with status filter / search and the create dialog (`?new=1&contract_id=` pre-opens it). */
export function ProjectsView({ openNew, contractId }: { openNew?: boolean; contractId?: string }) {
  const admin = useAdminStyles();
  const router = useRouter();
  const refresh = useRefreshProjects();
  const canRead = usePermission("project:read");
  const canWrite = usePermission("project:write");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 300);
  const [creating, setCreating] = useState(!!openNew);
  if (!canRead) return <NoAccess what="projects" />;
  const filters: ProjectFilters = { status: status || undefined, q: debouncedQ.trim() || undefined };
  return (
    <>
      <PageHeader title="Projects" subtitle="SOW delivery: staffing, deliverables, milestones and budget burn" />
      <div className={admin.toolbar}>
        <SearchBox className={admin.search} placeholder="Search projects" value={q} onChange={(_, d) => setQ(d.value)} aria-label="Search projects" />
        <Dropdown
          className={admin.filter}
          aria-label="Status"
          value={status ? PROJECT_STATUS_LABELS[status as ProjectStatus] : "All statuses"}
          selectedOptions={[status]}
          onOptionSelect={(_, d) => setStatus(d.optionValue ?? "")}
        >
          <Option value="">All statuses</Option>
          {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => (
            <Option key={s} value={s}>
              {PROJECT_STATUS_LABELS[s]}
            </Option>
          ))}
        </Dropdown>
        <span className={admin.grow} />
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New project
          </Button>
        )}
      </div>
      <ProjectsGrid filters={filters} emptyText="No projects match these filters." />
      {creating && canWrite && (
        <CreateProjectDialog
          contractId={contractId}
          onClose={() => setCreating(false)}
          onCreated={async (p) => {
            await refresh();
            router.push(`/projects/${p.id}`);
          }}
        />
      )}
    </>
  );
}

/** Client 360 "Projects" tab. */
export function ClientProjectsTab({ clientId }: { clientId: string }) {
  const admin = useAdminStyles();
  const router = useRouter();
  const refresh = useRefreshProjects();
  const canWrite = usePermission("project:write");
  const [creating, setCreating] = useState(false);
  return (
    <>
      {canWrite && (
        <div className={admin.toolbar}>
          <span className={admin.grow} />
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New project
          </Button>
        </div>
      )}
      <ProjectsGrid filters={{ client_id: clientId }} hideClient emptyText="No projects for this client yet." />
      {creating && (
        <CreateProjectDialog
          clientId={clientId}
          onClose={() => setCreating(false)}
          onCreated={async (p) => {
            await refresh();
            router.push(`/projects/${p.id}`);
          }}
        />
      )}
    </>
  );
}

const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Create-project dialog: name, client, SOW (the client's SOW contracts), owner, dates, description. */
export function CreateProjectDialog({
  clientId,
  contractId,
  onClose,
  onCreated,
}: {
  clientId?: string;
  contractId?: string;
  onClose: () => void;
  onCreated: (p: ProjectOut) => void;
}) {
  const admin = useAdminStyles();
  const canPickUser = usePermission("user:read");
  const [form, setForm] = useState<ProjectIn>({ name: "", client_id: clientId ?? "", contract_id: contractId ?? null });
  const [ownerLabel, setOwnerLabel] = useState<string | undefined>();
  const set = <K extends keyof ProjectIn>(key: K, value: ProjectIn[K]) => setForm((f) => ({ ...f, [key]: value }));
  // Opened from a SOW: take its client (and dates) once loaded.
  const sow = useQuery({
    queryKey: commercialsKeys.contract(contractId ?? ""),
    queryFn: ({ signal }) => commercialsApi.contract(contractId!, signal),
    enabled: !!contractId,
  });
  const effectiveClient = form.client_id || sow.data?.client_id || "";
  const clients = useQuery({
    queryKey: [...clientKeys.lists, "projects-picker"],
    queryFn: ({ signal }) => clientsApi.list(EMPTY_CLIENT_FILTERS, DEFAULT_CLIENT_SORT, 1, 100, signal),
    enabled: !clientId && !contractId,
  });
  const contracts = useQuery({
    queryKey: commercialsKeys.clientContracts(effectiveClient),
    queryFn: ({ signal }) => commercialsApi.clientContracts(effectiveClient, signal),
    enabled: !!effectiveClient,
  });
  const sowOptions = (contracts.data ?? [])
    .filter((c) => c.contract_type === "sow" && c.status !== "terminated")
    .map((c) => ({ id: c.id, label: `${c.human_id} · ${c.title ?? ""}` }));
  const create = useMutation({
    mutationFn: () =>
      projectsApi.create({
        ...form,
        client_id: effectiveClient,
        name: form.name.trim(),
        start_date: blank(form.start_date) ?? (contractId ? (sow.data?.start_date ?? null) : null),
        end_date: blank(form.end_date) ?? (contractId ? (sow.data?.end_date ?? null) : null),
        description: blank(form.description),
      }),
    onSuccess: onCreated,
  });
  const errors = fieldErrors(create.error);
  const valid = !!form.name.trim() && !!effectiveClient;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>New project</DialogTitle>
          <DialogContent>
            <div className={admin.form}>
              <ErrorBar message={create.error && !Object.keys(errors).length ? errorMessage(create.error) : null} />
              <Field label="Name" required validationMessage={errors.name}>
                <Input value={form.name} onChange={(_, d) => set("name", d.value)} />
              </Field>
              {!clientId && !contractId && (
                <IdSelect
                  label="Client"
                  options={(clients.data?.items ?? []).map((c) => ({ id: c.id, label: c.name }))}
                  value={form.client_id || null}
                  onChange={(v) => setForm((f) => ({ ...f, client_id: v ?? "", contract_id: null }))}
                />
              )}
              <IdSelect
                label="SOW"
                options={sowOptions}
                value={form.contract_id ?? null}
                noneLabel="No SOW yet"
                disabled={!effectiveClient}
                onChange={(v) => set("contract_id", v)}
              />
              {canPickUser && (
                <UserPicker
                  label="Owner"
                  value={form.owner_id ?? null}
                  valueLabel={ownerLabel}
                  clearLabel="No owner"
                  onChange={(id, u) => {
                    set("owner_id", id);
                    setOwnerLabel(u ? u.name || u.email : undefined);
                  }}
                />
              )}
              <Field label="Start date" validationMessage={errors.start_date}>
                <Input type="date" value={form.start_date ?? ""} onChange={(_, d) => set("start_date", d.value)} />
              </Field>
              <Field label="End date" validationMessage={errors.end_date}>
                <Input type="date" value={form.end_date ?? ""} onChange={(_, d) => set("end_date", d.value)} />
              </Field>
              <Field label="Description">
                <Textarea value={form.description ?? ""} onChange={(_, d) => set("description", d.value)} />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
              Create project
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
