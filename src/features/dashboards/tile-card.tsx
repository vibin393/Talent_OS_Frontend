"use client";

import {
  Button,
  Card,
  CardHeader,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
  Subtitle2,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { ArrowClockwise16Regular, Info16Regular } from "@fluentui/react-icons";
import { AppLink } from "@/components/app-link";
import type { TileDefOut, TileOut } from "@/lib/api/types";
import { ChartTile } from "./chart-tile";
import { KpiTile } from "./kpi-tile";
import { tileHref } from "./links";
import { TableTile } from "./table-tile";

const useStyles = makeStyles({
  card: { minWidth: 0, height: "100%", boxSizing: "border-box" },
  title: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  body: { minWidth: 0 },
});

export type TileState =
  | { status: "loading" }
  | { status: "error"; message?: string }
  | { status: "ok"; tile: TileOut };

const SIZE_SPAN = { s: 1, m: 2, l: 3 } as const;

/** Grid columns a tile of `size` spans with `columns` available (1 below 768px). */
export function tileSpan(size: TileDefOut["size"], columns: number): number {
  return Math.max(1, Math.min(SIZE_SPAN[size] ?? 1, columns));
}

/** Whether a tile is shown at all: unavailable tiles (missing Epic 7/8 tables, permissions) are omitted. */
export function isTileVisible(def: Pick<TileDefOut, "available">, state: TileState): boolean {
  if (def.available === false) return false;
  return !(state.status === "ok" && state.tile.status === "unavailable");
}

function TileBody({ state, onRetry, timeZone }: { state: TileState; onRetry?: () => void; timeZone?: string }) {
  if (state.status === "loading") {
    return (
      <Skeleton aria-label="Loading" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonItem size={40} style={{ width: "40%" }} />
        <SkeletonItem size={16} />
        <SkeletonItem size={16} style={{ width: "70%" }} />
      </Skeleton>
    );
  }
  if (state.status === "error") {
    return (
      <MessageBar intent="error" layout="multiline">
        <MessageBarBody>{state.message ?? "Couldn't load this tile."}</MessageBarBody>
        {onRetry && (
          <MessageBarActions>
            <Button size="small" icon={<ArrowClockwise16Regular />} onClick={onRetry}>
              Retry
            </Button>
          </MessageBarActions>
        )}
      </MessageBar>
    );
  }
  const { tile } = state;
  if (tile.status === "timeout") {
    return (
      <MessageBar intent="warning" layout="multiline">
        <MessageBarBody>Taking too long. Narrow the date range and try again.</MessageBarBody>
      </MessageBar>
    );
  }
  switch (tile.kind) {
    case "kpi":
      return <KpiTile tile={tile} />;
    case "table":
      return <TableTile tile={tile} timeZone={timeZone} />;
    default:
      return <ChartTile tile={tile} />;
  }
}

/** Fluent card around one dashboard tile: title, definition tooltip, "View list" and the renderer. */
export function TileCard({
  def,
  state,
  onRetry,
  span = 1,
  timeZone,
}: {
  def: TileDefOut;
  state: TileState;
  onRetry?: () => void;
  span?: number;
  timeZone?: string;
}) {
  const styles = useStyles();
  if (!isTileVisible(def, state)) return null;
  const href = state.status === "ok" && state.tile.status === "ok" ? tileHref(state.tile.link) : null;
  const headingId = `tile-${def.key}`;
  return (
    <Card className={styles.card} style={{ gridColumn: `span ${span}` }} role="region" aria-labelledby={headingId}>
      <CardHeader
        header={
          <div className={styles.title}>
            <Subtitle2 as="h2" id={headingId}>
              {def.title}
            </Subtitle2>
            <Tooltip content={def.description} relationship="description" withArrow>
              <Button appearance="transparent" size="small" icon={<Info16Regular />} aria-label={`About ${def.title}`} />
            </Tooltip>
          </div>
        }
        action={href ? <AppLink href={href}>View list</AppLink> : undefined}
      />
      <div className={styles.body} aria-busy={state.status === "loading"}>
        <TileBody state={state} onRetry={onRetry} timeZone={timeZone} />
      </div>
    </Card>
  );
}
