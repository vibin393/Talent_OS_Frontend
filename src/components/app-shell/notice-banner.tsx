"use client";

import {
  Button,
  Link,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DetailsDrawer } from "@/features/admin/ui";
import { noticeKeys, noticesApi } from "@/features/notices/api";
import { noticeIntent, visibleNotices } from "@/features/notices/support";
import { MarkdownView } from "@/features/privacy/markdown-view";
import type { PlatformNoticeOut } from "@/lib/api/types";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalL },
});

/**
 * Unacknowledged platform notices (incidents, sub-processor changes, maintenance) for the signed-in
 * user; the backend filters by tenant and audience. Incidents are `intent="error"`.
 */
export function NoticeBanner() {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<PlatformNoticeOut | null>(null);
  const notices = useQuery({
    queryKey: noticeKeys.list,
    queryFn: ({ signal }) => noticesApi.list(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const ack = useMutation({
    mutationFn: (id: string) => noticesApi.ack(id),
    onSuccess: (_, id) =>
      queryClient.setQueryData<PlatformNoticeOut[]>(noticeKeys.list, (prev) =>
        prev?.map((n) => (n.id === id ? { ...n, acknowledged: true } : n)),
      ),
  });
  const list = visibleNotices(notices.data ?? []);
  if (list.length === 0) return null;
  return (
    <div className={styles.stack} role="region" aria-label="Platform notices">
      {list.map((n) => (
        <MessageBar key={n.id} intent={noticeIntent(n)} layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>{n.title}</MessageBarTitle>
            <Link as="button" onClick={() => setOpen(n)}>
              Read notice
            </Link>
          </MessageBarBody>
          <MessageBarActions>
            <Button size="small" disabled={ack.isPending} onClick={() => ack.mutate(n.id)}>
              Acknowledge
            </Button>
          </MessageBarActions>
        </MessageBar>
      ))}
      <DetailsDrawer open={open !== null} title={open?.title ?? ""} onClose={() => setOpen(null)}>
        {open && <MarkdownView source={open.body_md} />}
      </DetailsDrawer>
    </div>
  );
}
