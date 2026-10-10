"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  makeStyles,
  Persona,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import {
  AddCircle20Regular,
  CheckmarkCircle20Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  DismissCircle20Regular,
  Delete20Regular,
  Edit20Regular,
  Eye20Regular,
  History20Regular,
  Send20Regular,
  Signature20Regular,
} from "@fluentui/react-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ErrorBar, formatDateTime } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { auditTimelineApi, auditTimelineKeys } from "./api";
import { type ActionKind, actionKind, actorName, diffRows, externalPrincipalLabel } from "./format";
import type { TimelineItem } from "./types";

const useStyles = makeStyles({
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, margin: 0, padding: 0, listStyle: "none" },
  card: { padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`, gap: tokens.spacingVerticalXS },
  row: { display: "flex", alignItems: "flex-start", gap: tokens.spacingHorizontalM, minWidth: 0 },
  icon: {
    flexShrink: 0,
    width: "32px",
    height: "32px",
    borderRadius: tokens.borderRadiusCircular,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorBrandForeground1,
  },
  main: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  meta: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  time: { color: tokens.colorNeutralForeground3 },
  summary: { overflowWrap: "anywhere" },
  diff: { marginTop: tokens.spacingVerticalXS, overflowX: "auto" },
  mono: { fontFamily: tokens.fontFamilyMonospace, overflowWrap: "anywhere" },
  empty: { color: tokens.colorNeutralForeground3, padding: tokens.spacingVerticalM },
  more: { display: "flex", justifyContent: "center", padding: tokens.spacingVerticalS },
  sentinel: { height: "1px" },
});

const ACTION_ICONS: Record<ActionKind, React.ReactElement> = {
  create: <AddCircle20Regular />,
  update: <Edit20Regular />,
  delete: <Delete20Regular />,
  approve: <CheckmarkCircle20Regular />,
  reject: <DismissCircle20Regular />,
  send: <Send20Regular />,
  sign: <Signature20Regular />,
  view: <Eye20Regular />,
  other: <History20Regular />,
};

/**
 * Epic 35 B5: the audit timeline of one record (`GET /audit/timeline`), newest first. A vertical list of
 * cards with the actor, an External-Principal badge, the one-line summary and an expandable field diff.
 * Loads more on scroll (IntersectionObserver) with a "Load more" button fallback.
 */
export function RecordTimeline({ subjectType, subjectId }: { subjectType: string; subjectId: string }) {
  const styles = useStyles();
  const sentinel = useRef<HTMLDivElement>(null);
  const feed = useInfiniteQuery({
    queryKey: auditTimelineKeys.subject(subjectType, subjectId),
    queryFn: ({ pageParam, signal }) => auditTimelineApi.page(subjectType, subjectId, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (feed.isPending) return <Spinner size="small" label="Loading history" />;
  if (feed.isError && !feed.data) return <ErrorBar title="Could not load the history." message={errorMessage(feed.error)} />;
  const items = feed.data.pages.flatMap((p) => p.items);
  if (items.length === 0) return <Body1 className={styles.empty}>No history recorded for this record yet.</Body1>;

  return (
    <div>
      <ul className={styles.list} aria-label="Record history">
        {items.map((item) => (
          <li key={item.id}>
            <TimelineCard item={item} />
          </li>
        ))}
      </ul>
      {feed.isFetchNextPageError && <ErrorBar message={errorMessage(feed.error)} />}
      {hasNextPage && (
        <>
          <div ref={sentinel} className={styles.sentinel} aria-hidden />
          <div className={styles.more}>
            <Button
              appearance="subtle"
              disabled={isFetchingNextPage}
              icon={isFetchingNextPage ? <Spinner size="tiny" /> : undefined}
              onClick={() => void fetchNextPage()}
            >
              Load more
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function TimelineCard({ item }: { item: TimelineItem }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const external = externalPrincipalLabel(item.actor_type);
  const name = actorName(item.actor_type, item.actor_display);
  const rows = diffRows(item.changes ?? []);
  return (
    <Card className={styles.card} appearance="outline">
      <div className={styles.row}>
        <span className={styles.icon} aria-hidden>
          {ACTION_ICONS[actionKind(item.action)]}
        </span>
        <div className={styles.main}>
          <div className={styles.meta}>
            <Persona name={name} size="extra-small" textAlignment="center" />
            {external && (
              <Badge appearance="tint" color="warning" size="small">
                {external}
              </Badge>
            )}
            <Caption1 className={styles.time}>
              <time dateTime={item.at}>{formatDateTime(item.at)}</time>
            </Caption1>
          </div>
          <Text className={styles.summary}>{item.summary}</Text>
          {rows.length > 0 && (
            <div>
              <Button
                size="small"
                appearance="transparent"
                icon={open ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
              >
                {open ? "Hide changes" : `Show ${rows.length} change${rows.length === 1 ? "" : "s"}`}
              </Button>
              {open && (
                <div className={styles.diff}>
                  <Table size="small" aria-label="Field changes">
                    <TableHeader>
                      <TableRow>
                        <TableHeaderCell>Field</TableHeaderCell>
                        <TableHeaderCell>Before</TableHeaderCell>
                        <TableHeaderCell>After</TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, i) => (
                        <TableRow key={`${r.field}-${i}`}>
                          <TableCell>{r.field}</TableCell>
                          <TableCell className={r.masked ? styles.mono : undefined}>{r.old}</TableCell>
                          <TableCell className={r.masked ? styles.mono : undefined}>{r.new}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
