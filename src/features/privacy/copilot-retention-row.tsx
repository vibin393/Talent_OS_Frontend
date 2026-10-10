"use client";

import { Card, CardHeader, Subtitle2, Text } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { AppLink } from "@/components/app-link";
import { usePermission } from "@/features/auth/use-permission";
import { copilotApi, copilotKeys } from "@/features/copilot/api";

/** "Copilot conversations — set in Copilot settings ({n} days)". */
export function copilotRetentionText(days: number): string {
  return `Copilot conversations — set in Copilot settings (${days} days)`;
}

/** Epic 65 (54 gap 5): read-only Copilot retention row on the retention page, for `ai:govern` holders. */
export function CopilotRetentionRow() {
  const govern = usePermission("ai:govern");
  const settings = useQuery({
    queryKey: copilotKeys.settings,
    queryFn: ({ signal }) => copilotApi.settings(signal),
    enabled: govern,
    retry: false,
  });
  if (!govern || !settings.data) return null;
  return (
    <Card>
      <CardHeader header={<Subtitle2 as="h2">Other retention</Subtitle2>} />
      <Text>
        {copilotRetentionText(settings.data.retention_days)} · <AppLink href="/settings/ai/copilot">Copilot settings</AppLink>
      </Text>
    </Card>
  );
}
