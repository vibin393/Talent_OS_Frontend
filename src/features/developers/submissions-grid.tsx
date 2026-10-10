"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  createTableColumn,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  makeStyles,
  OverlayDrawer,
  Subtitle2,
  type TableColumnDefinition,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminGrid } from "@/features/admin/admin-grid";
import { type SubmissionRow, devApi } from "./api";

const useStyles = makeStyles({
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  automated_checks: "Automated checks",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  published: "Published",
  rejected: "Not approved",
  suspended: "Suspended",
  delisted: "Delisted",
  superseded: "Superseded",
};

/** `/workspace/submissions` (74.5): the org's listing versions and their review status, with a per-row drawer. */
export function SubmissionsGrid({ org }: { org: string }) {
  const s = useStyles();
  const [open, setOpen] = useState<SubmissionRow | null>(null);
  const q = useQuery<SubmissionRow[]>({ queryKey: ["dev", "submissions", org], queryFn: () => devApi.submissions(org) });

  const columns: TableColumnDefinition<SubmissionRow>[] = [
    createTableColumn({ columnId: "app", renderHeaderCell: () => "App", renderCell: (r) => String(r.app_name ?? r.listing_name ?? "—") }),
    createTableColumn({ columnId: "version", renderHeaderCell: () => "Version", renderCell: (r) => (r.version_no != null ? String(r.version_no) : "—") }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => <Badge appearance="tint">{STATUS_LABELS[String(r.status)] ?? String(r.status ?? "—")}</Badge>,
    }),
    createTableColumn({ columnId: "submitted", renderHeaderCell: () => "Submitted", renderCell: (r) => (r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "—") }),
    createTableColumn({ columnId: "updated", renderHeaderCell: () => "Last update", renderCell: (r) => (r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "—") }),
  ];

  return (
    <>
      <AdminGrid
        items={q.data}
        columns={columns}
        getRowId={(r) => String(r.version_id ?? `${r.app_name}-${r.version_no}`)}
        loading={q.isPending}
        error={q.error}
        emptyText="No submissions yet."
        label="Submissions"
        onRowClick={(r) => setOpen(r)}
      />
      {open ? (
        <OverlayDrawer open onOpenChange={(_, d) => !d.open && setOpen(null)} position="end" size="medium">
          <DrawerHeader>
            <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={() => setOpen(null)} />}>
              {String(open.app_name ?? open.listing_name ?? "Submission")} — version {open.version_no ?? ""}
            </DrawerHeaderTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className={s.section}>
              <Subtitle2 as="h3">Automated checks</Subtitle2>
              {(open.check_results ?? []).length ? (
                (open.check_results ?? []).map((c) => (
                  <div key={c.key} className={s.row}>
                    <Badge appearance="tint" color={c.passed ? "success" : "danger"}>
                      {c.passed ? "Passed" : "Failed"}
                    </Badge>
                    <Caption1>
                      {c.key}
                      {c.detail ? ` — ${c.detail}` : ""}
                    </Caption1>
                  </div>
                ))
              ) : (
                <Caption1>No automated checks recorded.</Caption1>
              )}
              <Subtitle2 as="h3">Reviewer messages</Subtitle2>
              {(open.reviewer_messages ?? []).length ? (
                (open.reviewer_messages ?? []).map((m, i) => (
                  <div key={i} className={s.section}>
                    <Caption1>{new Date(m.at).toLocaleString()} — {m.action}</Caption1>
                    <Body1>{m.message ?? "—"}</Body1>
                  </div>
                ))
              ) : (
                <Caption1>No reviewer messages yet.</Caption1>
              )}
              <div className={s.row}>
                {String(open.status) === "changes_requested" && open.version_id ? <Button appearance="primary">Edit and resubmit</Button> : null}
                {["submitted", "in_review", "automated_checks"].includes(String(open.status)) && open.version_id ? (
                  <Button
                    onClick={() =>
                      void devApi.withdrawVersion(String(open.version_id)).then(() => {
                        void q.refetch();
                        setOpen(null);
                      })
                    }
                  >
                    Withdraw
                  </Button>
                ) : null}
              </div>
            </div>
          </DrawerBody>
        </OverlayDrawer>
      ) : null}
    </>
  );
}
