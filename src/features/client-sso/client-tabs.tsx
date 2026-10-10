"use client";

import { registerClient360Tab } from "@/features/clients/client-360-tabs";
import { ClientSsoTab } from "./client-sso-tab";

// Epic 50 (FR-250..252): Client 360 "Single sign-on" (imported once by `client-360.tsx`).
registerClient360Tab({
  key: "single-sign-on",
  label: "Single sign-on",
  permission: "client_sso:manage",
  order: 92,
  component: ({ clientId, clientArchived }) => <ClientSsoTab clientId={clientId} readOnly={clientArchived} />,
});
