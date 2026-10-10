"use client";

import { type InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import type { NotificationOut, Page } from "@/lib/api/types";
import { notificationKeys, notificationsApi, NOTIFICATIONS_PAGE_SIZE } from "./api";

/** Paged notifications for the flyout (infinite scroll). */
export function useNotificationFeed(enabled: boolean, unreadOnly = false) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(unreadOnly),
    queryFn: ({ pageParam, signal }) => notificationsApi.list(pageParam, unreadOnly, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * NOTIFICATIONS_PAGE_SIZE < last.total ? last.page + 1 : undefined),
    enabled,
  });
}

type Feed = InfiniteData<Page<NotificationOut>, number>;

/** Mark read / mark all / dismiss, applied optimistically to the cached feed. */
export function useNotificationActions() {
  const queryClient = useQueryClient();
  const toast = useAppToast();

  const patch = (fn: (n: NotificationOut) => NotificationOut | null) => {
    const snapshot = queryClient.getQueriesData<Feed>({ queryKey: [...notificationKeys.all, "list"] });
    for (const [key, data] of snapshot) {
      if (!data) continue;
      queryClient.setQueryData<Feed>(key, {
        ...data,
        pages: data.pages.map((p) => ({
          ...p,
          items: p.items.map(fn).filter((n): n is NotificationOut => n !== null),
        })),
      });
    }
    return snapshot;
  };
  const rollback = (snapshot: [readonly unknown[], Feed | undefined][] | undefined) => {
    for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data);
  };
  const refresh = () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  const readNow = new Date().toISOString();

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: (id) => patch((n) => (n.id === id && !n.read_at ? { ...n, read_at: readNow } : n)),
    onError: (_e, _id, snapshot) => rollback(snapshot),
    onSettled: refresh,
  });
  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onMutate: () => patch((n) => (n.read_at ? n : { ...n, read_at: readNow })),
    onError: (e, _v, snapshot) => {
      rollback(snapshot);
      toast.error(errorMessage(e, "Could not mark notifications as read."));
    },
    onSettled: refresh,
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => notificationsApi.remove(id),
    onMutate: (id) => patch((n) => (n.id === id ? null : n)),
    onError: (e, _id, snapshot) => {
      rollback(snapshot);
      toast.error(errorMessage(e, "Could not dismiss the notification."));
    },
    onSettled: refresh,
  });
  return { markRead, markAllRead, dismiss };
}
