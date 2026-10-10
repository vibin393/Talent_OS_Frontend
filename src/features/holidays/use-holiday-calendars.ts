"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { holidaysApi, leaveKeys, workerLeaveApi } from "@/features/leave/api";
import type { HolidayCalendarIn, HolidayIn } from "@/features/leave/types";

/** Holiday calendars (internal): list, detail and mutations (`holiday:manage`). */
export function useHolidayCalendars(year?: number) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: leaveKeys.calendars(year), queryFn: ({ signal }) => holidaysApi.list(year, signal) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["holidays"] });
  const create = useMutation({ mutationFn: (body: HolidayCalendarIn) => holidaysApi.create(body), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => holidaysApi.remove(id), onSuccess: refresh });
  const copy = useMutation({ mutationFn: ({ id, year: y }: { id: string; year: number }) => holidaysApi.copy(id, y), onSuccess: refresh });
  return { list, create, remove, copy };
}

export function useHolidayCalendar(id: string | null) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: leaveKeys.calendarDetail(id ?? ""),
    queryFn: ({ signal }) => holidaysApi.get(id as string, signal),
    enabled: !!id,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["holidays"] });
  const addHoliday = useMutation({ mutationFn: (body: HolidayIn) => holidaysApi.addHoliday(id as string, body), onSuccess: refresh });
  const removeHoliday = useMutation({ mutationFn: (hid: string) => holidaysApi.removeHoliday(hid), onSuccess: refresh });
  return { detail, addHoliday, removeHoliday };
}

/** Worker holidays with optional-holiday selection. */
export function useMyHolidays(year: number) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: leaveKeys.workerHolidays(year), queryFn: ({ signal }) => workerLeaveApi.holidays(year, signal), retry: false });
  const toggle = useMutation({
    mutationFn: ({ id, selected }: { id: string; selected: boolean }) => workerLeaveApi.setOptional(id, selected),
    onSuccess: (data) => qc.setQueryData(leaveKeys.workerHolidays(year), data),
  });
  return { query, toggle };
}
