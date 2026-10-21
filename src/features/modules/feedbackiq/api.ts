/** Feedback IQ data for native Talent OS pages — via the module gateway. */

import { useQuery } from "@tanstack/react-query";
import { moduleApi } from "../api";

export type FiqHome = {
  period: { start: string; end: string };
  csat: { csat: number; responses: number; positive: number; neutral: number; negative: number };
  engagement: { engaged_pct: number; badges_given: number; givers: number; receivers: number; users: number };
  rewards: { rewarded: number; per_user: number };
};

export const fiqKeys = { home: ["modules", "feedbackiq", "home"] as const };

export function useFiqHome() {
  return useQuery({
    queryKey: fiqKeys.home,
    queryFn: () => moduleApi.get<FiqHome>("feedbackiq", "/dashboard/home"),
    staleTime: 30_000,
  });
}
