"use client";

import { MessageBar, MessageBarActions, MessageBarBody } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { AppLink } from "@/components/app-link";
import { formatDateTime } from "@/features/admin/ui";
import { copyApi, copyKeys } from "./api";

/** Campaign editor banner (Epic 78 B3): AI-drafted copy in use, and whether it changed after approval. */
export function CopyBanner({ campaignId, className }: { campaignId: string; className?: string }) {
  const status = useQuery({
    queryKey: copyKeys.status(campaignId),
    queryFn: ({ signal }) => copyApi.campaignStatus(campaignId, signal),
  });
  const s = status.data;
  if (!s?.uses_ai_copy) return null;
  const review = s.request_id ? `/marketing/campaigns/${campaignId}/copy/${s.request_id}` : null;
  if (s.changed_after_approval)
    return (
      <MessageBar intent="warning" className={className}>
        <MessageBarBody>The copy changed after approval. Approve it again before submitting.</MessageBarBody>
        {review && (
          <MessageBarActions>
            <AppLink href={review}>Review copy</AppLink>
          </MessageBarActions>
        )}
      </MessageBar>
    );
  return (
    <MessageBar intent="info" className={className}>
      <MessageBarBody>
        Copy drafted by AI and approved by {s.approved_by_name || "a reviewer"} on {formatDateTime(s.approved_at)}.
      </MessageBarBody>
    </MessageBar>
  );
}
