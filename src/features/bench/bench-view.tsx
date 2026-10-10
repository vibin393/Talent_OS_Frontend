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
  mergeClasses,
  Option,
  SearchBox,
  Spinner,
  Subtitle2,
  type TableColumnDefinition,
  Tag,
  TagGroup,
  Text,
  Textarea,
  Toolbar,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, DataBarVertical20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, IdSelect, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { candidatesApi } from "@/features/candidates/api";
import { EMPTY_CANDIDATE_FILTERS } from "@/features/candidates/query";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { BenchFilters } from "./api";
import {
  BENCH_STATUS_COLORS,
  BENCH_STATUS_LABELS,
  benchColumnIds,
  costText,
  formatDate,
  formatDecimal,
  isMoney,
  RELEASE_REASONS,
  releaseValid,
  todayIso,
} from "./format";
import type { BenchEntryOut, BenchStatus, ReleaseReason } from "./types";
import { useBenchEntries, useBenchEntry, useBenchEntryMutations } from "./use-bench-entries";

const useStyles = makeStyles({
  toolbar: { flexWrap: "wrap", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM, paddingInline: 0 },
  tags: { flexWrap: "wrap" },
  section: { marginTop: tokens.spacingVerticalL },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end", flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
});

const STATUSES = Object.keys(BENCH_STATUS_LABELS) as BenchStatus[];
const OPEN: BenchStatus[] = ["on_bench", "proposed"];

/** Release dialog: a reason is required; "Other" also needs a note. */
export function ReleaseDialog({
  open,
  name,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  name: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: ReleaseReason, note: string | null) => void;
}) {
  const admin = useAdminStyles();
  const [reason, setReason] = useState<ReleaseReason | "">("");
  const [note, setNote] = useState("");
  const valid = releaseValid(reason, note);
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Release {name} from the bench?</DialogTitle>
          <DialogContent>
            <div className={admin.form}>
              <Field label="Reason" required>
                <Dropdown
                  aria-label="Reason"
                  placeholder="Choose a reason"
                  value={RELEASE_REASONS.find((r) => r.value === reason)?.label ?? ""}
                  selectedOptions={reason ? [reason] : []}
                  onOptionSelect={(_, d) => setReason((d.optionValue ?? "") as ReleaseReason)}
                >
                  {RELEASE_REASONS.map((r) => (
                    <Option key={r.value} value={r.value}>
                      {r.label}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field
                label="Note"
                required={reason === "other"}
                validationMessage={reason === "other" && !note.trim() ? "A note is required for “Other”" : undefined}
              >
                <Textarea aria-label="Note" value={note} maxLength={2000} resize="vertical" onChange={(_, d) => setNote(d.value)} />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!valid || busy}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={() => reason && onConfirm(reason, note.trim() || null)}
            >
              Release
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function AddDialog({ onClose }: { onClose: () => void }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const { create } = useBenchEntryMutations();
  const [q, setQ] = useState("");
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [from, setFrom] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const candidates = useQuery({
    queryKey: ["candidates", "bench-picker", q],
    queryFn: ({ signal }) => candidatesApi.list({ ...EMPTY_CANDIDATE_FILTERS, q }, 1, 25, signal),
  });
  const conflict = isApiError(create.error) && create.error.code === "bench_entry_open";
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Add to bench</DialogTitle>
          <DialogContent>
            <div className={admin.form}>
              <ErrorBar
                message={
                  conflict ? "This worker already has an open bench entry." : create.isError ? errorMessage(create.error) : null
                }
              />
              <Field label="Find worker">
                <SearchBox value={q} placeholder="Search candidates by name" onChange={(_, d) => setQ(d.value)} />
              </Field>
              <IdSelect
                label="Worker"
                options={(candidates.data?.items ?? []).map((c) => ({ id: c.id, label: c.full_name }))}
                value={candidateId}
                onChange={setCandidateId}
              />
              <Field label="Available from" required>
                <Input type="date" value={from} onChange={(_, d) => setFrom(d.value)} />
              </Field>
              <Field label="Notes">
                <Textarea value={notes} maxLength={5000} onChange={(_, d) => setNotes(d.value)} />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={!candidateId || !from || create.isPending}
              onClick={() =>
                candidateId &&
                create.mutate(
                  { candidate_id: candidateId, available_from: from, notes: notes.trim() || null },
                  {
                    onSuccess: () => {
                      toast.success("Added to the bench.");
                      onClose();
                    },
                  },
                )
              }
            >
              Add
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function EntryDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const toast = useAppToast();
  const canWrite = usePermission("bench:write");
  const canEditCost = usePermission("bench:edit_cost");
  const entry = useBenchEntry(id);
  const m = useBenchEntryMutations();
  const [notes, setNotes] = useState<string | null>(null);
  const [cost, setCost] = useState("");
  const [releasing, setReleasing] = useState(false);
  const e = entry.data;
  const open = e ? OPEN.includes(e.status) : false;
  return (
    <DetailsDrawer open title={e?.candidate_name ?? "Bench entry"} onClose={onClose} size="medium">
      {entry.isPending && <Spinner label="Loading" />}
      {entry.isError && <ErrorBar message={errorMessage(entry.error)} />}
      {e && (
        <div className={admin.form}>
          <Badge appearance="tint" color={BENCH_STATUS_COLORS[e.status]}>
            {BENCH_STATUS_LABELS[e.status]}
          </Badge>
          <dl className={admin.detailList}>
            <dt>Available from</dt>
            <dd>{formatDate(e.available_from)}</dd>
            <dt>Bench days</dt>
            <dd>{e.bench_days}</dd>
            <dt>Location</dt>
            <dd>{[e.location?.city, e.location?.state, e.location?.country].filter(Boolean).join(", ") || "—"}</dd>
            <dt>Work authorization</dt>
            <dd>{e.work_authorization ?? "—"}</dd>
            {!e.cost_masked && (
              <>
                <dt>Cost per day</dt>
                <dd>
                  {costText(e.cost_per_day, e.cost_currency, false)}
                  {e.cost_unknown && <Text className={styles.muted}> (unknown rate unit)</Text>}
                </dd>
                <dt>Cost to date</dt>
                <dd>{costText(e.cost_to_date, e.cost_currency, false)}</dd>
                <dt>Cost basis</dt>
                <dd>{e.cost_rate_unit_basis ?? "—"}</dd>
              </>
            )}
            <dt>Proposed to</dt>
            <dd>{e.proposed_count} application(s)</dd>
            {e.released_reason && (
              <>
                <dt>Released</dt>
                <dd>
                  {RELEASE_REASONS.find((r) => r.value === e.released_reason)?.label}
                  {e.released_note ? ` — ${e.released_note}` : ""}
                </dd>
              </>
            )}
          </dl>
          <div>
            <Subtitle2 as="h3">Skills</Subtitle2>
            <TagGroup className={styles.tags} aria-label="Skills">
              {e.skills.map((s) => (
                <Tag key={`${s.skill_id ?? s.tenant_skill_id}`} size="small">
                  {s.name}
                </Tag>
              ))}
            </TagGroup>
          </div>
          {canEditCost && !e.cost_masked && open && (
            <div className={styles.row}>
              <Field label={`Override cost per day (${e.cost_currency ?? "INR"})`} validationMessage={cost && !isMoney(cost) ? "Enter an amount" : undefined}>
                <Input inputMode="decimal" value={cost} placeholder={e.cost_per_day ?? "0.00"} onChange={(_, d) => setCost(d.value)} />
              </Field>
              <Button
                disabled={!isMoney(cost) || m.overrideCost.isPending}
                onClick={() =>
                  m.overrideCost.mutate(
                    { id: e.id, cost: cost.trim(), currency: e.cost_currency ?? "INR" },
                    {
                      onSuccess: () => {
                        toast.success(`Cost set to ${formatDecimal(cost.trim(), e.cost_currency ?? "INR")} per day.`);
                        setCost("");
                      },
                      onError: (err) => toast.error(errorMessage(err, "Could not override the cost.")),
                    },
                  )
                }
              >
                Save cost
              </Button>
            </div>
          )}
          {canWrite && (
            <Field label="Notes">
              <Textarea value={notes ?? e.notes ?? ""} maxLength={5000} onChange={(_, d) => setNotes(d.value)} />
            </Field>
          )}
          {canWrite && (
            <div className={admin.footer}>
              <Button
                disabled={notes === null || m.update.isPending}
                onClick={() =>
                  m.update.mutate(
                    { id: e.id, body: { notes: notes?.trim() || null } },
                    { onSuccess: () => toast.success("Notes saved."), onError: (err) => toast.error(errorMessage(err)) },
                  )
                }
              >
                Save notes
              </Button>
              <Button
                disabled={!open || m.update.isPending}
                onClick={() => m.update.mutate({ id: e.id, body: { refresh_skills: true } })}
              >
                Refresh skills
              </Button>
              <Button appearance="primary" disabled={!open} onClick={() => setReleasing(true)}>
                Release
              </Button>
            </div>
          )}
          <ReleaseDialog
            open={releasing}
            name={e.candidate_name ?? "this worker"}
            busy={m.release.isPending}
            onClose={() => setReleasing(false)}
            onConfirm={(reason, note) =>
              m.release.mutate(
                { id: e.id, reason, note },
                {
                  onSuccess: () => {
                    toast.success("Released from the bench.");
                    setReleasing(false);
                  },
                  onError: (err) => toast.error(errorMessage(err, "Could not release.")),
                },
              )
            }
          />
        </div>
      )}
    </DetailsDrawer>
  );
}

/** `/bench`: Workers between placements (FR-125) with filters, add, details drawer, cost override and release. */
export function BenchView() {
  const admin = useAdminStyles();
  const styles = useStyles();
  const router = useRouter();
  const params = useSearchParams();
  const canRead = usePermission("bench:read");
  const canWrite = usePermission("bench:write");
  const canComp = usePermission("compensation:view");
  const initialStatus = params.getAll("status");
  const [status, setStatus] = useState<string[]>(initialStatus.length ? initialStatus : OPEN);
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const filters: BenchFilters = {
    status: status.length ? status : undefined,
    q: q.trim() || undefined,
    location: location.trim() || undefined,
    page,
    page_size: 25,
  };
  const list = useBenchEntries(filters, canRead);
  if (!canRead) return <NoAccess what="the bench" />;
  const allColumns: TableColumnDefinition<BenchEntryOut>[] = [
    createTableColumn({
      columnId: "worker",
      renderHeaderCell: () => "Worker",
      renderCell: (e) => (
        <Link as="button" onClick={() => setOpenId(e.id)}>
          {e.candidate_name ?? e.candidate_human_id ?? "—"}
        </Link>
      ),
    }),
    createTableColumn({
      columnId: "skills",
      renderHeaderCell: () => "Skills",
      renderCell: (e) => (
        <TagGroup className={styles.tags} aria-label="Skills">
          {e.skills.slice(0, 4).map((s) => (
            <Tag key={`${s.skill_id ?? s.tenant_skill_id}`} size="extra-small">
              {s.name}
            </Tag>
          ))}
        </TagGroup>
      ),
    }),
    createTableColumn({
      columnId: "location",
      renderHeaderCell: () => "Location",
      renderCell: (e) => e.location?.city ?? e.location?.country ?? "—",
    }),
    createTableColumn({ columnId: "from", renderHeaderCell: () => "Available from", renderCell: (e) => formatDate(e.available_from) }),
    createTableColumn({ columnId: "days", renderHeaderCell: () => "Bench days", renderCell: (e) => e.bench_days }),
    createTableColumn({
      columnId: "cost",
      renderHeaderCell: () => "Cost/day",
      renderCell: (e) => costText(e.cost_per_day, e.cost_currency, e.cost_masked),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (e) => (
        <Badge appearance="tint" color={BENCH_STATUS_COLORS[e.status]}>
          {BENCH_STATUS_LABELS[e.status]}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "proposed", renderHeaderCell: () => "Proposed", renderCell: (e) => e.proposed_count }),
  ];
  const visible = benchColumnIds(canComp);
  const columns = allColumns.filter((c) => visible.includes(String(c.columnId)));
  return (
    <>
      <PageHeader title="Bench" subtitle="Workers between placements — the fastest supply for open demands" />
      <Toolbar className={mergeClasses(styles.toolbar)} aria-label="Bench filters">
        <SearchBox
          aria-label="Search"
          className={admin.search}
          value={q}
          placeholder="Worker name or id"
          onChange={(_, d) => {
            setQ(d.value);
            setPage(1);
          }}
        />
        <Field label="Status" className={admin.filter}>
          <Dropdown
            multiselect
            placeholder="Any"
            selectedOptions={status}
            value={status.map((s) => BENCH_STATUS_LABELS[s as BenchStatus]).join(", ")}
            onOptionSelect={(_, d) => {
              setStatus(d.selectedOptions);
              setPage(1);
            }}
          >
            {STATUSES.map((s) => (
              <Option key={s} value={s}>
                {BENCH_STATUS_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Location" className={admin.filter}>
          <Input
            value={location}
            placeholder="City, state or country"
            onChange={(_, d) => {
              setLocation(d.value);
              setPage(1);
            }}
          />
        </Field>
        <span className={admin.grow} />
        <Button appearance="secondary" icon={<DataBarVertical20Regular />} onClick={() => router.push("/bench/dashboard")}>
          Dashboard
        </Button>
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setAdding(true)}>
            Add to bench
          </Button>
        )}
      </Toolbar>
      <AdminGrid
        items={list.data?.items}
        columns={columns}
        getRowId={(e) => e.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No one is on the bench with these filters."
        label="Bench"
        onRowClick={(e) => setOpenId(e.id)}
      />
      {list.data && <PagingBar page={page} pageSize={list.data.page_size} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />}
      {adding && <AddDialog onClose={() => setAdding(false)} />}
      {openId && <EntryDrawer key={openId} id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
