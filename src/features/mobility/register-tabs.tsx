"use client";

import { registerDemandTab } from "@/features/demands/demand-tabs";
import { DemandMobilityPanel } from "./demand-panel";
import { MOBILITY_MANAGE } from "./logic";

// Epic 41: Demand "Internal mobility" tab (imported once by `demand-detail.tsx`).
registerDemandTab({
  key: "mobility",
  label: "Internal mobility",
  permission: [MOBILITY_MANAGE, "demand:read"],
  order: 20,
  component: ({ demandId }) => <DemandMobilityPanel demandId={demandId} />,
});
