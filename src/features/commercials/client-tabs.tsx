"use client";

import { registerClient360Tab } from "@/features/clients/client-360-tabs";
import { BillingProfileTab } from "./billing-profile/billing-profile-tab";
import { ClientContractsTab } from "./contracts/contracts-view";
import { ClientPurchaseOrdersTab } from "./purchase-orders/purchase-orders-view";
import { ClientRateCardsTab } from "./rate-cards/client-rate-cards-tab";

// Epic 16: the commercial tabs of Client 360 (imported once by `client-360.tsx`).
registerClient360Tab({
  key: "billing-profile",
  label: "Billing profile",
  permission: ["client:read", "billing:read"],
  order: 10,
  component: ({ clientId, clientName }) => <BillingProfileTab clientId={clientId} clientName={clientName} />,
});
registerClient360Tab({
  key: "contracts",
  label: "Contracts",
  permission: "contract:read",
  order: 20,
  component: ({ clientId }) => <ClientContractsTab clientId={clientId} />,
});
registerClient360Tab({
  key: "rate-cards",
  label: "Rate cards",
  permission: "rate_card:read",
  order: 30,
  component: ({ clientId }) => <ClientRateCardsTab clientId={clientId} />,
});
registerClient360Tab({
  key: "purchase-orders",
  label: "POs",
  permission: "po:read",
  order: 40,
  component: ({ clientId }) => <ClientPurchaseOrdersTab clientId={clientId} />,
});

export const COMMERCIAL_TABS_REGISTERED = true;
