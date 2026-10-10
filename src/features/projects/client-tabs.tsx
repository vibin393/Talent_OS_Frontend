"use client";

import { registerClient360Tab } from "@/features/clients/client-360-tabs";
import { ClientProjectsTab } from "./projects-view";

// Epic 45: Client 360 "Projects" (imported once by `client-360.tsx`).
registerClient360Tab({
  key: "projects",
  label: "Projects",
  permission: "project:read",
  order: 25,
  component: ({ clientId }) => <ClientProjectsTab clientId={clientId} />,
});
