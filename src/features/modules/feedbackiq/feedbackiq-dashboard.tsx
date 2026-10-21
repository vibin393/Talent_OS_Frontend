"use client";

import { ModuleKpiDashboard, type Kpi } from "../kpi";
import { useFiqHome } from "./api";

/** Native Feedback IQ dashboard inside the Talent OS shell (data via the module gateway). */
export function FeedbackIqDashboard() {
  const { data, isPending, isError, refetch } = useFiqHome();
  const kpis: Kpi[] = data
    ? [
        { label: "CSAT", value: `${Math.round((data.csat.csat ?? 0) * 100)}%`, hint: `${data.csat.responses} responses` },
        { label: "Positive", value: data.csat.positive, hint: `${data.csat.negative} negative` },
        { label: "Engaged", value: `${Math.round((data.engagement.engaged_pct ?? 0) * 100)}%`, hint: `${data.engagement.users} users` },
        { label: "Badges given", value: data.engagement.badges_given, hint: `${data.engagement.givers} givers` },
        { label: "Rewards", value: data.rewards.rewarded, hint: `${data.rewards.per_user} per user` },
      ]
    : [];
  return (
    <ModuleKpiDashboard
      title="Feedback IQ"
      subtitle="Engagement, recognition & CSAT — live, inside Talent OS."
      kpis={kpis}
      isPending={isPending}
      isError={isError}
      onRetry={() => refetch()}
    />
  );
}
