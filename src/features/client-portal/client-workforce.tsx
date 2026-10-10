"use client";

import { Badge, Button, ProgressBar, Text } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatMoney } from "@/features/billing/money";
import { cpApi, cpKeys } from "./api";
import { consumedShare } from "./logic";
import { Empty, Failure, formatDate, formatDateTime, Loading, PageTitle, useCpStyles } from "./ui";

/** `/client/team`: the client's workforce (cards; "Ending soon" badge). */
export function ClientTeam() {
  const s = useCpStyles();
  const q = useQuery({ queryKey: cpKeys.team, queryFn: ({ signal }) => cpApi.team(signal) });
  return (
    <div className={s.page}>
      <PageTitle>Your team</PageTitle>
      {q.error ? <Failure error={q.error} /> : null}
      {!q.data && !q.error ? <Loading /> : null}
      {q.data && q.data.length === 0 ? <Empty>No workers placed yet.</Empty> : null}
      <div className={s.grid}>
        {q.data?.map((p) => (
          <div key={p.id} className={s.card}>
            <Link className={s.link} href={`/client/team/${p.id}`}>
              <Text weight="semibold">{p.worker_name}</Text>
            </Link>
            <Text size={200}>{p.role_title ?? "—"}</Text>
            <Text size={200} className={s.muted}>{`${formatDate(p.start_date)} – ${formatDate(p.end_date)}`}</Text>
            <div className={s.row}>
              <Badge appearance="tint">{p.status.replace("_", " ")}</Badge>
              {p.ending_soon ? (
                <Badge appearance="filled" color="warning">
                  Ending soon
                </Badge>
              ) : null}
              {p.timesheet_status ? <Badge appearance="outline">{`Timesheet: ${p.timesheet_status.replace("_", " ")}`}</Badge> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** `/client/team/[placementId]`: timesheet status and pending actions. */
export function ClientTeamMember({ id }: { id: string }) {
  const s = useCpStyles();
  const q = useQuery({ queryKey: cpKeys.member(id), queryFn: ({ signal }) => cpApi.member(id, signal) });
  if (q.error) return <Failure error={q.error} />;
  if (!q.data) return <Loading />;
  const p = q.data;
  return (
    <div className={s.page}>
      <PageTitle>{p.worker_name}</PageTitle>
      <div className={s.card}>
        <dl className={s.dl}>
          <dt>Role</dt>
          <dd>{p.role_title ?? "—"}</dd>
          <dt>Location</dt>
          <dd>{p.work_location_text ?? "—"}</dd>
          <dt>Dates</dt>
          <dd>{`${formatDate(p.start_date)} – ${formatDate(p.end_date)}`}</dd>
          <dt>Status</dt>
          <dd>{p.status.replace("_", " ")}</dd>
        </dl>
      </div>
      <Text as="h2" size={500} weight="semibold">
        Timesheets
      </Text>
      {p.timesheets.length === 0 ? <Empty>No timesheets yet.</Empty> : null}
      <div className={s.list}>
        {p.timesheets.map((t) => (
          <div key={t.id} className={s.card}>
            <div className={s.row}>
              <Text className={s.grow}>{`${formatDate(t.period_start)} – ${formatDate(t.period_end)}`}</Text>
              <Badge appearance="tint">{t.status.replace("_", " ")}</Badge>
              <Button as="a" href={`/client/timesheets/${t.id}`} size="small">
                Open
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Text>
        Extension or offboarding requests waiting for you appear in{" "}
        <Link className={s.link} href="/client/approvals">
          Approvals
        </Link>
        .
      </Text>
    </div>
  );
}

/** `/client/purchase-orders`: PO consumption (`ProgressBar` per PO). */
export function ClientPurchaseOrders() {
  const s = useCpStyles();
  const q = useQuery({ queryKey: cpKeys.pos, queryFn: ({ signal }) => cpApi.purchaseOrders(signal) });
  return (
    <div className={s.page}>
      <PageTitle>Purchase orders</PageTitle>
      {q.error ? <Failure error={q.error} /> : null}
      {!q.data && !q.error ? <Loading /> : null}
      {q.data && q.data.length === 0 ? <Empty>No purchase orders.</Empty> : null}
      <div className={s.list}>
        {q.data?.map((po) => {
          const share = consumedShare(po.consumed_amount, po.value_cap);
          return (
            <div key={po.po_number} className={s.card}>
              <div className={s.row}>
                <Text weight="semibold" className={s.grow}>
                  {po.po_number}
                </Text>
                <Text size={200} className={s.muted}>{`valid to ${formatDate(po.valid_to)}`}</Text>
              </div>
              {share !== null ? (
                <ProgressBar value={share} thickness="large" color={share >= 0.9 ? "warning" : "brand"} aria-label={`${Math.round(share * 100)}% consumed`} />
              ) : null}
              <Text className={s.num}>
                {`Consumed ${formatMoney({ amount: po.consumed_amount, currency: po.currency })}`}
                {po.value_cap ? ` of ${formatMoney({ amount: po.value_cap, currency: po.currency })}` : ""}
                {po.remaining_amount ? ` · remaining ${formatMoney({ amount: po.remaining_amount, currency: po.currency })}` : ""}
              </Text>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** `/client/compliance`: published packs by month with item downloads (each download is logged). */
export function ClientCompliance() {
  const s = useCpStyles();
  const q = useQuery({ queryKey: cpKeys.packs, queryFn: ({ signal }) => cpApi.packs(signal) });
  return (
    <div className={s.page}>
      <PageTitle>Compliance documents</PageTitle>
      {q.error ? <Failure error={q.error} /> : null}
      {!q.data && !q.error ? <Loading /> : null}
      {q.data && q.data.length === 0 ? <Empty>No compliance packs published yet.</Empty> : null}
      <div className={s.list}>
        {q.data?.map((p) => (
          <div key={p.id} className={s.card}>
            <Text weight="semibold">{p.title}</Text>
            <Text size={200} className={s.muted}>
              {new Date(`${p.period_month}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </Text>
            <div className={s.actions}>
              {p.items.map((i) => (
                <Button key={i.id} as="a" href={cpApi.packItemUrl(i.id)}>
                  {i.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** `/client/scorecards`: interviews where the Client User is the external interviewer. */
export function ClientScorecards() {
  const s = useCpStyles();
  const q = useQuery({ queryKey: cpKeys.scorecards, queryFn: ({ signal }) => cpApi.scorecards(signal) });
  return (
    <div className={s.page}>
      <PageTitle>Interview scorecards</PageTitle>
      {q.error ? <Failure error={q.error} /> : null}
      {!q.data && !q.error ? <Loading /> : null}
      {q.data && q.data.length === 0 ? <Empty>No scorecards for you.</Empty> : null}
      <div className={s.list}>
        {q.data?.map((c) => (
          <div key={c.participant_id} className={s.card}>
            <div className={s.row}>
              <div className={s.grow}>
                <Text weight="semibold">{c.candidate_display_name}</Text>
                <br />
                <Text size={200} className={s.muted}>
                  {`${c.demand_title ?? ""}${c.stage_name ? ` · ${c.stage_name}` : ""} · ${formatDateTime(c.starts_at)}`}
                </Text>
              </div>
              <Badge appearance="tint">{c.state.replace("_", " ")}</Badge>
              {c.state === "open" ? (
                <Button as="a" href={`/client/scorecards/${c.participant_id}`} appearance="primary">
                  Fill in
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
