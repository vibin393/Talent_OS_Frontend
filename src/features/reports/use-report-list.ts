"use client";

import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/features/auth/use-permission";
import { hasPermission } from "@/features/auth/permissions";
import { api } from "@/lib/api/client";
import type { ReportListOut } from "@/lib/api/types";
import { type ReportKind, reportListQuery, type ReportParams } from "./query";

export const reportsApi = {
  list: (kind: ReportKind, query: string, signal?: AbortSignal) =>
    api.get<ReportListOut>(`/api/v1/reports/lists/${kind}?${query}`, { signal }),
};

export const reportKeys = {
  all: ["reporting", "reports"] as const,
  list: (kind: ReportKind, query: string) => ["reporting", "reports", kind, query] as const,
};

/** One page of a report list (keeps the previous page while the next one loads). */
export function useReportList(kind: ReportKind, params: ReportParams, pageSize: number) {
  const permissions = usePermissions();
  const query = reportListQuery(params, pageSize);
  return useQuery({
    queryKey: reportKeys.list(kind, query),
    queryFn: ({ signal }) => reportsApi.list(kind, query, signal),
    enabled: hasPermission(permissions, "report:read"),
    placeholderData: (prev) => prev,
  });
}
