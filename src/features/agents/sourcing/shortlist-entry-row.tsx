"use client";

import {
  Badge,
  Button,
  Caption1,
  createTableColumn,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { MoreHorizontal20Regular } from "@fluentui/react-icons";
import { AppLink } from "@/components/app-link";
import { formatDateTime } from "@/features/admin/ui";
import { ContactabilityCell } from "./contactability-cell";
import { noticeText, outreachLabel, scoreText, sourceLabel } from "./logic";
import type { EntryOut } from "./types";

const useStyles = makeStyles({
  cand: { display: "flex", flexDirection: "column", gap: "2px" },
  badges: { display: "flex", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
  chips: { display: "flex", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
  num: { fontVariantNumeric: "tabular-nums" },
  why: { whiteSpace: "normal" },
});

export interface EntryActions {
  canAdd: boolean;
  canDismiss: boolean;
  onAdd: (e: EntryOut) => void;
  onDismiss: (e: EntryOut) => void;
  onRestore: (e: EntryOut) => void;
  onReview: (e: EntryOut) => void;
}

function CandidateCell({ entry }: { entry: EntryOut }) {
  const styles = useStyles();
  return (
    <span className={styles.cand}>
      <AppLink href={`/candidates/${entry.candidate_id}`}>{entry.candidate_name ?? entry.candidate_human_id ?? "Candidate"}</AppLink>
      {entry.current_title && <Caption1 className={styles.muted}>{entry.current_title}</Caption1>}
      <span className={styles.badges}>
        {entry.flags.includes("new") && (
          <Badge appearance="tint" color="brand" size="small">
            New
          </Badge>
        )}
        {entry.flags.includes("dropped_back") && (
          <Badge appearance="tint" color="informative" size="small">
            Back again
          </Badge>
        )}
        {entry.status === "dismissed" && (
          <Badge appearance="outline" color="subtle" size="small">
            Dismissed
          </Badge>
        )}
        {entry.status === "added_to_pipeline" && (
          <Badge appearance="tint" color="success" size="small">
            In pipeline
          </Badge>
        )}
      </span>
    </span>
  );
}

function WhyCell({ entry }: { entry: EntryOut }) {
  const styles = useStyles();
  if (entry.flags.includes("no_ai_consent")) return <Text className={styles.muted}>No AI explanation — no AI consent</Text>;
  return <Text className={styles.why}>{entry.explanation ?? entry.agent_note ?? "—"}</Text>;
}

function SourceChips({ entry }: { entry: EntryOut }) {
  const styles = useStyles();
  return (
    <span className={styles.chips}>
      {entry.sources.map((s, i) => (
        <Badge key={`${s.kind}-${s.ref ?? i}`} appearance="outline" color="informative" size="small">
          {sourceLabel(s)}
        </Badge>
      ))}
    </span>
  );
}

function ActionsMenu({ entry, actions }: { entry: EntryOut; actions: EntryActions }) {
  const suggested = entry.status === "suggested";
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button appearance="subtle" icon={<MoreHorizontal20Regular />} aria-label={`Actions for ${entry.candidate_name ?? "candidate"}`} />
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuItem disabled={!suggested || !actions.canAdd} onClick={() => actions.onAdd(entry)}>
            Add to pipeline
          </MenuItem>
          {entry.status === "dismissed" ? (
            <MenuItem disabled={!actions.canDismiss} onClick={() => actions.onRestore(entry)}>
              Restore
            </MenuItem>
          ) : (
            <MenuItem disabled={!suggested || !actions.canDismiss} onClick={() => actions.onDismiss(entry)}>
              Dismiss…
            </MenuItem>
          )}
          <MenuItem disabled={!entry.draft_body} onClick={() => actions.onReview(entry)}>
            Review draft
          </MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}

/** DataGrid columns of the Agent shortlist (no client-side sorting: the server rank is the order). */
export function entryColumns(actions: EntryActions): TableColumnDefinition<EntryOut>[] {
  return [
    createTableColumn<EntryOut>({ columnId: "rank", renderHeaderCell: () => "Rank", renderCell: (e) => e.rank }),
    createTableColumn<EntryOut>({ columnId: "candidate", renderHeaderCell: () => "Candidate", renderCell: (e) => <CandidateCell entry={e} /> }),
    createTableColumn<EntryOut>({ columnId: "score", renderHeaderCell: () => "Score", renderCell: (e) => scoreText(e.overall) }),
    createTableColumn<EntryOut>({ columnId: "why", renderHeaderCell: () => "Why", renderCell: (e) => <WhyCell entry={e} /> }),
    createTableColumn<EntryOut>({ columnId: "source", renderHeaderCell: () => "Source", renderCell: (e) => <SourceChips entry={e} /> }),
    createTableColumn<EntryOut>({
      columnId: "activity",
      renderHeaderCell: () => "Last activity",
      renderCell: (e) => formatDateTime(e.last_activity_at),
    }),
    createTableColumn<EntryOut>({ columnId: "notice", renderHeaderCell: () => "Notice", renderCell: (e) => noticeText(e.notice_period_days) }),
    createTableColumn<EntryOut>({ columnId: "contact", renderHeaderCell: () => "Contact", renderCell: (e) => <ContactabilityCell entry={e} /> }),
    createTableColumn<EntryOut>({ columnId: "outreach", renderHeaderCell: () => "Outreach", renderCell: (e) => outreachLabel(e) ?? "—" }),
    createTableColumn<EntryOut>({
      columnId: "actions",
      renderHeaderCell: () => <span className="sr-only">Actions</span>,
      renderCell: (e) => <ActionsMenu entry={e} actions={actions} />,
    }),
  ];
}
