"use client";

import type { AiFeature } from "./ai-features";
import { useAiFeatures } from "./use-ai-features";

/**
 * Renders `children` only while the tenant has `feature` turned on (Admin > AI settings); otherwise
 * `fallback` (nothing by default). Manual paths should stay outside the gate.
 */
export function AiFeatureGate({
  feature,
  children,
  fallback = null,
}: {
  feature: AiFeature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isEnabled } = useAiFeatures();
  return <>{isEnabled(feature) ? children : fallback}</>;
}
