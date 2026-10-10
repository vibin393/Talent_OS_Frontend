"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Subtitle2,
  Tab,
  TabList,
  type TableColumnDefinition,
  type TableRowId,
  Tag,
  Text,
  Title2,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import {
  Add20Regular,
  Archive20Regular,
  ArrowClockwise20Regular,
  ArrowLeft20Regular,
  Delete16Regular,
  Edit20Regular,
  PeopleAdd20Regular,
} from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { CandidatePicker } from "@/features/privacy/candidate-picker";
import { segmentKeys, segmentsApi } from "@/features/segments/api";
import { definitionStats, definitionToTree, SOURCE_LABELS as SEGMENT_SOURCE_LABELS, treeToDefinition } from "@/features/segments/logic";
import { SegmentBuilder } from "@/features/segments/segment-builder";
import type { Definition } from "@/features/segments/types";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { poolKeys, poolsApi } from "./api";
import {
  canEditMembers,
  CONSENT_COLORS,
  CONSENT_LABELS,
  diffText,
  reasonTags,
  REFRESH_STATUS,
  refreshErrorMessage,
  TRIGGER_LABELS,
  VISIBILITY_LABELS,
} from "./logic";
import { AddToPipelineDialog, EditPoolDialog } from "./pool-dialogs";
import { PoolKindBadge, SubscribeSwitch } from "./pools-view";
import type { PoolMember, PoolOut, RefreshOut } from "./types";
import { useInvalidatePools, usePool } from "./use-pools";

const PAGE_SIZE = 50;

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalS },
  meta: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  grow: { flex: 1 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  tabs: { marginBottom: tokens.spacingVerticalL, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  tags: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS, paddingBlock: tokens.spacingVerticalXS },
  consent: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, alignItems: "flex-start" },
  muted: { color: tokens.colorNeutralForeground3 },
  num: { fontVariantNumeric: "tabular-nums" },
  bar: { marginBottom: tokens.spacingVerticalM },
  addRow: { display: "flex", alignItems: "flex-end", gap: tokens.spacingHorizontalS, flexWrap: "wrap", flex: "1 1 360px" },
  defActions: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center", marginTop: tokens.spacingVerticalM },
});

type PoolTab = "members" | "definition" | "history";

/** `/talent-pools/[id]`: header (Refresh / Edit / Archive) and the Members / Definition / History tabs. */
export function PoolDetail({ poolId }: { poolId: string }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const canRead = usePermission("pool:read");
  const invalidate = useInvalidatePools();
  const query = usePool(poolId, canRead);
  const [tab, setTab] = useState<PoolTab>("members");
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const refresh = useMutation({
    mutationFn: () => poolsApi.refresh(poolId),
    onSuccess: () => toast.info("Refresh started."),
    onError: (e) => toast.error(refreshErrorMessage(e) ?? errorMessage(e, "Could not start a refresh.")),
    onSettled: () => invalidate(),
  });

  if (!canRead) return <NoAccess what="talent pools" />;
  const back = (
    <div className={styles.back}>
      <AppLink href="/talent-pools">
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Talent Pools
      </AppLink>
    </div>
  );
  if (query.isPending) {
    return (
      <>
        {back}
        <GridSkeleton rows={6} />
      </>
    );
  }
  if (query.isError) {
    return (
      <>
        {back}
        {isApiError(query.error) && query.error.status === 404 ? (
          <Card style={{ maxWidth: 560 }}>
            <CardHeader
              header={<Subtitle2 as="h1">Pool not found</Subtitle2>}
              description={<Body1>This pool does not exist or you do not have access to it.</Body1>}
            />
          </Card>
        ) : (
          <ErrorBar title="Could not load this pool." message={errorMessage(query.error)} />
        )}
      </>
    );
  }

  const pool = query.data;
  const archived = pool.status === "archived";
  const dynamic = pool.kind === "dynamic";
  const current: PoolTab = !dynamic && tab !== "members" ? "members" : tab;
  return (
    <>
      {back}
      <div className={styles.header}>
        <Title2 as="h1">{pool.name}</Title2>
        <PoolKindBadge kind={pool.kind} />
        {archived && (
          <Badge appearance="outline" color="subtle">
            Archived
          </Badge>
        )}
        <span className={styles.grow} />
        <div className={styles.actions}>
          {dynamic && pool.can_edit && !archived && (
            <Button
              icon={refresh.isPending ? <Spinner size="tiny" /> : <ArrowClockwise20Regular />}
              disabled={refresh.isPending || pool.needs_repair}
              onClick={() => refresh.mutate()}
            >
              Refresh
            </Button>
          )}
          {pool.can_edit && !archived && (
            <Button icon={<Edit20Regular />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {pool.can_edit && !archived && (
            <Button icon={<Archive20Regular />} onClick={() => setArchiving(true)}>
              Archive
            </Button>
          )}
        </div>
      </div>
      <div className={styles.meta}>
        <Text>
          <span className={styles.num}>{pool.member_count.toLocaleString()}</span> members
        </Text>
        <Text className={styles.muted}>{VISIBILITY_LABELS[pool.visibility]}</Text>
        {pool.owner_name && <Text className={styles.muted}>Owner: {pool.owner_name}</Text>}
        {dynamic && (
          <Text className={styles.muted}>
            Last refresh: {pool.last_refreshed_at ? `${formatDateTime(pool.last_refreshed_at)} (${diffText(pool.last_diff)})` : "not yet"}
          </Text>
        )}
        {pool.template_key && (
          <Badge appearance="tint" color="informative">
            Template
          </Badge>
        )}
        <SubscribeSwitch pool={pool} label="Daily digest" />
      </div>
      {pool.description && <Body1 className={styles.bar}>{pool.description}</Body1>}
      {pool.needs_repair && (
        <MessageBar intent="warning" className={styles.bar}>
          <MessageBarBody>
            <MessageBarTitle>The segment needs repair</MessageBarTitle>
            A field it uses is no longer available, so refreshes are skipped. Fix it on the Definition tab.
          </MessageBarBody>
        </MessageBar>
      )}

      <TabList className={styles.tabs} selectedValue={current} onTabSelect={(_, d) => setTab(d.value as PoolTab)} aria-label="Pool sections">
        <Tab value="members">Members</Tab>
        {dynamic && <Tab value="definition">Definition</Tab>}
        {dynamic && <Tab value="history">History</Tab>}
      </TabList>
      {current === "members" && <MembersTab pool={pool} />}
      {current === "definition" && pool.segment_id && <DefinitionTab pool={pool} segmentId={pool.segment_id} />}
      {current === "history" && <HistoryTab poolId={pool.id} />}

      {editing && <EditPoolDialog pool={pool} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={archiving}
        title="Archive pool?"
        confirmLabel="Archive"
        onClose={() => setArchiving(false)}
        onConfirm={async () => {
          try {
            await poolsApi.archive(pool.id);
            toast.success("Pool archived.");
            await invalidate();
            router.push("/talent-pools");
          } catch (e) {
            toast.error(errorMessage(e, "Could not archive the pool."));
            throw e;
          }
        }}
      >
        {pool.name} will no longer refresh and is hidden from the pool list. Its members are kept.
      </ConfirmDialog>
    </>
  );
}

function MembersTab({ pool }: { pool: PoolOut }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const invalidate = useInvalidatePools();
  const canPipeline = usePermission("application:create");
  const editable = canEditMembers(pool);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<TableRowId>>(new Set());
  const [pipeline, setPipeline] = useState(false);
  const [adding, setAdding] = useState<{ id: string; label: string } | null>(null);
  const members = useQuery({
    queryKey: poolKeys.members(pool.id, page),
    queryFn: ({ signal }) => poolsApi.members(pool.id, page, PAGE_SIZE, signal),
    placeholderData: (prev) => prev,
  });
  const remove = useMutation({
    mutationFn: (candidateId: string) => poolsApi.removeMember(pool.id, candidateId),
    onSuccess: () => toast.success("Removed from the pool."),
    onError: (e) => toast.error(errorMessage(e, "Could not remove the member.")),
    onSettled: () => invalidate(),
  });
  const add = useMutation({
    mutationFn: (candidateId: string) => poolsApi.addMembers(pool.id, [candidateId]),
    onSuccess: (r) => {
      toast.success(r.added ? "Added to the pool." : "Already in the pool.");
      setAdding(null);
    },
    onError: (e) => toast.error(errorMessage(e, "Could not add the candidate.")),
    onSettled: () => invalidate(),
  });

  const columns: TableColumnDefinition<PoolMember>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Candidate",
      renderCell: (m) => (
        <span className={admin.cellStack}>
          <AppLink href={`/candidates/${m.candidate_id}`}>{m.full_name}</AppLink>
          {m.current_title && <Caption1 className={styles.muted}>{m.current_title}</Caption1>}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "reason",
      renderHeaderCell: () => "Why",
      renderCell: (m) => (
        <span className={styles.tags}>
          {reasonTags(m.reason, m.source).map((t) => (
            <Tag key={t} size="extra-small" appearance="outline">
              {t}
            </Tag>
          ))}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "consent",
      renderHeaderCell: () => "Consent",
      renderCell: (m) => (
        <span className={styles.consent}>
          <Tooltip content="Marketing consent (display only)" relationship="label">
            <Badge size="small" appearance="tint" color={CONSENT_COLORS[m.consent_marketing]}>
              Marketing: {CONSENT_LABELS[m.consent_marketing]}
            </Badge>
          </Tooltip>
          <Tooltip content="Engagement consent (display only)" relationship="label">
            <Badge size="small" appearance="tint" color={CONSENT_COLORS[m.consent_engagement]}>
              Engagement: {CONSENT_LABELS[m.consent_engagement]}
            </Badge>
          </Tooltip>
        </span>
      ),
    }),
    createTableColumn({ columnId: "added", renderHeaderCell: () => "Added", renderCell: (m) => formatDateTime(m.added_at) }),
    ...(editable
      ? [
          createTableColumn<PoolMember>({
            columnId: "remove",
            renderHeaderCell: () => "",
            renderCell: (m) => (
              <Button
                size="small"
                appearance="subtle"
                icon={<Delete16Regular />}
                aria-label={`Remove ${m.full_name}`}
                disabled={remove.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  remove.mutate(m.candidate_id);
                }}
              >
                Remove
              </Button>
            ),
          }),
        ]
      : []),
  ];

  if (members.isPending) return <GridSkeleton rows={6} />;
  if (members.isError) return <ErrorBar title="Could not load members." message={errorMessage(members.error)} />;
  const data = members.data;
  const selectedIds = [...selected].map(String);
  return (
    <>
      <div className={admin.toolbar}>
        {editable && (
          <div className={styles.addRow}>
            <CandidatePicker label="Add a candidate" value={adding?.id ?? null} valueLabel={adding?.label} onChange={(id, c) => setAdding(id && c ? { id, label: c.full_name } : null)} />
            <Button icon={<Add20Regular />} disabled={!adding || add.isPending} onClick={() => adding && add.mutate(adding.id)}>
              Add
            </Button>
          </div>
        )}
        <span className={admin.grow} />
        {canPipeline && (
          <Button appearance="primary" icon={<PeopleAdd20Regular />} disabled={selectedIds.length === 0} onClick={() => setPipeline(true)}>
            Add to pipeline{selectedIds.length ? ` (${selectedIds.length})` : ""}
          </Button>
        )}
      </div>
      <div className={admin.surface}>
        <DataGrid
          items={data.items}
          columns={columns}
          getRowId={(m) => m.candidate_id}
          aria-label="Pool members"
          className={admin.grid}
          selectionMode={canPipeline ? "multiselect" : undefined}
          selectedItems={selected}
          onSelectionChange={(_, d) => setSelected(new Set(d.selectedItems))}
          focusMode="composite"
        >
          <DataGridHeader>
            <DataGridRow selectionCell={{ checkboxIndicator: { "aria-label": "Select all members" } }}>
              {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
            </DataGridRow>
          </DataGridHeader>
          <DataGridBody<PoolMember>>
            {({ item, rowId }) => (
              <DataGridRow<PoolMember> key={rowId} selectionCell={{ checkboxIndicator: { "aria-label": `Select ${item.full_name}` } }}>
                {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
              </DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
        {data.items.length === 0 && (
          <div className={admin.empty}>{pool.kind === "dynamic" ? "No candidates match this pool's segment yet." : "No members yet."}</div>
        )}
        <PagingBar
          page={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          busy={members.isFetching}
          onPageChange={(p) => {
            setPage(p);
            setSelected(new Set());
          }}
        />
      </div>
      {pipeline && (
        <AddToPipelineDialog
          poolId={pool.id}
          candidateIds={selectedIds}
          onClose={() => {
            setPipeline(false);
            void qc.invalidateQueries({ queryKey: ["pipeline"] });
          }}
        />
      )}
    </>
  );
}

function DefinitionTab({ pool, segmentId }: { pool: PoolOut; segmentId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const invalidate = useInvalidatePools();
  const canSegment = usePermission("segment:write");
  const segment = useQuery({ queryKey: segmentKeys.detail(segmentId), queryFn: ({ signal }) => segmentsApi.get(segmentId, signal) });
  const [draft, setDraft] = useState<Definition | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const save = useMutation({
    mutationFn: (definition: Definition) => segmentsApi.update(segmentId, { definition }),
    onSuccess: async (s) => {
      toast.success(`Segment saved as version ${s.definition_version}. Refresh the pool to apply it.`);
      qc.setQueryData(segmentKeys.detail(segmentId), s);
      setDraft(null);
      await invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Could not save the segment.")),
  });
  if (segment.isPending) return <GridSkeleton rows={4} />;
  if (segment.isError) return <ErrorBar title="Could not load the segment." message={errorMessage(segment.error)} />;
  const s = segment.data;
  const editable = canSegment && pool.can_edit && pool.status === "active";
  const baseline = JSON.stringify(treeToDefinition(definitionToTree(s.definition)));
  const dirty = draft !== null && JSON.stringify(draft) !== baseline;
  const stats = definitionStats(draft ?? s.definition);
  return (
    <>
      <div className={styles.meta}>
        <Text weight="semibold">{s.name}</Text>
        <Text className={styles.muted}>{SEGMENT_SOURCE_LABELS[s.source_key] ?? s.source_key}</Text>
        <Text className={styles.muted}>Version {s.definition_version}</Text>
        <Text className={styles.muted}>{stats.conditions} conditions</Text>
      </div>
      {s.needs_repair && s.repair_issues.length > 0 && (
        <MessageBar intent="warning" className={styles.bar}>
          <MessageBarBody>
            <MessageBarTitle>Needs repair</MessageBarTitle>
            {s.repair_issues.map((i) => `${i.message}${i.path ? ` (${i.path})` : ""}`).join("; ")}
          </MessageBarBody>
        </MessageBar>
      )}
      <SegmentBuilder
        key={`${s.id}:${s.definition_version}:${resetKey}`}
        sourceKey={s.source_key}
        initial={s.definition}
        disabled={!editable || save.isPending}
        onChange={setDraft}
      />
      {editable && (
        <div className={styles.defActions}>
          <Button
            appearance="primary"
            disabled={!dirty || save.isPending || !draft?.filters}
            icon={save.isPending ? <Spinner size="tiny" /> : undefined}
            onClick={() => draft && save.mutate(draft)}
          >
            Save segment
          </Button>
          <Button
            disabled={!dirty || save.isPending}
            onClick={() => {
              setDraft(null);
              setResetKey((k) => k + 1);
            }}
          >
            Discard changes
          </Button>
          {!draft?.filters && dirty && <Caption1 className={styles.muted}>Add at least one condition.</Caption1>}
        </div>
      )}
    </>
  );
}

function HistoryTab({ poolId }: { poolId: string }) {
  const styles = useStyles();
  const refreshes = useQuery({
    queryKey: poolKeys.refreshes(poolId),
    queryFn: ({ signal }) => poolsApi.refreshes(poolId, signal),
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "running") ? 5000 : false),
  });
  const columns: TableColumnDefinition<RefreshOut>[] = [
    createTableColumn({ columnId: "started", renderHeaderCell: () => "Started", renderCell: (r) => formatDateTime(r.started_at) }),
    createTableColumn({ columnId: "trigger", renderHeaderCell: () => "Trigger", renderCell: (r) => TRIGGER_LABELS[r.trigger] ?? r.trigger }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => {
        const s = REFRESH_STATUS[r.status] ?? { label: r.status, color: "subtle" as const };
        return (
          <Badge appearance="tint" color={s.color}>
            {s.label}
            {r.error_code ? ` (${r.error_code})` : ""}
          </Badge>
        );
      },
    }),
    createTableColumn({
      columnId: "diff",
      renderHeaderCell: () => "Change",
      renderCell: (r) => <Text className={styles.num}>{r.status === "done" ? diffText(r) : "—"}</Text>,
    }),
    createTableColumn({
      columnId: "evaluated",
      renderHeaderCell: () => "Matched",
      renderCell: (r) => <Text className={styles.num}>{r.evaluated?.toLocaleString() ?? "—"}</Text>,
    }),
    createTableColumn({
      columnId: "duration",
      renderHeaderCell: () => "Duration",
      renderCell: (r) => (r.duration_ms === null ? "—" : `${(r.duration_ms / 1000).toFixed(1)} s`),
    }),
  ];
  return (
    <>
      <AdminGrid
        items={refreshes.data}
        columns={columns}
        getRowId={(r) => r.id}
        loading={refreshes.isPending}
        error={refreshes.error}
        emptyText="This pool has not been refreshed yet."
        label="Refresh history"
      />
      <Caption1 className={styles.muted}>
        Dynamic pools refresh nightly, when the skill graph changes, and on demand.
      </Caption1>
    </>
  );
}
