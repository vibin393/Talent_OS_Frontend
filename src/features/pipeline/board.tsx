"use client";

import {
  type Announcements,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardCode,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Badge, Button, Caption1, makeStyles, mergeClasses, Text, tokens, Tooltip } from "@fluentui/react-components";
import { ChevronLeft16Regular, ChevronRight16Regular } from "@fluentui/react-icons";
import { useMemo, useState } from "react";
import type { ApplicationOut, PipelineBoardColumn, PipelineStageOut, PipelineStageTransition } from "@/lib/api/types";
import { ApplicationCard, type CardAction } from "./application-card";
import { dropAction, isTerminalKey, validDropTargets } from "./transitions";

const COLUMN_PREFIX = "col:";

const useStyles = makeStyles({
  board: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
    overflowX: "auto",
    paddingBottom: tokens.spacingVerticalM,
    alignItems: "stretch",
    minHeight: "420px",
  },
  column: {
    flex: "0 0 272px",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    transitionProperty: "opacity, border-color, background-color",
    transitionDuration: tokens.durationFast,
    "@media (max-width: 480px)": { flexBasis: "248px" },
  },
  collapsed: { flex: "0 0 56px", alignItems: "center", cursor: "default" },
  dimmed: { opacity: 0.4 },
  valid: { border: `${tokens.strokeWidthThick} dashed ${tokens.colorBrandStroke1}` },
  over: { backgroundColor: tokens.colorBrandBackground2 },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, minHeight: "32px" },
  title: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  vertical: { writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", marginTop: tokens.spacingVerticalS },
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, listStyle: "none", margin: 0, padding: 0, minHeight: "48px" },
  empty: { color: tokens.colorNeutralForeground3, textAlign: "center", padding: tokens.spacingVerticalM },
});

/**
 * Keyboard drag: ←/→ jump the dragged card to the previous / next stage column (dnd-kit's default moves
 * by a few pixels, which is unusable across wide columns). Space/Enter picks up and drops, Esc cancels.
 */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const { droppableRects, collisionRect } = context;
  if (!collisionRect) return undefined;
  if (event.code !== KeyboardCode.Right && event.code !== KeyboardCode.Left) {
    if (event.code === KeyboardCode.Down) return { ...currentCoordinates, y: currentCoordinates.y + 40 };
    if (event.code === KeyboardCode.Up) return { ...currentCoordinates, y: currentCoordinates.y - 40 };
    return undefined;
  }
  event.preventDefault();
  const columns = [...droppableRects.entries()]
    .filter(([id]) => String(id).startsWith(COLUMN_PREFIX))
    .map(([, rect]) => rect)
    .sort((a, b) => a.left - b.left);
  const center = collisionRect.left + collisionRect.width / 2;
  const current = columns.findIndex((r) => center >= r.left && center <= r.left + r.width);
  const index = current === -1 ? 0 : current + (event.code === KeyboardCode.Right ? 1 : -1);
  const target = columns[Math.max(0, Math.min(columns.length - 1, index))];
  if (!target) return undefined;
  return { x: target.left + 8, y: target.top + 48 };
};

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export type BoardProps = {
  columns: PipelineBoardColumn[];
  transitions: PipelineStageTransition[] | null | undefined;
  /** A drop or menu move; the parent decides (move, reason dialog, wizard). */
  onMove: (app: ApplicationOut, to: PipelineStageOut) => void;
  onOpen: (app: ApplicationOut) => void;
  onAction: (app: ApplicationOut, action: CardAction) => void;
  canMove: boolean;
  canSubmit: boolean;
  canReject: boolean;
  canConfirmRejection: boolean;
};

/** Kanban board: one column per stage, @dnd-kit drag and drop (pointer + keyboard, SR announcements). */
export function PipelineBoard(props: BoardProps) {
  const styles = useStyles();
  const { columns, transitions, onMove } = props;
  const [active, setActive] = useState<ApplicationOut | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const stages = useMemo(() => columns.map((c) => c.stage), [columns]);
  const appsById = useMemo(() => {
    const m = new Map<string, ApplicationOut>();
    for (const c of columns) for (const a of c.items) m.set(a.id, a);
    return m;
  }, [columns]);
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const valid = useMemo(
    () => (active ? validDropTargets(active.stage, stages, transitions) : null),
    [active, stages, transitions],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  );

  const nameOf = (id: string | number) => appsById.get(String(id))?.candidate.full_name ?? "Candidate";
  const stageOf = (overId: string | number | undefined) =>
    overId ? stageById.get(String(overId).slice(COLUMN_PREFIX.length)) : undefined;

  const announcements: Announcements = {
    onDragStart: ({ active: a }) => `Picked up ${nameOf(a.id)}. Use the left and right arrow keys to choose a stage, Space to drop, Escape to cancel.`,
    onDragOver: ({ active: a, over }) => {
      const s = stageOf(over?.id);
      if (!s) return `${nameOf(a.id)} is not over a stage.`;
      const app = appsById.get(String(a.id));
      const ok = app ? dropAction(app.stage, s, transitions).kind !== "invalid" : false;
      return `${nameOf(a.id)} is over ${s.label}${ok ? "" : " — not allowed"}.`;
    },
    onDragEnd: ({ active: a, over }) => {
      const s = stageOf(over?.id);
      return s ? `${nameOf(a.id)} dropped on ${s.label}.` : `${nameOf(a.id)} was not moved.`;
    },
    onDragCancel: ({ active: a }) => `Moving ${nameOf(a.id)} was cancelled.`,
  };

  const handleStart = (e: DragStartEvent) => setActive(appsById.get(String(e.active.id)) ?? null);
  const handleEnd = (e: DragEndEvent) => {
    const app = appsById.get(String(e.active.id));
    setActive(null);
    const to = stageOf(e.over?.id);
    if (app && to && to.id !== app.stage.id) onMove(app, to);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move a candidate to another stage, press Space or Enter on the move handle, use the left and right arrow keys to choose a stage, then press Space or Enter to drop. Press Escape to cancel. You can also use the Actions menu.",
        },
      }}
    >
      <div className={styles.board} role="list" aria-label="Pipeline stages">
        {columns.map((col) => {
          const collapsed = isTerminalKey(col.stage.key) && !expanded.has(col.stage.id);
          return (
            <Column
              key={col.stage.id}
              column={col}
              collapsed={collapsed}
              onToggle={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(col.stage.id)) next.delete(col.stage.id);
                  else next.add(col.stage.id);
                  return next;
                })
              }
              dragState={valid ? (valid.has(col.stage.id) ? "valid" : col.stage.id === active?.stage.id ? "source" : "invalid") : "idle"}
              stages={stages}
              {...props}
            />
          );
        })}
      </div>
      <DragOverlay>
        {active ? (
          <ApplicationCard
            app={active}
            moveTargets={[]}
            onOpen={() => {}}
            onAction={() => {}}
            overlay
            canMove={props.canMove}
            canSubmit={false}
            canReject={false}
            canConfirmRejection={false}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  column,
  collapsed,
  onToggle,
  dragState,
  stages,
  transitions,
  onOpen,
  onAction,
  canMove,
  canSubmit,
  canReject,
  canConfirmRejection,
}: BoardProps & {
  column: PipelineBoardColumn;
  collapsed: boolean;
  onToggle: () => void;
  dragState: "idle" | "valid" | "invalid" | "source";
  stages: PipelineStageOut[];
}) {
  const styles = useStyles();
  const { stage, count, items } = column;
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${stage.id}`, disabled: dragState === "invalid" });
  const headingId = `stage-${stage.id}`;
  const terminal = isTerminalKey(stage.key);

  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        role="listitem"
        aria-labelledby={headingId}
        className={mergeClasses(
          styles.column,
          styles.collapsed,
          dragState === "invalid" && styles.dimmed,
          dragState === "valid" && styles.valid,
          isOver && dragState === "valid" && styles.over,
        )}
      >
        <Tooltip content={`Show ${stage.label}`} relationship="label">
          <Button appearance="subtle" size="small" icon={<ChevronRight16Regular />} onClick={onToggle} aria-expanded={false} />
        </Tooltip>
        <Badge appearance="filled" color={stage.key === "hired" ? "success" : "informative"}>
          {count}
        </Badge>
        <Text id={headingId} weight="semibold" className={styles.vertical}>
          {stage.label}
        </Text>
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      role="listitem"
      aria-labelledby={headingId}
      className={mergeClasses(
        styles.column,
        dragState === "invalid" && styles.dimmed,
        dragState === "valid" && styles.valid,
        isOver && dragState === "valid" && styles.over,
      )}
    >
      <div className={styles.head}>
        <Text as="h3" id={headingId} weight="semibold" className={styles.title}>
          {stage.label}
        </Text>
        <Badge appearance="tint" color={stage.kind === "custom" ? "informative" : "brand"} aria-label={`${count} candidates`}>
          {count}
        </Badge>
        {terminal && (
          <Button appearance="subtle" size="small" icon={<ChevronLeft16Regular />} onClick={onToggle} aria-label={`Collapse ${stage.label}`} aria-expanded />
        )}
      </div>
      <ul className={styles.list} aria-labelledby={headingId}>
        {items.length === 0 && (
          <li>
            <Caption1 className={styles.empty} block>
              No candidates
            </Caption1>
          </li>
        )}
        {items.map((app) => (
          <DraggableCard
            key={app.id}
            app={app}
            stages={stages}
            transitions={transitions}
            onOpen={onOpen}
            onAction={onAction}
            canMove={canMove}
            canSubmit={canSubmit}
            canReject={canReject}
            canConfirmRejection={canConfirmRejection}
          />
        ))}
        {count > items.length && (
          <li>
            <Caption1 className={styles.empty} block>
              Showing {items.length} of {count}. Use the list view to see all.
            </Caption1>
          </li>
        )}
      </ul>
    </section>
  );
}

function DraggableCard({
  app,
  stages,
  transitions,
  onOpen,
  onAction,
  canMove,
  canSubmit,
  canReject,
  canConfirmRejection,
}: {
  app: ApplicationOut;
  stages: PipelineStageOut[];
  transitions: PipelineStageTransition[] | null | undefined;
  onOpen: (app: ApplicationOut) => void;
  onAction: (app: ApplicationOut, action: CardAction) => void;
  canMove: boolean;
  canSubmit: boolean;
  canReject: boolean;
  canConfirmRejection: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: app.id,
    disabled: !canMove,
  });
  const moveTargets = useMemo(
    () => stages.filter((s) => dropAction(app.stage, s, transitions).kind === "move"),
    [app.stage, stages, transitions],
  );
  return (
    <li ref={setNodeRef}>
      <ApplicationCard
        app={app}
        moveTargets={moveTargets}
        onOpen={() => onOpen(app)}
        onAction={(a) => onAction(app, a)}
        dragging={isDragging}
        canMove={canMove}
        canSubmit={canSubmit}
        canReject={canReject}
        canConfirmRejection={canConfirmRejection}
        handleProps={{ ...attributes, ...listeners, ref: setActivatorNodeRef }}
      />
    </li>
  );
}
