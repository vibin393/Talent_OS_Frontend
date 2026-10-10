"use client";

import { Badge, Body1, Caption1, Card } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useMemo } from "react";
import { ErrorBlock, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { portalScreeningChatApi, screeningAgentKeys } from "./api";
import { CandidateChat } from "./candidate-chat";
import { CHAT_STATUS_LABELS } from "./logic";

export const MESSAGES_NAV = { href: "/portal/screening", label: "Messages" } as const;

/** Portal nav items plus "Messages" once the Candidate has a screening chat (inserted after the first item). */
export function useNavWithMessages<T extends { href: string; label: string }>(nav: readonly T[]): readonly { href: string; label: string }[] {
  const chats = useQuery({
    queryKey: screeningAgentKeys.portalChats,
    queryFn: ({ signal }) => portalScreeningChatApi.list(signal),
    staleTime: 60_000,
    retry: false,
  });
  return useMemo(() => (chats.data?.length ? [...nav.slice(0, 1), MESSAGES_NAV, ...nav.slice(1)] : nav), [chats.data, nav]);
}

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** `/portal/screening`: "Chats with recruiters". */
export function PortalScreeningChats() {
  const styles = usePortalStyles();
  const chats = useQuery({ queryKey: screeningAgentKeys.portalChats, queryFn: ({ signal }) => portalScreeningChatApi.list(signal) });
  return (
    <div className={styles.page}>
      <PortalPageHeader title="Chats with recruiters" subtitle="Conversations with a recruiter's AI assistant about your applications." />
      {chats.isPending ? (
        <LoadingBlock label="Loading your chats" />
      ) : chats.isError ? (
        <ErrorBlock error={chats.error} onRetry={() => chats.refetch()} />
      ) : chats.data.length === 0 ? (
        <Body1>You have no chats yet.</Body1>
      ) : (
        <Card className={styles.card}>
          <ul className={styles.list}>
            {chats.data.map((c) => (
              <li key={c.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <NextLink href={`/portal/screening/${c.id}`} className={styles.rowTitle}>
                    {c.title}
                  </NextLink>
                  <Caption1 className={styles.muted}>
                    {c.recruiter_name} · AI assistant{c.last_message_at ? ` · ${when(c.last_message_at)}` : ""}
                  </Caption1>
                </div>
                <Badge appearance="tint" color={c.status === "ended" ? "subtle" : c.status === "waiting_for_consent" ? "warning" : "brand"}>
                  {CHAT_STATUS_LABELS[c.status]}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** `/portal/screening/[id]`: one chat inside the portal shell. */
export function PortalScreeningChat({ id }: { id: string }) {
  const styles = usePortalStyles();
  const source = useMemo(() => portalScreeningChatApi.source(id), [id]);
  return (
    <div className={styles.page}>
      <NextLink href="/portal/screening" className={styles.rowTitle}>
        All chats
      </NextLink>
      <CandidateChat
        source={source}
        renderLoading={() => <LoadingBlock label="Loading the chat" />}
        renderError={(e, retry) => <ErrorBlock error={e} onRetry={retry} />}
      />
    </div>
  );
}
