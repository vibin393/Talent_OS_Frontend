"use client";

import { useQuery } from "@tanstack/react-query";
import { clientLeaveApi, leaveApi, leaveKeys } from "./api";

/** Internal team calendar (`leave:read_team`). */
export function useLeaveCalendar(from: string, to: string, clientId?: string) {
  return useQuery({ queryKey: leaveKeys.calendar(from, to, clientId), queryFn: ({ signal }) => leaveApi.calendar(from, to, clientId, signal) });
}

/** Client Portal calendar (404 when the Client has not opted in). */
export function useClientLeaveCalendar(from: string, to: string) {
  return useQuery({ queryKey: leaveKeys.client(from, to), queryFn: ({ signal }) => clientLeaveApi.calendar(from, to, signal), retry: false });
}
