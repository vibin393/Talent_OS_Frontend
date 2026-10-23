"use client";

import { Body1, Spinner, Switch } from "@fluentui/react-components";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";

/**
 * "List on Talent OS Jobs" toggle for the demand posting panel (Epic 75, B4). Additive slot; requires
 * `posting:publish_external`. Helper text comes from the eligibility reasons.
 */
const REASON_HELP: Record<string, string> = {
  not_live: "Not live on your careers site",
  internal_visibility: "Internal-only demand",
  client_excluded: "This client is excluded from the network",
  not_joined: "Your tenant has not joined the Job Network",
  member_pending: "Your network membership is pending verification",
  member_suspended: "Your network membership is suspended",
  sandbox: "Sandbox tenants see a private preview only",
  limit_reached: "Network limit reached",
  opted_out: "Not opted in",
};

type Eligibility = { eligible: boolean; reasons: string[]; listing: { status: string } | null };

export function DemandNetworkToggle({ demandId }: { demandId: string }) {
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [busy, setBusy] = useState(false);
  const enc = encodeURIComponent;

  const load = useCallback(async () => {
    try {
      setElig(await api.get<Eligibility>(`/api/v1/demands/${enc(demandId)}/network`));
    } catch {
      setElig({ eligible: false, reasons: [], listing: null });
    }
  }, [demandId, enc]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed local state from fetched/client-only data
    void load();
  }, [load]);

  if (!elig) return <Spinner size="tiny" label="Checking…" />;

  const listed = elig.listing?.status === "listed" || elig.listing?.status === "pending_checks" || elig.listing?.status === "held";
  const blocker = elig.reasons.find((r) => r !== "opted_out");

  async function toggle(include: boolean) {
    setBusy(true);
    try {
      await api.put(`/api/v1/demands/${enc(demandId)}/network`, { include });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Switch
        checked={listed}
        disabled={busy || (!!blocker && !listed)}
        label="List on Talent OS Jobs"
        onChange={(_, d) => void toggle(!!d.checked)}
      />
      {blocker ? <Body1 style={{ color: "var(--colorNeutralForeground3)" }}>{REASON_HELP[blocker] ?? blocker}</Body1> : null}
    </div>
  );
}
