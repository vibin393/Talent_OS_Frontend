"use client";

import { Button, createTableColumn, TableCellLayout, type TableColumnDefinition, Text } from "@fluentui/react-components";
import { ArrowReset20Regular, Checkmark20Regular, Dismiss20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { formatDateTime, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import type { ApprovalRequestOut } from "@/lib/api/types";
import { type DecisionAction, DecisionDialog, subjectLabel } from "./decision-dialog";
import { keyFacts } from "./facts";
import { OfferSubject, offerHref } from "./subject-renderers/offer";
import { useCanOpenApprovals, useMyApprovals } from "./use-my-approvals";
import { useUserNames } from "./use-user-names";

const SUBJECT_LABELS: Record<ApprovalRequestOut["subject_type"], string> = {
  demand: "Demand",
  offer: "Offer",
  margin_override: "Margin override",
};

function subjectHref(r: ApprovalRequestOut): string | null {
  if (r.subject_type === "offer") return offerHref(r.subject_id);
  return r.subject_type === "demand" ? `/demands/${r.subject_id}` : null;
}

/** `/approvals`: requests whose current step is yours, with Approve / Reject / Request changes. */
export function MyApprovals() {
  const styles = useAdminStyles();
  const access = useCanOpenApprovals();
  const nameOf = useUserNames();
  const [page, setPage] = useState(1);
  const [deciding, setDeciding] = useState<{ request: ApprovalRequestOut; action: DecisionAction } | null>(null);
  const list = useMyApprovals(page, DEFAULT_PAGE_SIZE);

  if (!access.allowed && !access.loading) return <NoAccess what="approvals" />;

  const columns: TableColumnDefinition<ApprovalRequestOut>[] = [
    createTableColumn({
      columnId: "subject",
      renderHeaderCell: () => "Subject",
      renderCell: (r) => SUBJECT_LABELS[r.subject_type],
    }),
    createTableColumn({
      columnId: "title",
      renderHeaderCell: () => "REQ / title",
      renderCell: (r) => {
        const href = subjectHref(r);
        return <TableCellLayout truncate>{href ? <AppLink href={href}>{subjectLabel(r)}</AppLink> : subjectLabel(r)}</TableCellLayout>;
      },
    }),
    createTableColumn({
      columnId: "step",
      renderHeaderCell: () => "Step",
      renderCell: (r) => r.current_step_name ?? `Step ${r.current_position ?? ""}`,
    }),
    createTableColumn({
      columnId: "submitted",
      renderHeaderCell: () => "Submitted",
      renderCell: (r) => (
        <div className={styles.cellStack}>
          <Text>{nameOf(r.submitted_by) ?? "—"}</Text>
          <Text size={200} className={styles.muted}>
            {formatDateTime(r.submitted_at)}
          </Text>
        </div>
      ),
    }),
    createTableColumn({
      columnId: "facts",
      renderHeaderCell: () => "Key facts",
      renderCell: (r) =>
        r.subject_type === "offer" ? <OfferSubject request={r} /> : <TableCellLayout truncate>{keyFacts(r.facts)}</TableCellLayout>,
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Decision",
      renderCell: (r) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Button size="small" appearance="primary" icon={<Checkmark20Regular />} onClick={() => setDeciding({ request: r, action: "approve" })}>
            Approve
          </Button>
          <Button size="small" icon={<ArrowReset20Regular />} onClick={() => setDeciding({ request: r, action: "request_changes" })}>
            Request changes
          </Button>
          <Button size="small" icon={<Dismiss20Regular />} onClick={() => setDeciding({ request: r, action: "reject" })}>
            Reject
          </Button>
        </div>
      ),
    }),
  ];

  return (
    <>
      <PageHeader title="My approvals" subtitle="Requests waiting for your decision at their current step." />
      <AdminGrid
        items={list.data?.items}
        columns={columns}
        getRowId={(r) => r.id}
        loading={list.isPending}
        error={list.error}
        emptyText="Nothing is waiting for your approval."
        label="My approvals"
        columnSizing={{
          subject: { minWidth: 90, idealWidth: 100 },
          title: { minWidth: 200, idealWidth: 260 },
          step: { minWidth: 120, idealWidth: 150 },
          submitted: { minWidth: 150, idealWidth: 170 },
          facts: { minWidth: 160, idealWidth: 220 },
          actions: { minWidth: 330, idealWidth: 340 },
        }}
        footer={
          list.data && (
            <PagingBar page={page} pageSize={DEFAULT_PAGE_SIZE} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />
          )
        }
      />
      {deciding && <DecisionDialog request={deciding.request} action={deciding.action} onClose={() => setDeciding(null)} />}
    </>
  );
}
