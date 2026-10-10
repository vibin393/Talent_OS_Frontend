"use client";

import { Badge, Checkbox, makeStyles, mergeClasses, Text, Tooltip, tokens } from "@fluentui/react-components";
import { Alert16Regular, CalendarLtr16Regular, Flag16Filled, Link16Regular } from "@fluentui/react-icons";
import type { TaskOut, TaskPriority } from "@/lib/api/types";
import { useEntityLabel } from "./entity-search";
import { dueLabel, ENTITY_LABELS, isOverdue, PRIORITY_LABELS } from "./task-model";

const useStyles = makeStyles({
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow2,
    borderLeft: `${tokens.strokeWidthThicker} solid transparent`,
    cursor: "pointer",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    ":focus-visible": { outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}` },
  },
  selected: { backgroundColor: tokens.colorNeutralBackground1Selected },
  overdue: { borderLeftColor: tokens.colorPaletteRedBorder2 },
  check: { marginTop: "-2px" },
  main: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" },
  title: { overflowWrap: "anywhere" },
  done: { textDecorationLine: "line-through", color: tokens.colorNeutralForeground3 },
  meta: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  metaItem: { display: "inline-flex", alignItems: "center", gap: "2px" },
  late: { color: tokens.colorPaletteRedForeground1, fontWeight: tokens.fontWeightSemibold },
  flag: { flexShrink: 0, marginTop: "2px" },
});

const FLAG_COLOR: Record<TaskPriority, string | null> = {
  low: null,
  normal: null,
  high: tokens.colorPaletteDarkOrangeForeground1,
  urgent: tokens.colorPaletteRedForeground1,
};

/** Linked-entity chip: `CAN-…`, `REQ-…` or the client name (resolved lazily). */
export function EntityChip({ type, id }: { type: string | null; id: string | null }) {
  const styles = useStyles();
  const label = useEntityLabel(type, id);
  if (!type || !id) return null;
  return (
    <Tooltip content={label.data?.full ?? ENTITY_LABELS[type] ?? type} relationship="description">
      <Badge appearance="tint" color="informative" size="small" icon={<Link16Regular />} className={styles.metaItem}>
        {label.data?.short ?? ENTITY_LABELS[type] ?? type}
      </Badge>
    </Tooltip>
  );
}

/** One task in a To Do style list: round checkbox, title, meta line (entity, due, reminder) and priority flag. */
export function TaskRow({
  task,
  now,
  timeZone,
  selected,
  canComplete,
  onToggle,
  onOpen,
  hideEntity,
}: {
  task: TaskOut;
  now: Date;
  timeZone: string;
  selected?: boolean;
  canComplete: boolean;
  onToggle: (done: boolean) => void;
  onOpen: () => void;
  hideEntity?: boolean;
}) {
  const styles = useStyles();
  const done = task.status === "done";
  const late = isOverdue(task, now, timeZone);
  const due = dueLabel(task, now, timeZone);
  const flagColor = FLAG_COLOR[task.priority as TaskPriority];

  return (
    <div
      role="listitem"
      tabIndex={0}
      aria-label={`${task.title}${late ? ", overdue" : ""}${done ? ", completed" : ""}`}
      className={mergeClasses(styles.row, selected && styles.selected, late && styles.overdue)}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter") onOpen();
        if (e.key === " " && canComplete) {
          e.preventDefault();
          onToggle(!done);
        }
      }}
      data-overdue={late || undefined}
    >
      <Checkbox
        className={styles.check}
        shape="circular"
        checked={done}
        disabled={!canComplete}
        aria-label={done ? `Mark "${task.title}" as not completed` : `Complete "${task.title}"`}
        onClick={(e) => e.stopPropagation()}
        onChange={(_, d) => onToggle(!!d.checked)}
      />
      <div className={styles.main}>
        <Text className={mergeClasses(styles.title, done && styles.done)}>{task.title}</Text>
        <div className={styles.meta}>
          {!hideEntity && <EntityChip type={task.entity_type} id={task.entity_id} />}
          {due && (
            <span className={mergeClasses(styles.metaItem, late && styles.late)}>
              <CalendarLtr16Regular aria-hidden />
              {late ? `Overdue · ${due}` : due}
            </span>
          )}
          {task.reminder_at && !done && (
            <Tooltip content={`Reminder ${new Date(task.reminder_at).toLocaleString()}`} relationship="label">
              <span className={styles.metaItem}>
                <Alert16Regular />
              </span>
            </Tooltip>
          )}
          {task.source === "workflow" && <span>From a workflow</span>}
        </div>
      </div>
      {flagColor && (
        <Tooltip content={`${PRIORITY_LABELS[task.priority as TaskPriority]} priority`} relationship="label">
          <Flag16Filled className={styles.flag} style={{ color: flagColor }} />
        </Tooltip>
      )}
    </div>
  );
}
