"use client";

import { registerDemandTab } from "@/features/demands/demand-tabs";
import { DemandPoolsTab } from "./demand-pools-tab";

// Epic 38: Demand "Pools" tab (imported once by `demand-detail.tsx`).
registerDemandTab({
  key: "pools",
  label: "Pools",
  permission: "pool:read",
  order: 10,
  component: ({ demandId }) => <DemandPoolsTab demandId={demandId} />,
});
