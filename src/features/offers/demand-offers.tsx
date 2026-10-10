"use client";

import { useState } from "react";
import { NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { OfferDrawer } from "./offer-drawer";
import { OffersGrid } from "./offers-grid";
import { useDemandOffers } from "./use-offers";

/** The demand "Offers" tab. */
export function DemandOffers({ demandId }: { demandId: string }) {
  const canRead = usePermission("offer:read");
  const q = useDemandOffers(demandId);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!canRead) return <NoAccess what="offers" />;
  return (
    <>
      <OffersGrid
        items={q.data}
        loading={q.isPending}
        error={q.error}
        onOpen={(o) => setOpenId(o.id)}
        emptyText="No offers on this demand yet. Create one from a Selected application in the pipeline."
      />
      {openId && <OfferDrawer offerId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
