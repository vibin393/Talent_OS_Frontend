"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leaveApi, leaveKeys, workerLeaveApi, type LeaveRequestFilters } from "./api";
import type { LeaveRequestIn } from "./types";

/** Internal leave requests list (`leave:read`). */
export function useLeaveRequests(filters: LeaveRequestFilters) {
  return useQuery({ queryKey: leaveKeys.requests(filters), queryFn: ({ signal }) => leaveApi.requests(filters, signal) });
}

/** Worker "My Work" leave: requests + create / withdraw / cancel. */
export function useMyLeaveRequests() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: [...leaveKeys.worker, "requests"], queryFn: ({ signal }) => workerLeaveApi.requests(signal), retry: false });
  const refresh = () => void qc.invalidateQueries({ queryKey: leaveKeys.worker });
  const create = useMutation({ mutationFn: (body: LeaveRequestIn) => workerLeaveApi.create(body), onSuccess: refresh });
  const withdraw = useMutation({ mutationFn: (id: string) => workerLeaveApi.withdraw(id), onSuccess: refresh });
  const cancel = useMutation({ mutationFn: (id: string) => workerLeaveApi.cancel(id), onSuccess: refresh });
  return { query, create, withdraw, cancel };
}

/** Live day count for the request form (read-only preview endpoint). */
export function useLeavePreview(body: LeaveRequestIn | null) {
  return useQuery({
    queryKey: [...leaveKeys.worker, "preview", body],
    queryFn: ({ signal }) => workerLeaveApi.preview(body as LeaveRequestIn, signal),
    enabled: body !== null,
    retry: false,
  });
}

export function useMyLeaveTypes() {
  return useQuery({ queryKey: [...leaveKeys.worker, "types"], queryFn: ({ signal }) => workerLeaveApi.types(signal), retry: false });
}
