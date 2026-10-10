"use client";

import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/components/toast";
import { useMe } from "@/features/auth/use-me";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import type { Page, TaskCreate, TaskOut, TaskUpdate } from "@/lib/api/types";
import { taskKeys, tasksApi } from "./api";
import { isOverdue, type SmartList, taskListQuery, withStatus } from "./task-model";

/** Time zone tasks are judged in: the tenant's (users have no own time zone yet), else the browser's. */
export function useTaskTimeZone(): string {
  const { data: me } = useMe();
  return me?.tenant.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function useTaskList(list: SmartList, q: string) {
  const canRead = usePermission("task:read");
  const query = taskListQuery(list, { q });
  return useQuery({
    queryKey: taskKeys.list(query),
    queryFn: ({ signal }) => tasksApi.list(query, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
}

export function useEntityTasks(entity: string, id: string) {
  const canRead = usePermission("task:read");
  return useQuery({
    queryKey: taskKeys.entity(entity, id),
    queryFn: ({ signal }) => tasksApi.forEntity(entity, id, signal),
    enabled: canRead && !!id,
  });
}

/** `{open, due_today, overdue}` for the signed-in user; refreshed every minute while visible. */
export function useTaskSummary() {
  const canRead = usePermission("task:read");
  return useQuery({
    queryKey: taskKeys.summary,
    queryFn: ({ signal }) => tasksApi.summary(signal),
    enabled: canRead,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}

/** Totals for the smart lists that `/tasks/summary` does not cover. */
export function useSmartListCounts() {
  const canRead = usePermission("task:read");
  return useQuery({
    queryKey: taskKeys.counts,
    queryFn: async ({ signal }) => {
      const lists: SmartList[] = ["upcoming", "no_date", "assigned_by_me"];
      const pages = await Promise.all(lists.map((l) => tasksApi.list(taskListQuery(l, { pageSize: 1 }), signal)));
      return Object.fromEntries(lists.map((l, i) => [l, pages[i].total])) as Partial<Record<SmartList, number>>;
    },
    enabled: canRead,
    staleTime: 30_000,
  });
}

type Snapshot = [QueryKey, Page<TaskOut> | undefined][];

/**
 * Task mutations with optimistic updates on every cached task list (smart lists and entity cards);
 * a failure rolls back and shows a toast.
 */
export function useTaskMutations() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const tz = useTaskTimeZone();

  const patchLists = (fn: (t: TaskOut) => TaskOut | null): Snapshot => {
    const snapshot = queryClient.getQueriesData<Page<TaskOut>>({ queryKey: taskKeys.lists });
    for (const [key, page] of snapshot) {
      if (!page) continue;
      const items = page.items.map(fn).filter((t): t is TaskOut => t !== null);
      queryClient.setQueryData<Page<TaskOut>>(key, { ...page, items, total: page.total - (page.items.length - items.length) });
    }
    return snapshot;
  };
  const rollback = (snapshot: Snapshot | undefined) => {
    for (const [key, page] of snapshot ?? []) queryClient.setQueryData(key, page);
  };
  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: taskKeys.all });
  };

  const setDone = useMutation({
    mutationFn: ({ task, done }: { task: TaskOut; done: boolean }) =>
      done ? tasksApi.complete(task.id) : tasksApi.reopen(task.id),
    onMutate: async ({ task, done }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists });
      const now = new Date();
      return patchLists((t) => (t.id === task.id ? withStatus(t, done, now, tz) : t));
    },
    onError: (e, { done }, snapshot) => {
      rollback(snapshot);
      toast.error(errorMessage(e, done ? "Could not complete the task." : "Could not reopen the task."));
    },
    onSettled: settle,
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TaskUpdate }) => tasksApi.update(id, body),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists });
      const now = new Date();
      return patchLists((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...(body as Partial<TaskOut>) } as TaskOut;
        return { ...next, is_overdue: isOverdue(next, now, tz) };
      });
    },
    onError: (e, _vars, snapshot) => {
      rollback(snapshot);
      toast.error(errorMessage(e, "Could not save the task."));
    },
    onSettled: settle,
  });

  const remove = useMutation({
    mutationFn: (task: TaskOut) => tasksApi.remove(task.id),
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists });
      return patchLists((t) => (t.id === task.id ? null : t));
    },
    onError: (e, _task, snapshot) => {
      rollback(snapshot);
      toast.error(errorMessage(e, "Could not delete the task."));
    },
    onSuccess: (_, task) => toast.success(`Deleted "${task.title}"`),
    onSettled: settle,
  });

  const create = useMutation({
    mutationFn: (body: TaskCreate) => tasksApi.create(body),
    onError: (e) => toast.error(errorMessage(e, "Could not add the task.")),
    onSettled: settle,
  });

  return { setDone, update, remove, create };
}
