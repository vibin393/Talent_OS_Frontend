"use client";

import { GapCard } from "./gap-card";

/**
 * "Webhooks" tab. The shipped console router (`ecosystem_console.py`) does not expose a `/webhooks` read; the
 * webhook register and delivery log are served by Epic 68 under Settings &rarr; Integrations. Linked here (gap note).
 */
export function WebhooksTab() {
  return (
    <GapCard title="Webhooks" link={{ href: "/settings/integrations/webhooks", label: "Manage webhooks" }}>
      Endpoints, event subscriptions, failure streaks and the delivery log are managed on the Webhooks page. The
      ecosystem console API does not yet expose a webhook summary, so they are not shown inline here.
    </GapCard>
  );
}
