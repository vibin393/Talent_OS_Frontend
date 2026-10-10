"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { portalCeremonyApi } from "@/features/esign/portal-api";
import { SignCeremony } from "@/features/esign/sign-ceremony";
import { workOnboardingKeys } from "./api";

/** The documents signing ceremony (AD-28) inside an onboarding eSign task card. */
export function PortalCeremonyEmbed({ signerId }: { signerId: string }) {
  const qc = useQueryClient();
  const api = useMemo(() => portalCeremonyApi(signerId), [signerId]);
  return (
    <SignCeremony
      channel="portal"
      api={api}
      onFinished={() => {
        void qc.invalidateQueries({ queryKey: ["portal", "work", "onboarding"] });
        void qc.invalidateQueries({ queryKey: workOnboardingKeys.cases });
      }}
    />
  );
}
