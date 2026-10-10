"use client";

import { Caption1, makeStyles, Text, tokens } from "@fluentui/react-components";
import { AppLink } from "@/components/app-link";
import { usePermission } from "@/features/auth/use-permission";
import { employmentLabel, formatDate, formatMoney, unitSuffix } from "@/features/offers/format";
import { useOffer } from "@/features/offers/use-offer";
import type { ApprovalRequestOut } from "@/lib/api/types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", minWidth: 0, paddingBlock: tokens.spacingVerticalXS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Link target for an offer approval request: the offers page opens the offer drawer. */
export function offerHref(offerId: string): string {
  return `/offers?open=${encodeURIComponent(offerId)}`;
}

function num(v: unknown): number | null {
  const n = v === null || v === undefined || v === "" ? Number.NaN : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * My approvals: the `offer` subject (candidate, demand, pay, bill, margin, start date, link to the offer drawer).
 * Bill rate and margin only show with `compensation:view`.
 */
export function OfferSubject({ request }: { request: ApprovalRequestOut }) {
  const styles = useStyles();
  const canSeeComp = usePermission("compensation:view");
  const offer = useOffer(request.subject_id);
  const o = offer.data;
  const v = o?.current_version;
  const facts = request.facts ?? {};
  const pay = v ? formatMoney(v.pay_rate, v.pay_rate_unit) : num(facts.pay_rate)?.toLocaleString() ?? "—";
  const bill = v?.bill_rate ? formatMoney(v.bill_rate, v.bill_rate_unit) : num(facts.bill_rate) !== null ? `${num(facts.bill_rate)!.toLocaleString()}${unitSuffix(v?.bill_rate_unit)}` : null;
  const margin = v?.margin_pct ?? (num(facts.margin_percent) !== null ? String(num(facts.margin_percent)) : null);
  const title = [o?.candidate_name ?? request.subject?.title, o?.demand_title].filter(Boolean).join(" · ");
  return (
    <div className={styles.root}>
      <AppLink href={offerHref(request.subject_id)}>
        <Text weight="semibold">{o?.human_id ?? request.subject?.label ?? "Offer"}</Text>
        {title ? ` · ${title}` : ""}
      </AppLink>
      <Caption1 className={styles.muted}>
        Pay {pay}
        {canSeeComp && bill ? ` · bill ${bill}` : ""}
        {canSeeComp && margin !== null ? ` · margin ${Number(margin).toFixed(1)}%` : ""}
        {v ? ` · starts ${formatDate(v.start_date)}` : ""}
        {v || typeof facts.employment_type === "string" ? ` · ${employmentLabel(v?.employment_type ?? String(facts.employment_type))}` : ""}
      </Caption1>
    </div>
  );
}
