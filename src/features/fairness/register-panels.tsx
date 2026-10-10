"use client";

import { registerDemandTab } from "@/features/demands/demand-tabs";
import { Ll144Panel } from "./ll144-panel";
import { PERM_CONFIGURE, PERM_READ } from "./logic";

// Epic 49: "NYC LL144" tab on the Demand page (imported once by demand-detail.tsx).
registerDemandTab({
  key: "ll144",
  label: "NYC LL144",
  permission: [PERM_READ, PERM_CONFIGURE],
  order: 50,
  component: ({ demandId }) => <Ll144Panel demandId={demandId} />,
});
