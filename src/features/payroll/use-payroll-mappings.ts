"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { payrollApi, payrollKeys } from "./api";
import type { MappingIn, MappingUpdate, PayCalendarIn, PayrollSettingsUpdate } from "./types";

/** File mapping templates + the column catalogue. */
export function usePayrollMappings(enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: payrollKeys.mappings, queryFn: ({ signal }) => payrollApi.mappings(signal), enabled });
  const catalogue = useQuery({ queryKey: payrollKeys.catalogue, queryFn: ({ signal }) => payrollApi.catalogue(signal), enabled });
  const invalidate = () => void qc.invalidateQueries({ queryKey: payrollKeys.mappings });
  const create = useMutation({ mutationFn: (body: MappingIn) => payrollApi.createMapping(body), onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: MappingUpdate }) => payrollApi.updateMapping(id, body),
    onSuccess: invalidate,
  });
  return { query, catalogue, create, update };
}

/** Tenant payroll settings (late-item mapping, included worker types). */
export function usePayrollSettings(enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: payrollKeys.settings, queryFn: ({ signal }) => payrollApi.settings(signal), enabled });
  const update = useMutation({
    mutationFn: (body: PayrollSettingsUpdate) => payrollApi.updateSettings(body),
    onSuccess: (data) => qc.setQueryData(payrollKeys.settings, data),
  });
  return { query, update };
}

/** Pay calendar + connector of one Legal Entity. */
export function usePayCalendar(le: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: payrollKeys.calendar(le ?? ""),
    queryFn: ({ signal }) => payrollApi.calendar(le ?? "", signal),
    enabled: !!le,
  });
  const connector = useQuery({
    queryKey: payrollKeys.connector(le ?? ""),
    queryFn: ({ signal }) => payrollApi.connector(le ?? "", signal),
    enabled: !!le,
  });
  const save = useMutation({
    mutationFn: (body: PayCalendarIn) => payrollApi.putCalendar(le ?? "", body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
  const setConnector = useMutation({
    mutationFn: (provider: string) => payrollApi.putConnector(le ?? "", provider),
    onSuccess: (data) => qc.setQueryData(payrollKeys.connector(le ?? ""), data),
  });
  return { query, connector, save, setConnector };
}
