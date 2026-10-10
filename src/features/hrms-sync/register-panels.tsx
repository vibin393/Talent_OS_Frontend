"use client";

import { registerPlacementPanel } from "@/features/placements/placement-panels";
import { PlacementHrmsPanel } from "./placement-panel";

// Epic 71: the HRMS panel on the Placement Overview tab (employee code, HRMS status, mismatches). Shown to holders
// of `hrms:sync` or `placement:read` (the panel endpoint allows the placement reader).
registerPlacementPanel({
  key: "hrms-sync",
  permission: ["hrms:sync", "placement:read"],
  order: 60,
  component: ({ placementId }) => <PlacementHrmsPanel placementId={placementId} />,
});
