"use client";

import { Badge, Button, Checkbox, Tooltip } from "@fluentui/react-components";
import { Sparkle20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAppToast } from "@/components/toast";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { financeAgentApi, financeAgentKeys } from "./api";
import { runStartedMessage } from "./logic";
import type { FlagCount } from "./types";

export const NUDGE_TOOLTIP = "The Timesheet Agent reminds everyone in your list who hasn't been reminded today.";

/** Open flag counts of the monitor rows (Epic 63 "Flags" column). */
export function useFlagCounts(timesheetIds: string[], enabled: boolean): Record<string, FlagCount> {
  const ids = [...timesheetIds].sort();
  const q = useQuery({
    queryKey: financeAgentKeys.flagCounts(ids),
    queryFn: ({ signal }) => financeAgentApi.flagCounts(ids, signal),
    enabled: enabled && ids.length > 0,
  });
  return Object.fromEntries((q.data ?? []).map((c) => [c.timesheet_id, c]));
}

export function FlagsCell({ count }: { count: FlagCount | undefined }) {
  if (!count || count.open_count === 0) return <>—</>;
  return (
    <Badge appearance="tint" color={count.max_severity === "warning" ? "warning" : "informative"}>
      {count.open_count}
    </Badge>
  );
}

export function HasFlagsFilter({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <Checkbox label="Has flags" checked={checked} onChange={(_, d) => onChange(Boolean(d.checked))} />;
}

/** "Nudge now": a manual Timesheet Agent run for my list (`timesheet:monitor`). */
export function NudgeNowButton() {
  const toast = useAppToast();
  const canMonitor = usePermission("timesheet:monitor");
  const nudge = useMutation({
    mutationFn: () => financeAgentApi.nudgeNow(),
    onSuccess: (ref) => {
      const msg = runStartedMessage(ref, "Timesheet Agent");
      if (msg.intent === "success") toast.success(msg.text);
      else toast.error(msg.text);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!canMonitor) return null;
  return (
    <Tooltip content={NUDGE_TOOLTIP} relationship="description">
      <Button icon={<Sparkle20Regular />} disabled={nudge.isPending} onClick={() => nudge.mutate()}>
        Nudge now
      </Button>
    </Tooltip>
  );
}
