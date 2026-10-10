"use client";

import { registerClient360Tab } from "@/features/clients/client-360-tabs";
import { CompliancePacksTab } from "./compliance-packs-tab";

// Epic 18 (FR-103): Client 360 "Compliance packs" (imported once by `client-360.tsx`).
registerClient360Tab({
  key: "compliance-packs",
  label: "Compliance packs",
  permission: ["document:write", "onboarding:manage"],
  order: 95,
  component: ({ clientId, clientArchived }) => <CompliancePacksTab clientId={clientId} readOnly={clientArchived} />,
});
