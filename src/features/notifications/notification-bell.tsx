"use client";

import {
  Body1,
  Button,
  Caption1,
  CounterBadge,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  makeStyles,
  mergeClasses,
  OverlayDrawer,
  Spinner,
  Subtitle2,
  Text,
  Tooltip,
  tokens,
  useArrowNavigationGroup,
} from "@fluentui/react-components";
import {
  Alert20Regular,
  Alert24Regular,
  Briefcase20Regular,
  CalendarLtr20Regular,
  CheckmarkCircle20Regular,
  Dismiss16Regular,
  Dismiss24Regular,
  DocumentArrowDown20Regular,
  Flow20Regular,
  Mail20Regular,
  Mention20Regular,
  People20Regular,
  PersonAdd20Regular,
  Settings20Regular,
  TaskListLtr20Regular,
} from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ErrorBar } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import type { NotificationOut } from "@/lib/api/types";
import { bellAriaLabel, groupByDay, relativeTime, safeLinkPath } from "./format";
import { useNotificationActions, useNotificationFeed } from "./use-notifications";
import { useUnreadCount } from "./use-unread-count";

const useStyles = makeStyles({
  bellWrap: { position: "relative", display: "inline-flex" },
  badge: { position: "absolute", top: "2px", right: "0px", pointerEvents: "none" },
  headerActions: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  toolbar: {
    display: "flex",
    alignSelf: "stretch",
    justifyContent: "flex-end",
    paddingInline: tokens.spacingHorizontalM,
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  body: { paddingInline: 0 },
  group: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
  },
  item: {
    position: "relative",
    display: "flex",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    cursor: "pointer",
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    ":focus-visible": { outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`, outlineOffset: "-2px" },
    ":hover .notif-dismiss, :focus-within .notif-dismiss": { opacity: 1 },
  },
  unreadItem: { backgroundColor: tokens.colorBrandBackground2 },
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
  text: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" },
  titleRow: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  dot: {
    width: "8px",
    height: "8px",
    flexShrink: 0,
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandBackground,
  },
  body1: { color: tokens.colorNeutralForeground2, overflowWrap: "anywhere" },
  time: { color: tokens.colorNeutralForeground3 },
  dismiss: { opacity: 0, alignSelf: "flex-start", "@media (hover: none)": { opacity: 1 } },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalXXXL} ${tokens.spacingHorizontalL}`,
    color: tokens.colorNeutralForeground3,
    textAlign: "center",
  },
  sentinel: { height: "1px" },
  more: { display: "flex", justifyContent: "center", padding: tokens.spacingVerticalM },
});

const GROUP_ICONS: Record<string, React.ReactElement> = {
  Demands: <Briefcase20Regular />,
  Approvals: <CheckmarkCircle20Regular />,
  Activity: <Mention20Regular />,
  Pipeline: <People20Regular />,
  Interviews: <CalendarLtr20Regular />,
  Candidates: <PersonAdd20Regular />,
  Tasks: <TaskListLtr20Regular />,
  Email: <Mail20Regular />,
  Workflow: <Flow20Regular />,
  Reports: <DocumentArrowDown20Regular />,
};

/**
 * Suite-header bell with the unread `CounterBadge` (99+) and the Microsoft 365 style notifications
 * flyout (small right `OverlayDrawer`).
 */
export function NotificationBell({ buttonClassName, iconClassName }: { buttonClassName?: string; iconClassName?: string }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;

  return (
    <>
      <span className={styles.bellWrap}>
        <Tooltip content="Notifications" relationship="description">
          <Button
            appearance="subtle"
            className={buttonClassName}
            icon={<Alert20Regular className={iconClassName} />}
            aria-label={bellAriaLabel(count)}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          />
        </Tooltip>
        {count > 0 && (
          <CounterBadge
            className={styles.badge}
            count={count}
            overflowCount={99}
            size="small"
            color="danger"
            aria-hidden
          />
        )}
      </span>
      <OverlayDrawer position="end" size="small" open={open} onOpenChange={(_, d) => setOpen(d.open)}>
        {open && <NotificationFlyout unread={count} onClose={() => setOpen(false)} />}
      </OverlayDrawer>
    </>
  );
}

function NotificationFlyout({ unread, onClose }: { unread: number; onClose: () => void }) {
  const styles = useStyles();
  const router = useRouter();
  const feed = useNotificationFeed(true);
  const { markRead, markAllRead, dismiss } = useNotificationActions();
  const arrowNav = useArrowNavigationGroup({ axis: "vertical", memorizeCurrent: true });
  const sentinel = useRef<HTMLDivElement>(null);
  const [now] = useState(() => new Date());

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const groups = groupByDay(items, now);

  const open = (n: NotificationOut) => {
    if (!n.read_at) markRead.mutate(n.id);
    const path = safeLinkPath(n.link_path);
    if (path) {
      onClose();
      router.push(path);
    }
  };

  return (
    <>
      <DrawerHeader>
        <DrawerHeaderTitle
          heading={{ as: "h2" }}
          action={
            <div className={styles.headerActions}>
              <Tooltip content="Notification settings" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Settings20Regular />}
                  onClick={() => {
                    onClose();
                    router.push("/settings/notifications");
                  }}
                />
              </Tooltip>
              <Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />
            </div>
          }
        >
          Notifications
        </DrawerHeaderTitle>
      </DrawerHeader>
      <div className={styles.toolbar}>
        <Button
          appearance="transparent"
          size="small"
          disabled={unread === 0 || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          Mark all as read
        </Button>
      </div>
      <DrawerBody className={styles.body}>
        {feed.isError && !feed.data ? (
          <ErrorBar title="Could not load notifications." message={errorMessage(feed.error)} />
        ) : feed.isPending ? (
          <div className={styles.more}>
            <Spinner size="small" label="Loading notifications" />
          </div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <Alert24Regular aria-hidden />
            <Subtitle2 as="p">You&apos;re all caught up</Subtitle2>
            <Body1>New notifications will show up here.</Body1>
          </div>
        ) : (
          <div role="list" aria-label="Notifications" {...arrowNav}>
            {groups.map((g) => (
              <div key={g.group} role="presentation">
                <Caption1 as="h3" className={styles.group} style={{ margin: 0 }}>
                  {g.group}
                </Caption1>
                {g.items.map((n) => (
                  <div/* NOSONAR */
                    key={n.id}
                    role="listitem"
                    /* NOSONAR */ tabIndex={0}
                    aria-label={`${n.read_at ? "" : "Unread: "}${n.title}`}
                    className={mergeClasses(styles.item, !n.read_at && styles.unreadItem)}
                    onClick={() => open(n)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open(n);
                      }
                      if (e.key === "Delete") dismiss.mutate(n.id);
                    }}
                  >
                    <span className={styles.icon} aria-hidden>
                      {GROUP_ICONS[n.group] ?? <Alert20Regular />}
                    </span>
                    <div className={styles.text}>
                      <div className={styles.titleRow}>
                        <Text weight={n.read_at ? "regular" : "semibold"}>{n.title}</Text>
                        {!n.read_at && <span className={styles.dot} aria-hidden />}
                      </div>
                      {n.body && (
                        <Text size={200} className={styles.body1}>
                          {n.body}
                        </Text>
                      )}
                      <Caption1 className={styles.time}>
                        <time dateTime={n.created_at}>{relativeTime(n.created_at, now)}</time>
                      </Caption1>
                    </div>
                    <Tooltip content="Dismiss" relationship="label">
                      <Button
                        className={mergeClasses("notif-dismiss", styles.dismiss)}
                        appearance="subtle"
                        size="small"
                        icon={<Dismiss16Regular />}
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss.mutate(n.id);
                        }}
                      />
                    </Tooltip>
                  </div>
                ))}
              </div>
            ))}
            <div ref={sentinel} className={styles.sentinel} />
            {isFetchingNextPage && (
              <div className={styles.more}>
                <Spinner size="tiny" label="Loading more" />
              </div>
            )}
          </div>
        )}
      </DrawerBody>
    </>
  );
}
