"use client";

import { Body1, Card, CardHeader, Subtitle2 } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app-shell/page-header";
import { clientPortalApi, clientPortalKeys } from "@/lib/api/client-portal-client";

const PERMISSION_LABELS: Record<string, string> = {
  "submissions:review": "Review submitted candidates",
  "demands:approve": "Approve demands",
  "time:approve": "Approve timesheets",
  "placements:view": "View placements",
  "invoices:view": "View invoices",
  "projects:view": "View projects", // Epic 45
  "deliverables:accept": "Accept deliverables", // Epic 45
  "forecasts:submit": "Submit hiring forecasts", // Epic 44
};

/** Client Portal home: who you are and what you can do (content areas arrive with the Client Portal epic). */
export function ClientHome() {
  const me = useQuery({ queryKey: clientPortalKeys.me, queryFn: ({ signal }) => clientPortalApi.me(signal) });
  const permissions = me.data?.portal_permissions ?? [];
  return (
    <>
      <PageHeader title={`Welcome${me.data ? `, ${me.data.display_name}` : ""}`} subtitle="Your client portal" />
      <Card style={{ maxWidth: 640 }}>
        <CardHeader header={<Subtitle2 as="h2">Your access</Subtitle2>} />
        {permissions.length ? (
          <ul>
            {permissions.map((p) => (
              <li key={p}>
                <Body1>{PERMISSION_LABELS[p] ?? p}</Body1>
              </li>
            ))}
          </ul>
        ) : (
          <Body1>You have no portal permissions yet. Ask your Account Manager.</Body1>
        )}
      </Card>
    </>
  );
}
