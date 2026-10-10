"use client";

import { registerDemandTab } from "@/features/demands/demand-tabs";
import { registerOfferPanel } from "@/features/offers/offer-panels";
import { registerPlacementPanel } from "@/features/placements/placement-panels";
import { PERM_READ } from "./logic";
import { PredictionPanel } from "./prediction-panel";

// Epic 48: prediction panels on the Demand, Offer and Placement pages (imported once by each page).
registerDemandTab({
  key: "predictions",
  label: "Predictions",
  permission: PERM_READ,
  order: 40,
  component: ({ demandId }) => <PredictionPanel subjectKind="demand" subjectId={demandId} />,
});

registerOfferPanel({
  key: "predictions",
  permission: PERM_READ,
  order: 40,
  component: ({ offerId }) => <PredictionPanel subjectKind="offer" subjectId={offerId} />,
});

registerPlacementPanel({
  key: "predictions",
  permission: PERM_READ,
  order: 40,
  component: ({ placementId }) => <PredictionPanel subjectKind="placement" subjectId={placementId} />,
});
