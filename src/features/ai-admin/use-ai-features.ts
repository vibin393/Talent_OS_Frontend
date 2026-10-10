"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { isAiFeatureEnabled } from "./ai-features";

export const AI_FEATURES_KEY = ["ai", "features"] as const;

/** The tenant's AI feature map (`GET /api/v1/ai/features`, readable by every user). */
export function useAiFeatures() {
  const query = useQuery({
    queryKey: AI_FEATURES_KEY,
    queryFn: ({ signal }) => api.get<Record<string, boolean>>("/api/v1/ai/features", { signal }),
    staleTime: 5 * 60_000,
  });
  return {
    ...query,
    isEnabled: (feature: string) => isAiFeatureEnabled(query.data, feature),
  };
}
