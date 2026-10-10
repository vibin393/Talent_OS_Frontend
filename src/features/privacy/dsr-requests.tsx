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
  Option,
  Spinner,
  Switch,
  type TableColumnDefinition,
  Textarea,
  Toolbar,
  ToolbarButton,
} from "@fluentui/react-components";
import { Add20Regular, ArrowClockwise20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ErrorBar, formatDateTime, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { DsrChannel, DsrCreate, DsrKind, DsrOut, DsrStatus } from "@/lib/api/types";
import { fieldErrors } from "@/lib/api/errors";
import { type DsrFilters, EMPTY_DSR_FILTERS, privacyApi, privacyErrorMessage, privacyKeys } from "./api";
import { CandidatePicker } from "./candidate-picker";
import { DSR_SUBJECT_KIND_LABELS } from "./retention-classes/format";
import type { DsrSubjectKind } from "./retention-classes/types";
import { useUserNames } from "./use-user-names";
import {
  DSR_CHANNEL_LABELS,
  DSR_KIND_LABELS,
  DSR_STATUS_COLORS,
  DSR_STATUS_LABELS,
  dsrDueBadge,
} from "./format";

const KINDS = Object.keys(DSR_KIND_LABELS) as DsrKind[];
const STATUSES = Object.keys(DSR_STATUS_LABELS) as DsrStatus[];
const CHANNELS = (Object.keys(DSR_CHANNEL_LABELS) as DsrChannel[]).filter((c) => c !== "candidate_portal");

export function DsrDueCell({ dsr }: { dsr: DsrOut }) {
  const badge = dsrDueBadge(dsr);
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {new Date(dsr.due_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
      {badge && (
        <Badge appearance="filled" color={badge.color} size="small">
          {badge.label}
        </Badge>
      )}
    </span>
  );
}

function subjectOf(d: DsrOut): string {
  return d.requester_name || d.requester_email || d.candidate_human_id || "—";
}

function dsrColumns(userName: (id: string | null) => string | null): TableColumnDefinition<DsrOut>[] {
  return [
  createTableColumn<DsrOut>({
    columnId: "id",
    compare: (a, b) => a.human_id.localeCompare(b.human_id),
    renderHeaderCell: () => "ID",
    renderCell: (d) => <AppLink href={`/admin/privacy/requests/${d.id}`}>{d.human_id}</AppLink>,
  }),
  createTableColumn<DsrOut>({
    columnId: "kind",
    compare: (a, b) => a.kind.localeCompare(b.kind),
    renderHeaderCell: () => "Kind",
    renderCell: (d) => DSR_KIND_LABELS[d.kind],
  }),
  createTableColumn<DsrOut>({
    columnId: "subject",
    compare: (a, b) => subjectOf(a).localeCompare(subjectOf(b)),
    renderHeaderCell: () => "Subject",
    renderCell: (d) => (
      <span>
        {subjectOf(d)}
        {d.candidate_human_id && d.requester_name ? ` · ${d.candidate_human_id}` : ""}
      </span>
    ),
  }),
  createTableColumn<DsrOut>({
    columnId: "received",
    compare: (a, b) => a.received_at.localeCompare(b.received_at),
    renderHeaderCell: () => "Received",
    renderCell: (d) => formatDateTime(d.received_at),
  }),
  createTableColumn<DsrOut>({
    columnId: "due",
    compare: (a, b) => a.due_at.localeCompare(b.due_at),
    renderHeaderCell: () => "Due",
    renderCell: (d) => <DsrDueCell dsr={d} />,
  }),
  createTableColumn<DsrOut>({
    columnId: "status",
    compare: (a, b) => a.status.localeCompare(b.status),
    renderHeaderCell: () => "Status",
    renderCell: (d) => (
      <Badge appearance="tint" color={DSR_STATUS_COLORS[d.status]}>
        {DSR_STATUS_LABELS[d.status]}
      </Badge>
    ),
  }),
  createTableColumn<DsrOut>({
    columnId: "assignee",
    renderHeaderCell: () => "Assignee",
    renderCell: (d) => (d.assigned_to ? (userName(d.assigned_to) ?? "Assigned") : "Unassigned"),
  }),
  ];
}

/** Requests tab: DSR grid with filters and "New request". */
export function DsrRequestsTab() {
  const styles = useAdminStyles();
  const canProcess = usePermission("dsr:process");
  const [filters, setFilters] = useState<DsrFilters>(EMPTY_DSR_FILTERS);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const userName = useUserNames();
  const columns = dsrColumns(userName);
  const list = useQuery({
    queryKey: privacyKeys.dsrList(filters, page, DEFAULT_PAGE_SIZE),
    queryFn: ({ signal }) => privacyApi.dsrs(filters, page, DEFAULT_PAGE_SIZE, signal),
    placeholderData: (prev) => prev,
  });
  const update = (patch: Partial<DsrFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  return (
    <>
      <Toolbar aria-label="Requests commands" className={styles.toolbar}>
        {canProcess && (
          <ToolbarButton appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New request
          </ToolbarButton>
        )}
        <ToolbarButton icon={<ArrowClockwise20Regular />} onClick={() => list.refetch()}>
          Refresh
        </ToolbarButton>
      </Toolbar>
      <div className={styles.toolbar}>
        <Field label="Status" className={styles.filter}>
          <Dropdown
            value={filters.status ? DSR_STATUS_LABELS[filters.status] : "All"}
            selectedOptions={[filters.status ?? "all"]}
            onOptionSelect={(_, d) => update({ status: d.optionValue === "all" ? null : (d.optionValue as DsrStatus) })}
          >
            <Option value="all">All</Option>
            {STATUSES.map((s) => (
              <Option key={s} value={s}>
                {DSR_STATUS_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Kind" className={styles.filter}>
          <Dropdown
            value={filters.kind ? DSR_KIND_LABELS[filters.kind] : "All"}
            selectedOptions={[filters.kind ?? "all"]}
            onOptionSelect={(_, d) => update({ kind: d.optionValue === "all" ? null : (d.optionValue as DsrKind) })}
          >
            <Option value="all">All</Option>
            {KINDS.map((k) => (
              <Option key={k} value={k}>
                {DSR_KIND_LABELS[k]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Switch label="Overdue only" checked={filters.overdue} onChange={(_, d) => update({ overdue: d.checked })} />
      </div>
      <AdminGrid
        items={list.data?.items}
        columns={columns}
        getRowId={(d) => d.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No data subject requests match these filters."
        label="Data subject requests"
        sortable
        footer={
          list.data && (
            <PagingBar
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={list.data.total}
              onPageChange={setPage}
              busy={list.isFetching}
            />
          )
        }
      />
      <NewDsrDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

const SUBJECT_KINDS = Object.keys(DSR_SUBJECT_KIND_LABELS) as DsrSubjectKind[];

/** The create body with the Epic 35 subject fields (not yet in the generated `DsrCreate`). */
function dsrCreateBody(body: DsrCreate & { subject_kind: DsrSubjectKind; subject_id: string | null }): DsrCreate {
  return body;
}

function NewDsrDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<DsrKind>("access");
  const [channel, setChannel] = useState<DsrChannel>("email");
  const [candidate, setCandidate] = useState<{ id: string; label: string } | null>(null);
  const [subjectKind, setSubjectKind] = useState<DsrSubjectKind>("candidate");
  const [subjectId, setSubjectId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () =>
      privacyApi.createDsr(
        dsrCreateBody({
          kind,
          channel,
          candidate_id: subjectKind === "candidate" ? (candidate?.id ?? null) : null,
          requester_name: name.trim() || null,
          requester_email: email.trim() || null,
          details: notes.trim() ? { notes: notes.trim() } : {},
          subject_kind: subjectKind,
          subject_id: subjectKind === "candidate" ? (candidate?.id ?? null) : subjectId.trim() || null,
        }),
      ),
    onSuccess: async (dsr) => {
      toast.success(`Request ${dsr.human_id} created`);
      await queryClient.invalidateQueries({ queryKey: privacyKeys.dsrs });
      reset();
      onClose();
      router.push(`/admin/privacy/requests/${dsr.id}`);
    },
    onError: (e) => {
      setFields(fieldErrors(e));
      setError(privacyErrorMessage(e));
    },
  });
  const reset = () => {
    setKind("access");
    setChannel("email");
    setCandidate(null);
    setSubjectKind("candidate");
    setSubjectId("");
    setName("");
    setEmail("");
    setNotes("");
    setError(null);
    setFields({});
  };
  const valid = !!candidate || !!subjectId.trim() || !!name.trim() || !!email.trim();
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && !create.isPending && (reset(), onClose())}>
      <DialogSurface>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) create.mutate();
          }}
        >
          <DialogBody>
            <DialogTitle>New data subject request</DialogTitle>
            <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ErrorBar message={error} />
              <Field label="Kind" required>
                <Dropdown
                  value={DSR_KIND_LABELS[kind]}
                  selectedOptions={[kind]}
                  onOptionSelect={(_, d) => d.optionValue && setKind(d.optionValue as DsrKind)}
                >
                  {KINDS.map((k) => (
                    <Option key={k} value={k}>
                      {DSR_KIND_LABELS[k]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Received by">
                <Dropdown
                  value={DSR_CHANNEL_LABELS[channel]}
                  selectedOptions={[channel]}
                  onOptionSelect={(_, d) => d.optionValue && setChannel(d.optionValue as DsrChannel)}
                >
                  {CHANNELS.map((c) => (
                    <Option key={c} value={c}>
                      {DSR_CHANNEL_LABELS[c]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Data subject" hint="Who the request is about.">
                <Dropdown
                  value={DSR_SUBJECT_KIND_LABELS[subjectKind]}
                  selectedOptions={[subjectKind]}
                  onOptionSelect={(_, d) => d.optionValue && setSubjectKind(d.optionValue as DsrSubjectKind)}
                >
                  {SUBJECT_KINDS.map((k) => (
                    <Option key={k} value={k}>
                      {DSR_SUBJECT_KIND_LABELS[k]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              {subjectKind !== "candidate" && (
                <Field
                  label={`${DSR_SUBJECT_KIND_LABELS[subjectKind]} id`}
                  hint="Optional. Paste the record's id from its page; you can also link it later."
                  validationMessage={fields.subject_id}
                  validationState={fields.subject_id ? "error" : "none"}
                >
                  <Input value={subjectId} onChange={(_, d) => setSubjectId(d.value)} maxLength={64} />
                </Field>
              )}
              {subjectKind === "candidate" && <CandidatePicker
                label="Candidate"
                hint="Link the request to the candidate it concerns. You can also do this later."
                value={candidate?.id ?? null}
                valueLabel={candidate?.label}
                validationMessage={fields.candidate_id}
                onChange={(id, c) => setCandidate(id && c ? { id, label: `${c.full_name} (${c.human_id})` } : null)}
              />}
              <Field label="Requester name" validationMessage={fields.requester_name} validationState={fields.requester_name ? "error" : "none"}>
                <Input value={name} onChange={(_, d) => setName(d.value)} maxLength={200} />
              </Field>
              <Field label="Requester email" validationMessage={fields.requester_email} validationState={fields.requester_email ? "error" : "none"}>
                <Input type="email" value={email} onChange={(_, d) => setEmail(d.value)} maxLength={254} />
              </Field>
              <Field label="Details">
                <Textarea value={notes} onChange={(_, d) => setNotes(d.value)} rows={3} resize="vertical" maxLength={4000} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" disabled={create.isPending} onClick={() => (reset(), onClose())}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                type="submit"
                disabled={!valid || create.isPending}
                icon={create.isPending ? <Spinner size="tiny" /> : undefined}
              >
                Create request
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
