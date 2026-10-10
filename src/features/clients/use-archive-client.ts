"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/components/toast";
import { activityKeys } from "@/features/activity/api";
import type { ClientOut } from "@/lib/api/types";
import { clientKeys, clientsApi } from "./api";
import { clientErrorMessage } from "./errors";

/** Archive an active client or restore an archived one (toggles on `archived_at`). */
export function useArchiveClient() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const mutation = useMutation({
    mutationFn: (c: Pick<ClientOut, "id" | "archived_at">) =>
      c.archived_at ? clientsApi.unarchive(c.id) : clientsApi.archive(c.id),
    onSuccess: async (saved) => {
      toast.success(saved.archived_at ? `${saved.name} archived` : `${saved.name} restored`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: clientKeys.all }),
        queryClient.invalidateQueries({ queryKey: activityKeys.timeline("clients", saved.id) }),
      ]);
    },
  });
  return Object.assign(mutation, { message: clientErrorMessage });
}
