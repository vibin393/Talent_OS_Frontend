/**
 * Croar data for native Talent OS pages — fetched through the module gateway.
 */

import { useQuery } from "@tanstack/react-query";
import { moduleApi } from "../api";

export type CroarQueue = {
  key: string;
  label: string;
  count: number;
  href: string;
  hint?: string;
  tone?: "info" | "warning" | "danger" | "success";
};

export type CroarPipelineStage = { stage: string; count: number; share: number };

export type CroarOverview = {
  as_of: string;
  queues: CroarQueue[];
  pipeline: { stages: CroarPipelineStage[] };
  hiring?: {
    active_jobs: number;
    total_jobs: number;
    candidates: number;
    applications_30d: number;
    applications_prev_30d: number;
  };
  workforce?: {
    headcount: number;
    on_probation: number;
    joined_last_30_days: number;
    assets_issued: number;
  };
  payroll?: {
    open_cycle: string | null;
    last_paid_cycle: string | null;
    currency: string;
    payslips_last_cycle: number;
  };
};

export const croarKeys = {
  overview: ["modules", "croar", "overview"] as const,
};

export function useCroarOverview() {
  return useQuery({
    queryKey: croarKeys.overview,
    queryFn: () => moduleApi.get<CroarOverview>("croar", "/enterprise/dashboard/overview"),
    staleTime: 30_000,
  });
}
