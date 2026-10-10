"use client";

import {
  Badge,
  Body1,
  Button,
  createTableColumn,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  type TableColumnDefinition,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { MoreHorizontal20Regular } from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { jobBoardsApi, type RowAction } from "./api";
import { PackDialog, RecordDialog } from "./manual-dialogs";
import { outOfDateCount, PUBLISH_EXTERNAL, type RowMenuItem, rowActions, statusBadge } from "./logic";
import { PostDialog } from "./post-dialog";
import type { BoardPostingOut } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center" },
});

const ACTIONS: Partial<Record<RowMenuItem, RowAction>> = {
  Refresh: "refresh",
  Close: "close",
  Retry: "retry",
  Abandon: "abandon",
  "Mark closed": "mark-closed",
};

/** Demand page "Job boards" panel (Epic 70, spec B). */
export function BoardPostingsPanel({ demandId, postingLive = true }: { demandId: string; postingLive?: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canPublish = usePermission(PUBLISH_EXTERNAL);
  const key = ["job-boards", demandId];
  const q = useQuery({ queryKey: key, queryFn: () => jobBoardsApi.list(demandId) });
  const [posting, setPosting] = useState(false);
  const [pack, setPack] = useState<BoardPostingOut | null>(null);
  const [record, setRecord] = useState<BoardPostingOut | null>(null);
  const rows = q.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function run(r: BoardPostingOut, item: RowMenuItem) {
    try {
      if (item === "Open on board" && r.board_url) window.open(r.board_url, "_blank", "noopener");
      else if (item === "Copy posting pack") setPack(r);
      else if (item === "Record manually") setRecord(r);
      else if (item === "Update") await jobBoardsApi.updateBoards([r.id]);
      else if (ACTIONS[item]) await jobBoardsApi.action(r.id, ACTIONS[item] as RowAction);
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const columns: TableColumnDefinition<BoardPostingOut>[] = [
    createTableColumn({ columnId: "board", renderHeaderCell: () => "Board", renderCell: (r) => r.board_label }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => {
        const b = statusBadge(r.status);
        return (
          <Tooltip content={r.last_error_message ?? b.label} relationship="description">
            <Badge appearance="tint" color={b.color}>
              {b.label}
            </Badge>
          </Tooltip>
        );
      },
    }),
    createTableColumn({ columnId: "ref", renderHeaderCell: () => "Board reference", renderCell: (r) => r.board_ref ?? "—" }),
    createTableColumn({ columnId: "views", renderHeaderCell: () => "Views", renderCell: (r) => r.views ?? "—" }),
    createTableColumn({ columnId: "applies", renderHeaderCell: () => "Applies", renderCell: (r) => r.applies_reported ?? "—" }),
    createTableColumn({ columnId: "expires", renderHeaderCell: () => "Expires", renderCell: (r) => formatDateTime(r.expires_at) }),
    createTableColumn({
      columnId: "updated",
      renderHeaderCell: () => "Last update",
      renderCell: (r) => formatDateTime(r.last_status_at ?? r.published_at),
    }),
    createTableColumn({
      columnId: "menu",
      renderHeaderCell: () => "",
      renderCell: (r) =>
        canPublish && rowActions(r).length ? (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="subtle" icon={<MoreHorizontal20Regular />} aria-label="More actions" />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {rowActions(r).map((a) => (
                  <MenuItem key={a} onClick={() => run(r, a)}>
                    {a}
                  </MenuItem>
                ))}
              </MenuList>
            </MenuPopover>
          </Menu>
        ) : null,
    }),
  ];

  const stale = outOfDateCount(rows);
  const postButton = (
    <Button appearance="primary" disabled={!canPublish || !postingLive} onClick={() => setPosting(true)}>
      Post to job boards
    </Button>
  );

  return (
    <div className={styles.root}>
      {stale > 0 && (
        <MessageBar intent="warning">
          <MessageBarBody>The job changed after it was sent to {stale} boards.</MessageBarBody>
          <MessageBarActions>
            <Button
              onClick={async () => {
                try {
                  await jobBoardsApi.updateBoards(rows.filter((r) => r.out_of_date).map((r) => r.id));
                  await refresh();
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Update boards
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}
      <div className={styles.row}>
        {postingLive ? (
          postButton
        ) : (
          <Tooltip content="Publish the job on your careers site first" relationship="description">
            {postButton}
          </Tooltip>
        )}
      </div>
      {!q.isLoading && rows.length === 0 ? (
        <Body1>This job isn&apos;t on any job board yet.</Body1>
      ) : (
        <AdminGrid
          items={rows}
          columns={columns}
          getRowId={(r) => r.id}
          loading={q.isLoading}
          error={q.error ? errorMessage(q.error) : null}
          emptyText="This job isn't on any job board yet."
          label="Job boards"
        />
      )}
      <PostDialog
        demandId={demandId}
        open={posting}
        onClose={() => setPosting(false)}
        onPublished={(n) => {
          toast.success(`Sent to ${n} boards. We'll update their status here.`);
          void refresh();
        }}
      />
      {pack && <PackDialog id={pack.id} boardKey={pack.board_key} onClose={() => setPack(null)} />}
      {record && <RecordDialog id={record.id} onClose={() => setRecord(null)} onSaved={() => void refresh()} />}
    </div>
  );
}
