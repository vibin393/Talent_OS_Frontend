"use client";

import { registerClient360Tab } from "@/features/clients/client-360-tabs";
import { PortalAccessTab } from "./portal-access-tab";

// Epic 14 (FR-78): Client 360 "Portal access" (imported once by `client-360.tsx`).
registerClient360Tab({
  key: "portal-access",
  label: "Portal access",
  permission: "client_portal:manage",
  order: 90,
  component: ({ clientId, clientArchived }) => <PortalAccessTab clientId={clientId} readOnly={clientArchived} />,
});
