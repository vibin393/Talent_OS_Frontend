"use client";

import { Badge, Body1, Button, Card, Subtitle1, Text } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { portalApi, portalKeys } from "@/lib/api/portal-client";
import type { PortalApplication } from "@/lib/api/types";
import { formatDate, formatDateTime, OFFER_STATUS_LABELS } from "./format";
import { ErrorBlock, LoadingBlock, PortalPageHeader, usePortalStyles } from "./ui";

export function ApplicationRow({ app }: { app: PortalApplication }) {
  const styles = usePortalStyles();
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <NextLink href={`/portal/applications/${app.id}`} className={styles.rowTitle}>
          {app.title}
        </NextLink>
        <Text size={200} className={styles.muted}>
          {app.client_name ? `${app.client_name} · ` : ""}Applied {formatDate(app.applied_at)} · Updated {formatDate(app.updated_at)}
        </Text>
      </div>
      <Badge appearance={app.status === "active" ? "tint" : "outline"} color={app.status === "active" ? "brand" : "subtle"} size="large">
        {app.stage_label}
      </Badge>
    </li>
  );
}

/** Portal home: pending actions (offers, AI screenings), applications and upcoming interviews. */
export function PortalDashboard() {
  const styles = usePortalStyles();
  const apps = useQuery({ queryKey: portalKeys.applications, queryFn: ({ signal }) => portalApi.applications(signal) });
  const interviews = useQuery({ queryKey: portalKeys.interviews(true), queryFn: ({ signal }) => portalApi.interviews(true, signal) });
  const offers = useQuery({ queryKey: portalKeys.offers, queryFn: ({ signal }) => portalApi.offers(signal), retry: false });
  const screenings = useQuery({ queryKey: portalKeys.screenings, queryFn: ({ signal }) => portalApi.screenings(signal), retry: false });

  const pendingOffers = (offers.data?.items ?? []).filter((o) => o.can_respond);
  const otherOffers = (offers.data?.items ?? []).filter((o) => !o.can_respond);
  const pendingScreenings = screenings.data ?? [];
  const active = (apps.data ?? []).filter((a) => a.status === "active");
  const closed = (apps.data ?? []).filter((a) => a.status !== "active");

  return (
    <div className={styles.page}>
      <PortalPageHeader title="My applications" subtitle="Follow your applications and respond to requests from the hiring team." />

      {(pendingOffers.length > 0 || pendingScreenings.length > 0) && (
        <Card className={styles.card} role="region" aria-labelledby="pending-title">
          <Subtitle1 as="h2" id="pending-title">
            Needs your attention
          </Subtitle1>
          <ul className={styles.list}>
            {pendingOffers.map((o) => (
              <li key={o.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <Text weight="semibold">Offer: {o.title}</Text>
                  <Text size={200} className={styles.muted}>
                    Respond by {formatDate(o.expiry_date)}
                  </Text>
                </div>
                <Button as="a" href={`/portal/offers/${o.id}`} appearance="primary" className={styles.button}>
                  View offer
                </Button>
              </li>
            ))}
            {pendingScreenings.map((s) => (
              <li key={s.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <Text weight="semibold">Screening questions: {s.title}</Text>
                  {s.sent_at && (
                    <Text size={200} className={styles.muted}>
                      Sent {formatDate(s.sent_at)}
                    </Text>
                  )}
                </div>
                <Button as="a" href={`/portal/screenings/${s.id}`} appearance="primary" className={styles.button}>
                  Answer questions
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className={styles.card} role="region" aria-labelledby="apps-title">
        <Subtitle1 as="h2" id="apps-title">
          Active applications
        </Subtitle1>
        {apps.isPending ? (
          <LoadingBlock label="Loading applications" />
        ) : apps.isError ? (
          <ErrorBlock error={apps.error} onRetry={() => apps.refetch()} />
        ) : active.length === 0 ? (
          <Body1 className={styles.empty}>You have no active applications.</Body1>
        ) : (
          <ul className={styles.list}>
            {active.map((a) => (
              <ApplicationRow key={a.id} app={a} />
            ))}
          </ul>
        )}
      </Card>

      <Card className={styles.card} role="region" aria-labelledby="interviews-title">
        <div className={styles.actions} style={{ justifyContent: "space-between" }}>
          <Subtitle1 as="h2" id="interviews-title">
            Upcoming interviews
          </Subtitle1>
          <NextLink href="/portal/interviews" className={styles.rowTitle}>
            All interviews
          </NextLink>
        </div>
        {interviews.isPending ? (
          <LoadingBlock label="Loading interviews" rows={2} />
        ) : interviews.isError ? (
          <ErrorBlock error={interviews.error} onRetry={() => interviews.refetch()} />
        ) : interviews.data.length === 0 ? (
          <Body1 className={styles.empty}>No upcoming interviews.</Body1>
        ) : (
          <ul className={styles.list}>
            {interviews.data.slice(0, 3).map((i) => (
              <li key={i.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <Text weight="semibold">{[i.title, i.round_name].filter(Boolean).join(" – ")}</Text>
                  <Text size={200} className={styles.muted}>
                    {formatDateTime(i.starts_at, i.timezone)}
                    {i.mode ? ` · ${i.mode}` : ""}
                  </Text>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {otherOffers.length > 0 && (
        <Card className={styles.card} role="region" aria-labelledby="offers-title">
          <Subtitle1 as="h2" id="offers-title">
            Offers
          </Subtitle1>
          <ul className={styles.list}>
            {otherOffers.map((o) => (
              <li key={o.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <NextLink href={`/portal/offers/${o.id}`} className={styles.rowTitle}>
                    {o.title}
                  </NextLink>
                </div>
                <Badge appearance="outline">{OFFER_STATUS_LABELS[o.status] ?? o.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {closed.length > 0 && (
        <Card className={styles.card} role="region" aria-labelledby="closed-title">
          <Subtitle1 as="h2" id="closed-title">
            Past applications
          </Subtitle1>
          <ul className={styles.list}>
            {closed.map((a) => (
              <ApplicationRow key={a.id} app={a} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
