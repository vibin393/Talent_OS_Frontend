"use client";

import { Badge, makeStyles, Text, Title1, Title2, tokens } from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { AppLink } from "@/components/app-link";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { eventKeys, eventPaths } from "./api";
import { boardName, boardView, formatEta } from "./logic";
import type { QueueOut } from "./types";
import { useEventPermissions } from "./use-events";
import { useEtagPoll } from "./use-poll";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  cols: { display: "grid", gap: tokens.spacingHorizontalXL, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", "@media (max-width: 900px)": { gridTemplateColumns: "1fr" } },
  panel: { padding: tokens.spacingHorizontalXL, backgroundColor: tokens.colorNeutralBackground1, borderRadius: tokens.borderRadiusLarge, boxShadow: tokens.shadow8, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  list: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  calling: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingHorizontalL,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: tokens.fontSizeHero700,
    lineHeight: tokens.lineHeightHero700,
    fontWeight: tokens.fontWeightSemibold,
    flexWrap: "wrap",
  },
  waiting: {
    display: "grid",
    gridTemplateColumns: "3ch minmax(0, 1fr) auto",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    fontSize: tokens.fontSizeBase500,
  },
  pos: { fontVariantNumeric: "tabular-nums", color: tokens.colorNeutralForeground3 },
  eta: { fontVariantNumeric: "tabular-nums", color: tokens.colorNeutralForeground2 },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** `/campus/events/[id]/queue`: the hall screen: now calling and waiting with ETA (polls every 5 s). */
export function QueueBoard({ eventId }: { eventId: string }) {
  const styles = useStyles();
  const { canManage } = useEventPermissions();
  const live = useEtagPoll<QueueOut>(eventKeys.live(eventId, "queue"), eventPaths.queue(eventId), { enabled: canManage });
  if (!canManage) return <NoAccess what="the queue board" />;
  if (live.isPending) return <GridSkeleton />;
  if (live.isError && !live.data) return <ErrorBar title="Could not load the queue." message={errorMessage(live.error)} />;
  const q = live.data;
  const board = boardView(q);
  return (
    <div className={styles.root}>
      <AppLink href={`/campus/events/${eventId}`}>
        <ArrowLeft20Regular aria-hidden style={{ verticalAlign: "middle" }} /> Event
      </AppLink>
      <Title1 as="h1">Queue</Title1>
      <Text className={styles.muted}>
        {q.waiting} waiting · {q.open_stations} station{q.open_stations === 1 ? "" : "s"} open · about {q.median_minutes} min per interview
        {live.isError ? " · Reconnecting…" : ""}
      </Text>
      <div className={styles.cols}>
        <section className={styles.panel} aria-labelledby="now-calling">
          <Title2 as="h2" id="now-calling">
            Now calling
          </Title2>
          {board.calling.length === 0 ? (
            <Text className={styles.muted}>Nobody is being called right now.</Text>
          ) : (
            <ul className={styles.list} aria-live="assertive">
              {board.calling.map((e) => (
                <li key={e.id} className={styles.calling}>
                  <span>{boardName(e.candidate_name)}</span>
                  <span>→ {e.station_label ?? "Station"}</span>
                </li>
              ))}
            </ul>
          )}
          {board.inInterview.length > 0 && (
            <Text className={styles.muted}>
              In interview: {board.inInterview.map((e) => `${boardName(e.candidate_name)} (${e.station_label ?? "station"})`).join(", ")}
            </Text>
          )}
        </section>
        <section className={styles.panel} aria-labelledby="waiting">
          <Title2 as="h2" id="waiting">
            Waiting <Badge appearance="filled">{board.waiting.length}</Badge>
          </Title2>
          {board.waiting.length === 0 ? (
            <Text className={styles.muted}>The queue is empty.</Text>
          ) : (
            <ol className={styles.list}>
              {board.waiting.slice(0, 30).map((e) => (
                <li key={e.id} className={styles.waiting}>
                  <span className={styles.pos}>{e.position}</span>
                  <span>
                    {boardName(e.candidate_name)}
                    {e.demand_title ? <Text size={300} className={styles.muted}>{` · ${e.demand_title}`}</Text> : null}
                  </span>
                  <span className={styles.eta}>{formatEta(e.eta_minutes)}</span>
                </li>
              ))}
            </ol>
          )}
          {board.waiting.length > 30 && <Text className={styles.muted}>…and {board.waiting.length - 30} more</Text>}
        </section>
      </div>
    </div>
  );
}
