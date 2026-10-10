"use client";

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Avatar, Caption1, Card, makeStyles, mergeClasses, Spinner, Text, tokens } from "@fluentui/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ErrorBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { crmKeys, type OpportunityFilters } from "../api";
import { formatDate, formatMoney, formatMoneyCompact, formatPercent, STAGE_LABELS, STAGES } from "../format";
import type { BoardOut, OpportunityOut, OpportunityStage } from "../types";
import { ReasonDialog } from "../ui";
import { moveCard, useOpportunityBoard, useOpportunityMutations } from "../use-opportunity-board";
import { WonDialog } from "../won/won-dialog";
import { conflictMessage, dropAction, isColumnDimmed } from "./board-rules";

const useStyles = makeStyles({
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(240px, 1fr))",
    gap: tokens.spacingHorizontalM,
    overflowX: "auto",
    paddingBottom: tokens.spacingVerticalM,
  },
  column: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: "320px",
    transitionProperty: "opacity, outline-color",
    transitionDuration: tokens.durationFast,
    outline: `${tokens.strokeWidthThick} solid transparent`,
  },
  over: { outlineColor: tokens.colorBrandStroke1 },
  dimmed: { opacity: 0.4 },
  head: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, padding: tokens.spacingHorizontalXS },
  headTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  muted: { color: tokens.colorNeutralForeground3 },
  card: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalXXS, cursor: "grab", touchAction: "none" },
  dragging: { opacity: 0.6, boxShadow: tokens.shadow16 },
  cardFoot: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: tokens.spacingHorizontalS },
});

function OpportunityCard({ o, draggable }: { o: OpportunityOut; draggable: boolean }) {
  const styles = useStyles();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: o.id,
    data: { stage: o.stage },
    disabled: !draggable,
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined;
  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={mergeClasses(styles.card, isDragging && styles.dragging)}
      aria-label={`${o.name}, ${STAGE_LABELS[o.stage]}`}
      {...attributes}
      {...listeners}
    >
      <AppLink href={`/opportunities/${o.id}`}>
        <Text weight="semibold">{o.name}</Text>
      </AppLink>
      <Caption1 className={styles.muted}>
        {o.human_id} · {o.client_name ?? "—"}
      </Caption1>
      <Text size={200}>
        {formatMoney(o.estimated_revenue, o.currency)} · {formatPercent(o.probability_pct)}
      </Text>
      <div className={styles.cardFoot}>
        <Caption1 className={styles.muted}>Close {formatDate(o.expected_close_date)}</Caption1>
        {o.owner && <Avatar size={20} name={o.owner.name} color="colorful" title={o.owner.name} />}
      </div>
    </Card>
  );
}

function Column({
  stage,
  board,
  activeFrom,
  draggable,
}: {
  stage: OpportunityStage;
  board: BoardOut;
  activeFrom: OpportunityStage | null;
  draggable: boolean;
}) {
  const styles = useStyles();
  const col = board.columns.find((c) => c.stage === stage);
  const dimmed = isColumnDimmed(activeFrom, stage);
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: dimmed });
  return (
    <section
      ref={setNodeRef}
      className={mergeClasses(styles.column, isOver && !dimmed && styles.over, dimmed && styles.dimmed)}
      aria-label={`${STAGE_LABELS[stage]} column`}
      data-dimmed={dimmed || undefined}
    >
      <div className={styles.head}>
        <div className={styles.headTop}>
          <Text weight="semibold">{STAGE_LABELS[stage]}</Text>
          <Text className={styles.muted}>{col?.count ?? 0}</Text>
        </div>
        {(col?.totals ?? []).map((t) => (
          <Caption1 key={t.currency} className={styles.muted}>
            {formatMoneyCompact(t.estimated, t.currency)} · wtd {formatMoneyCompact(t.weighted, t.currency)}
          </Caption1>
        ))}
      </div>
      {(col?.items ?? []).map((o) => (
        <OpportunityCard key={o.id} o={o} draggable={draggable && o.stage !== "won"} />
      ))}
    </section>
  );
}

type Pending = { kind: "lost" | "reopen" | "won"; opportunity: OpportunityOut } | null;

/** Kanban board by stage with drag-and-drop (pointer + keyboard). */
export function OpportunityBoard({ filters }: { filters: OpportunityFilters }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canWrite = usePermission("opportunity:write");
  const board = useOpportunityBoard(filters);
  const { transition } = useOpportunityMutations();
  const [activeFrom, setActiveFrom] = useState<OpportunityStage | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const key = crmKeys.boardFor(filters);

  if (board.error && !board.data) return <ErrorBar title="Could not load the board." message={errorMessage(board.error)} />;
  if (!board.data) return <Spinner label="Loading board…" />;
  const data = board.data;
  const find = (id: string) => data.columns.flatMap((c) => c.items).find((o) => o.id === id);

  async function move(o: OpportunityOut, to: OpportunityStage, extra: { reason_code?: string; competitor?: string | null; note?: string | null } = {}) {
    const prev = qc.getQueryData<BoardOut>(key);
    if (prev) qc.setQueryData(key, moveCard(prev, o.id, to));
    try {
      await transition.mutateAsync({ id: o.id, body: { to, expected_stage: o.stage, ...extra } });
    } catch (e) {
      if (prev) qc.setQueryData(key, prev);
      toast.error(isApiError(e) && e.status === 409 ? conflictMessage(e.code) : errorMessage(e));
      throw e;
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveFrom((e.active.data.current?.stage as OpportunityStage | undefined) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveFrom(null);
    const o = find(String(e.active.id));
    const to = e.over?.id as OpportunityStage | undefined;
    if (!o || !to) return;
    const action = dropAction(o.stage, to);
    switch (action.kind) {
      case "transition":
        move(o, action.to).catch(() => undefined);
        return;
      case "lost":
        setPending({ kind: "lost", opportunity: o });
        return;
      case "reopen":
        setPending({ kind: "reopen", opportunity: o });
        return;
      case "won":
        setPending({ kind: "won", opportunity: o });
        return;
      case "refused":
        toast.info(action.reason);
        return;
      default:
        return;
    }
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveFrom(null)}>
        <div className={styles.board}>
          {STAGES.map((s) => (
            <Column key={s} stage={s} board={data} activeFrom={activeFrom} draggable={canWrite} />
          ))}
        </div>
      </DndContext>
      {(pending?.kind === "lost" || pending?.kind === "reopen") && (
      <ReasonDialog
        open
        title={pending?.kind === "reopen" ? "Reopen opportunity" : "Mark opportunity lost"}
        kind={pending?.kind === "reopen" ? "reopen" : "opportunity_lost"}
        confirmLabel={pending?.kind === "reopen" ? "Reopen" : "Mark lost"}
        withCompetitor={pending?.kind === "lost"}
        onClose={() => setPending(null)}
        onConfirm={(r) =>
          pending
            ? move(pending.opportunity, pending.kind === "reopen" ? "qualification" : "lost", {
                reason_code: r.reason_code,
                competitor: r.competitor,
                note: r.note,
              })
            : Promise.resolve()
        }
      />
      )}
      {pending?.kind === "won" && <WonDialog opportunity={pending.opportunity} onClose={() => setPending(null)} />}
    </>
  );
}
