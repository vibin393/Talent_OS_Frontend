"use client";

import { registerDemandTab } from "@/features/demands/demand-tabs";
import { BoardPostingsPanel } from "./board-postings-panel";

// Epic 70: Demand "Job boards" tab (imported once by `demand-detail.tsx`).
registerDemandTab({
  key: "job_boards",
  label: "Job boards",
  permission: "demand:read",
  order: 25,
  component: ({ demandId }) => <BoardPostingsPanel demandId={demandId} />,
});
