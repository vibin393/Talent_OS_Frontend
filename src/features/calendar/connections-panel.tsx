"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardFooter,
  CardHeader,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { CalendarLtr24Regular, Mail24Regular, PlugConnected20Regular, PlugDisconnected20Regular } from "@fluentui/react-icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SyncStatusSection } from "@/features/calendar-sync/sync-status-section";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import type { CalendarProvider } from "./api";
import { callbackToast, connectionState, PROVIDER_INFO, scopeLabels } from "./connections";
import { useCalendarProviders, useConnect, useConnections, useDisconnect } from "./use-connections";

const useStyles = makeStyles({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
    gap: tokens.spacingHorizontalL,
    maxWidth: "960px",
  },
  card: { minHeight: "240px" },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, paddingInline: tokens.spacingHorizontalM },
  scopes: { margin: 0, paddingInlineStart: tokens.spacingHorizontalXL, color: tokens.colorNeutralForeground2 },
  muted: { color: tokens.colorNeutralForeground3 },
  intro: { maxWidth: "720px", marginBottom: tokens.spacingVerticalL },
});

const PROVIDERS: CalendarProvider[] = ["microsoft", "google"];

/** `/settings/connections`: connect Google Workspace or Microsoft 365 for invitations, Teams/Meet links and free/busy. */
export function ConnectionsPanel() {
  const styles = useStyles();
  const toast = useAppToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const allowed = usePermission("connection:manage_own");
  const providers = useCalendarProviders();
  const connections = useConnections();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const [confirm, setConfirm] = useState<{ id: string; provider: CalendarProvider } | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const t = callbackToast(params);
    if (!t) return;
    handled.current = true;
    if (t.intent === "success") toast.success(t.text);
    else toast.error(t.text);
    router.replace(pathname, { scroll: false });
  }, [params, pathname, router, toast]);

  if (!allowed) return <NoAccess what="calendar connections" />;

  return (
    <>
      <PageHeader title="Calendar and mail connections" subtitle="Connect your work account so interview invitations come from your own calendar." />
      <Body1 as="p" className={styles.intro}>
        When connected, interviews you organise are added to your calendar with a Teams or Meet link, invitations are sent by
        your calendar, and colleagues can see when you are free in the scheduling assistant. Without a connection, invitations
        are sent as calendar files (.ics) by email.
      </Body1>
      <ErrorBar title="Could not load your connections." message={providers.error || connections.error ? errorMessage(providers.error ?? connections.error) : null} />
      {providers.isPending || connections.isPending ? (
        <GridSkeleton rows={4} />
      ) : (
        <div className={styles.grid}>
          {PROVIDERS.map((p) => {
            const info = PROVIDER_INFO[p];
            const state = connectionState(p, providers.data, connections.data);
            const scopes = providers.data?.find((x) => x.provider === p)?.scopes ?? [];
            const busy = (connect.isPending && connect.variables === p) || (disconnect.isPending && confirm?.provider === p);
            const disabled = state.kind === "not_configured";
            return (
              <Card key={p} className={styles.card} aria-disabled={disabled || undefined} appearance={disabled ? "filled-alternative" : "filled"}>
                <CardHeader
                  image={p === "microsoft" ? <CalendarLtr24Regular aria-hidden /> : <Mail24Regular aria-hidden />}
                  header={<Subtitle2 as="h2">{info.title}</Subtitle2>}
                  description={<Caption1 className={styles.muted}>{info.product}</Caption1>}
                  action={
                    state.kind === "connected" ? (
                      <Badge appearance="tint" color="success">
                        Connected
                      </Badge>
                    ) : state.kind === "needs_reconnect" ? (
                      <Badge appearance="tint" color="warning">
                        Needs reconnect
                      </Badge>
                    ) : state.kind === "not_connected" ? (
                      <Badge appearance="outline" color="informative">
                        Not connected
                      </Badge>
                    ) : (
                      <Badge appearance="outline" color="subtle">
                        Not configured
                      </Badge>
                    )
                  }
                />
                <div className={styles.body}>
                  {state.kind === "not_configured" && (
                    <Text className={styles.muted}>Not configured by your administrator — invitations are sent as calendar files.</Text>
                  )}
                  {state.kind === "connected" && (
                    <Text>
                      Connected as <strong>{state.connection.account_email ?? "your account"}</strong> since {formatDateTime(state.connection.connected_at)}.
                      New interviews get a {info.meeting} link.
                    </Text>
                  )}
                  {state.kind === "connected" && <SyncStatusSection connectionId={state.connection.id} />}
                  {state.kind === "needs_reconnect" && (
                    <MessageBar intent="warning" layout="multiline">
                      <MessageBarBody>
                        {info.title} stopped accepting the saved sign-in{state.connection.account_email ? ` for ${state.connection.account_email}` : ""}. Invitations fall back to
                        calendar files until you reconnect.
                      </MessageBarBody>
                    </MessageBar>
                  )}
                  {state.kind === "not_connected" && <Text>Connect to create {info.meeting} links and share your free/busy time.</Text>}
                  {state.kind !== "not_configured" && scopes.length > 0 && (
                    <>
                      <Caption1 className={styles.muted}>Talent OS will be able to:</Caption1>
                      <ul className={styles.scopes}>
                        {scopeLabels(scopes).map((s) => (
                          <li key={s}>
                            <Caption1>{s}</Caption1>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                <CardFooter>
                  {state.kind === "not_connected" && (
                    <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <PlugConnected20Regular />} disabled={busy} onClick={() => startConnect(p)}>
                      Connect
                    </Button>
                  )}
                  {state.kind === "needs_reconnect" && (
                    <>
                      <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <PlugConnected20Regular />} disabled={busy} onClick={() => startConnect(p)}>
                        Reconnect
                      </Button>
                      <Button icon={<PlugDisconnected20Regular />} disabled={busy} onClick={() => setConfirm({ id: state.connection.id, provider: p })}>
                        Disconnect
                      </Button>
                    </>
                  )}
                  {state.kind === "connected" && (
                    <Button icon={<PlugDisconnected20Regular />} disabled={busy} onClick={() => setConfirm({ id: state.connection.id, provider: p })}>
                      Disconnect
                    </Button>
                  )}
                  {state.kind === "not_configured" && (
                    <Button disabled icon={<PlugConnected20Regular />}>
                      Connect
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={`Disconnect ${confirm ? PROVIDER_INFO[confirm.provider].title : ""}?`}
        confirmLabel="Disconnect"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          try {
            await disconnect.mutateAsync(confirm.id);
            toast.success(`Disconnected ${PROVIDER_INFO[confirm.provider].title}.`);
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        Talent OS removes the saved sign-in and asks the provider to revoke access. Scheduled interviews keep working; future
        invitations are sent as calendar files.
      </ConfirmDialog>
    </>
  );

  function startConnect(p: CalendarProvider) {
    connect.mutate(p, { onError: (e) => toast.error(errorMessage(e)) });
  }
}
