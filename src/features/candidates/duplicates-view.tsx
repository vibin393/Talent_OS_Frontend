"use client";

import {
  Badge,
  Button,
  Caption1,
  createTableColumn,
  Subtitle2,
  type TableColumnDefinition, mergeClasses } from "@fluentui/react-components";
import { ArrowUndo20Regular, DocumentSearch20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ConfirmDialog, formatDateTime, IdSelect, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { CandidateOut, DuplicateOut, MergeOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { duplicateReasonLabel, formatRole } from "./format";
import { canUndoMerge } from "./merge";
import { useCandidateMutation } from "./use-candidates";

const STATUS_OPTIONS = [
  { id: "open", label: "Open" },
  { id: "merged", label: "Merged" },
  { id: "kept_separate", label: "Kept separate" },
];
const STATUS_BADGE: Record<DuplicateOut["status"], { label: string; color: "warning" | "success" | "subtle" }> = {
  open: { label: "Open", color: "warning" },
  merged: { label: "Merged", color: "success" },
  kept_separate: { label: "Kept separate", color: "subtle" },
};

function CandidateCell({ c }: { c: CandidateOut }) {
  const styles = useAdminStyles();
  return (
    <div className={styles.cellStack}>
      <AppLink href={`/candidates/${c.id}`} className={styles.truncate}>
        {c.full_name}
      </AppLink>
      <Caption1 className={mergeClasses(styles.muted, styles.truncate)}>
        {c.human_id} · {formatRole(c.current_title, c.current_employer)}
      </Caption1>
    </div>
  );
}

/** Duplicate queue (pairs, reasons, score) + recent merges with Undo. */
export function DuplicatesView() {
  const styles = useAdminStyles();
  const router = useRouter();
  const canRead = usePermission("candidate:read");
  const canMerge = usePermission("candidate:merge");
  const [status, setStatus] = useState<DuplicateOut["status"] | null>("open");
  const [page, setPage] = useState(1);
  const [mergePage, setMergePage] = useState(1);
  const [undoing, setUndoing] = useState<MergeOut | null>(null);

  const queue = useQuery({
    queryKey: candidateKeys.duplicateList(status, page),
    queryFn: ({ signal }) => candidatesApi.listDuplicates(status, page, DEFAULT_PAGE_SIZE, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
  const merges = useQuery({
    queryKey: candidateKeys.mergeList(mergePage),
    queryFn: ({ signal }) => candidatesApi.listMerges(mergePage, 10, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
  const undo = useCandidateMutation({
    mutationFn: (m: MergeOut) => candidatesApi.undoMerge(m.id),
    invalidate: [candidateKeys.all],
    success: "Merge undone. Both profiles are restored.",
    toastErrors: true,
  });

  if (!canRead) return <NoAccess what="candidates" />;

  const columns: TableColumnDefinition<DuplicateOut>[] = [
    createTableColumn<DuplicateOut>({
      columnId: "a",
      renderHeaderCell: () => "Candidate A",
      renderCell: (d) => <CandidateCell c={d.candidate_a} />,
    }),
    createTableColumn<DuplicateOut>({
      columnId: "b",
      renderHeaderCell: () => "Candidate B",
      renderCell: (d) => <CandidateCell c={d.candidate_b} />,
    }),
    createTableColumn<DuplicateOut>({
      columnId: "reasons",
      renderHeaderCell: () => "Reasons",
      renderCell: (d) => (
        <div className={styles.badges}>
          {d.reasons.map((r) => (
            <Badge key={r} appearance="tint" color={r.startsWith("fuzzy") ? "warning" : "danger"}>
              {duplicateReasonLabel(r)}
            </Badge>
          ))}
        </div>
      ),
    }),
    createTableColumn<DuplicateOut>({
      columnId: "score",
      renderHeaderCell: () => "Score",
      renderCell: (d) => (Number.isFinite(Number(d.score)) ? Number(d.score).toFixed(2) : d.score),
    }),
    createTableColumn<DuplicateOut>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (d) => (
        <Badge appearance="tint" color={STATUS_BADGE[d.status].color}>
          {STATUS_BADGE[d.status].label}
        </Badge>
      ),
    }),
    createTableColumn<DuplicateOut>({
      columnId: "created",
      renderHeaderCell: () => "Flagged",
      renderCell: (d) => formatDateTime(d.created_at),
    }),
    createTableColumn<DuplicateOut>({
      columnId: "review",
      renderHeaderCell: () => "Review",
      renderCell: (d) => (
        <Button
          appearance="subtle"
          icon={<DocumentSearch20Regular />}
          onClick={() => router.push(`/candidates/duplicates/${d.id}`)}
        >
          {d.status === "open" ? "Review" : "View"}
        </Button>
      ),
    }),
  ];

  const mergeColumns: TableColumnDefinition<MergeOut>[] = [
    createTableColumn<MergeOut>({
      columnId: "merged_at",
      renderHeaderCell: () => "Merged",
      renderCell: (m) => formatDateTime(m.merged_at),
    }),
    createTableColumn<MergeOut>({
      columnId: "survivor",
      renderHeaderCell: () => "Surviving profile",
      renderCell: (m) => <AppLink href={`/candidates/${m.survivor_id}`}>Open survivor</AppLink>,
    }),
    createTableColumn<MergeOut>({
      columnId: "fields",
      renderHeaderCell: () => "Fields taken from the merged profile",
      renderCell: (m) => {
        const n = Object.values(m.field_choices).length;
        return n ? `${n} field${n === 1 ? "" : "s"} chosen` : "—";
      },
    }),
    createTableColumn<MergeOut>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (m) =>
        m.undone_at ? (
          <Badge appearance="tint" color="subtle">
            Undone {formatDateTime(m.undone_at)}
          </Badge>
        ) : canUndoMerge(m) ? (
          <Caption1>Undo possible until {formatDateTime(m.undo_until)}</Caption1>
        ) : (
          <Caption1 className={styles.muted}>Final</Caption1>
        ),
    }),
    createTableColumn<MergeOut>({
      columnId: "undo",
      renderHeaderCell: () => "Undo",
      renderCell: (m) =>
        canMerge && canUndoMerge(m) ? (
          <Button appearance="subtle" icon={<ArrowUndo20Regular />} onClick={() => setUndoing(m)}>
            Undo
          </Button>
        ) : null,
    }),
  ];

  return (
    <>
      <PageHeader
        title="Duplicate candidates"
        subtitle={
          <>
            Possible duplicates found on create, import and resume upload. Nothing is merged automatically.{" "}
            <AppLink href="/candidates">Back to candidates</AppLink>
          </>
        }
      />
      <div className={styles.toolbar}>
        <IdSelect
          className={styles.filter}
          label="Status"
          noneLabel="All"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => {
            setStatus(v as DuplicateOut["status"] | null);
            setPage(1);
          }}
        />
      </div>
      <AdminGrid
        label="Duplicate queue"
        items={queue.data?.items}
        columns={columns}
        getRowId={(d) => d.id}
        loading={queue.isPending}
        error={queue.error}
        emptyText={status === "open" ? "No open duplicates. Nice and tidy." : "No duplicates."}
        columnSizing={{ a: { minWidth: 200, idealWidth: 240 }, b: { minWidth: 200, idealWidth: 240 }, reasons: { minWidth: 180 } }}
        footer={
          queue.data && (
            <PagingBar page={page} pageSize={DEFAULT_PAGE_SIZE} total={queue.data.total} onPageChange={setPage} busy={queue.isFetching} />
          )
        }
      />

      <Subtitle2 as="h2" className={styles.sectionTitle} style={{ display: "block", marginTop: 32 }}>
        Recent merges
      </Subtitle2>
      <AdminGrid
        label="Recent merges"
        items={merges.data?.items}
        columns={mergeColumns}
        getRowId={(m) => m.id}
        loading={merges.isPending}
        error={merges.error}
        emptyText="No merges yet."
        footer={
          merges.data && merges.data.total > 10 && (
            <PagingBar page={mergePage} pageSize={10} total={merges.data.total} onPageChange={setMergePage} busy={merges.isFetching} />
          )
        }
      />
      <ConfirmDialog
        open={!!undoing}
        title="Undo merge?"
        confirmLabel="Undo merge"
        onClose={() => setUndoing(null)}
        onConfirm={() => undo.mutateAsync(undoing!)}
      >
        Both profiles are restored as they were before the merge, including their resumes, tags, list memberships and
        notes.
      </ConfirmDialog>
    </>
  );
}
