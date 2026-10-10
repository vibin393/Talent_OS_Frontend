"use client";

import {
  Body1,
  Button,
  Caption1,
  CounterBadge,
  makeStyles,
  mergeClasses,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Spinner,
  Subtitle2,
  Switch,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Alert20Regular, ArrowLeft20Regular, CheckmarkCircle20Regular, Settings20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBar } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { bellAriaLabel, relativeTime } from "../format";
import { portalInboxApi, portalInboxKeys } from "./api";
import { markEveryRead, markOneRead, PORTAL_AREAS, portalLinkPath, setEmailPreference } from "./inbox-state";
import type { PortalInbox, PortalKind, PortalNotification, PortalNotificationPreference } from "./types";

const useStyles = makeStyles({
  wrap: { position: "relative", display: "inline-flex" },
  badge: { position: "absolute", top: "2px", right: "0px", pointerEvents: "none" },
  surface: {
    padding: 0,
    width: "min(360px, calc(100vw - 16px))",
    maxHeight: "min(560px, calc(100vh - 80px))",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  grow: { flex: 1, minWidth: 0 },
  list: { overflowY: "auto", margin: 0, padding: 0, listStyle: "none" },
  item: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "none",
    font: "inherit",
    color: "inherit",
    minHeight: "44px",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    cursor: "pointer",
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    ":focus-visible": { outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`, outlineOffset: "-2px" },
  },
  unread: { backgroundColor: tokens.colorBrandBackground2 },
  dot: {
    width: "8px",
    height: "8px",
    marginTop: "6px",
    flexShrink: 0,
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandBackground,
  },
  dotRead: { backgroundColor: "transparent" },
  text: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" },
  body: { color: tokens.colorNeutralForeground2, overflowWrap: "anywhere" },
  time: { color: tokens.colorNeutralForeground3 },
  empty: { padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalL}`, textAlign: "center", color: tokens.colorNeutralForeground3 },
  prefs: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingHorizontalM, overflowY: "auto" },
  center: { display: "flex", justifyContent: "center", padding: tokens.spacingVerticalL },
});

/**
 * Epic 35 B7: notification bell for the Client, Vendor and Worker portal headers. A `Popover` with the
 * inbox (mark read / mark all read) and email preferences. Mobile-first: fits a 360 px screen.
 */
export function PortalBell({ portal, buttonClassName }: { portal: PortalKind; buttonClassName?: string }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const api = portalInboxApi(portal);
  const inbox = useQuery({
    queryKey: portalInboxKeys.inbox(portal),
    queryFn: ({ signal }) => api.list(signal),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const count = inbox.data?.unread_count ?? 0;
  return (
    <Popover open={open} onOpenChange={(_, d) => setOpen(d.open)} positioning="below-end" withArrow trapFocus>
      <PopoverTrigger disableButtonEnhancement>
        <span className={styles.wrap}>
          <Button
            appearance="subtle"
            className={buttonClassName}
            icon={<Alert20Regular />}
            aria-label={bellAriaLabel(count)}
            aria-expanded={open}
          />
          {count > 0 && (
            <CounterBadge className={styles.badge} count={count} overflowCount={99} size="small" color="danger" aria-hidden />
          )}
        </span>
      </PopoverTrigger>
      <PopoverSurface className={styles.surface} aria-label="Notifications">
        {open && <PortalInboxPanel portal={portal} inbox={inbox.data} loading={inbox.isPending} error={inbox.error} onNavigate={() => setOpen(false)} />}
      </PopoverSurface>
    </Popover>
  );
}

function PortalInboxPanel({
  portal,
  inbox,
  loading,
  error,
  onNavigate,
}: {
  portal: PortalKind;
  inbox: PortalInbox | undefined;
  loading: boolean;
  error: unknown;
  onNavigate: () => void;
}) {
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = portalInboxApi(portal);
  const key = portalInboxKeys.inbox(portal);
  const [view, setView] = useState<"inbox" | "preferences">("inbox");
  const [now] = useState(() => new Date());
  const [actionError, setActionError] = useState<string | null>(null);

  const markRead = useMutation({
    mutationFn: (id: string) => api.markRead(id),
    onMutate: (id) => {
      const prev = queryClient.getQueryData<PortalInbox>(key);
      if (prev) queryClient.setQueryData(key, markOneRead(prev, id));
      return { prev };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
      setActionError(errorMessage(e));
    },
  });
  const markAll = useMutation({
    mutationFn: () => api.markAllRead(),
    onMutate: () => {
      const prev = queryClient.getQueryData<PortalInbox>(key);
      if (prev) queryClient.setQueryData(key, markEveryRead(prev));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
      setActionError(errorMessage(e));
    },
  });

  const openItem = (n: PortalNotification) => {
    if (!n.read_at) markRead.mutate(n.id);
    const path = portalLinkPath(n.link, PORTAL_AREAS[portal]);
    if (path) {
      onNavigate();
      router.push(path);
    }
  };

  if (view === "preferences") return <PortalPreferences portal={portal} onBack={() => setView("inbox")} />;

  const items = inbox?.items ?? [];
  const unread = inbox?.unread_count ?? 0;
  return (
    <>
      <div className={styles.header}>
        <Subtitle2 as="h2" className={styles.grow}>
          Notifications
        </Subtitle2>
        <Button
          size="small"
          appearance="subtle"
          icon={<CheckmarkCircle20Regular />}
          disabled={unread === 0 || markAll.isPending}
          onClick={() => {
            setActionError(null);
            markAll.mutate();
          }}
        >
          Mark all read
        </Button>
        <Button size="small" appearance="subtle" icon={<Settings20Regular />} aria-label="Notification preferences" onClick={() => setView("preferences")} />
      </div>
      <ErrorBar message={actionError ?? (error && !inbox ? errorMessage(error) : null)} />
      {loading && !inbox ? (
        <div className={styles.center}>
          <Spinner size="small" label="Loading notifications" />
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <Body1>You are all caught up.</Body1>
        </div>
      ) : (
        <ul className={styles.list} aria-label="Notifications">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={mergeClasses(styles.item, !n.read_at && styles.unread)}
                aria-label={n.read_at ? n.title : `${n.title} (unread)`}
                onClick={() => openItem(n)}
              >
                <span className={mergeClasses(styles.dot, !!n.read_at && styles.dotRead)} aria-hidden />
                <span className={styles.text}>
                  <Text weight={n.read_at ? "regular" : "semibold"}>{n.title}</Text>
                  {n.body && <Caption1 className={styles.body}>{n.body}</Caption1>}
                  <Caption1 className={styles.time}>{relativeTime(n.created_at, now)}</Caption1>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PortalPreferences({ portal, onBack }: { portal: PortalKind; onBack: () => void }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const api = portalInboxApi(portal);
  const key = portalInboxKeys.preferences(portal);
  const prefs = useQuery({ queryKey: key, queryFn: ({ signal }) => api.preferences(signal) });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: ({ type, email }: { type: string; email: boolean }) => api.setPreference(type, email),
    onMutate: ({ type, email }) => {
      const prev = queryClient.getQueryData<PortalNotificationPreference[]>(key);
      if (prev) queryClient.setQueryData(key, setEmailPreference(prev, type, email));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
      setError(errorMessage(e));
    },
  });
  return (
    <>
      <div className={styles.header}>
        <Button size="small" appearance="subtle" icon={<ArrowLeft20Regular />} aria-label="Back to notifications" onClick={onBack} />
        <Subtitle2 as="h2" className={styles.grow}>
          Email preferences
        </Subtitle2>
      </div>
      <div className={styles.prefs}>
        <ErrorBar message={error ?? (prefs.error && !prefs.data ? errorMessage(prefs.error) : null)} />
        {prefs.isPending ? (
          <Spinner size="small" label="Loading preferences" />
        ) : (
          (prefs.data ?? []).map((p) => (
            <Switch
              key={p.type}
              label={p.mandatory ? `${p.label} (always sent)` : p.label}
              checked={p.mandatory || p.email}
              disabled={p.mandatory || save.isPending}
              onChange={(_, d) => {
                setError(null);
                save.mutate({ type: p.type, email: d.checked });
              }}
            />
          ))
        )}
      </div>
    </>
  );
}
