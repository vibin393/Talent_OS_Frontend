"use client";

import { DemandPipeline } from "@/features/pipeline/demand-pipeline";
import type { DemandOut } from "@/lib/api/types";

/** Demand Pipeline tab (Epic 6): Kanban board and list of the demand's applications. */
export function PipelineTab({ demand }: { demand: DemandOut }) {
  return <DemandPipeline demand={demand} />;
}
