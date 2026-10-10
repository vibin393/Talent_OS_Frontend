"use client";

import { Badge, Caption1, Link, makeStyles, MessageBar, MessageBarBody, Text, tokens } from "@fluentui/react-components";
import NextLink from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { TimeConfigForm } from "./config-form";
import { formatDay } from "./format";
import type { TimeConfigValues } from "./types";
import { useClientTimeDefaults, usePlacementTimeConfig } from "./use-timesheet-config";

const useStyles = makeStyles({
  history: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalL, alignItems: "center" },
});

/** Tenant defaults used when neither a Client nor a Placement config exists (mirrors `TimeConfigValues`). */
export const DEFAULT_TIME_CONFIG: TimeConfigValues = {
  period_kind: "weekly",
  week_start: 0,
  entry_mode: "hours",
  hours_per_day: "8.00",
  work_days: [0, 1, 2, 3, 4],
  enabled_categories: ["regular", "ot", "double_time", "holiday", "leave_paid", "leave_unpaid"],
  ot_daily_threshold: null,
  dt_daily_threshold: null,
  ot_weekly_threshold: null,
  pay_multipliers: {},
  bill_multipliers: {},
  daily_cap: "24.00",
  prefill_holidays: true,
  prefill_leave: true,
  holiday_calendar_id: null,
  approval_route: [],
};

function useCanConfigure() {
  const perms = usePermissions();
  return {
    canRead: hasAnyPermission(perms, ["timesheet:configure", "timesheet:admin", "timesheet:read"]),
    canEdit: hasAnyPermission(perms, ["timesheet:configure", "timesheet:admin"]),
  };
}

/** `/timesheets/placements/[placementId]/config`: versioned timesheet config of one placement. */
export function PlacementTimeConfigPage({ placementId }: { placementId: string }) {
  const styles = useStyles();
  const { canRead, canEdit } = useCanConfigure();
  const { query, history, save } = usePlacementTimeConfig(placementId);
  if (!canRead) return <NoAccess what="timesheet configuration" />;
  const notFound = query.isError && isApiError(query.error) && query.error.status === 404;
  return (
    <>
      <PageHeader
        title="Timesheet config"
        subtitle={
          <>
            <NextLink href={`/placements/${placementId}`}>Back to placement</NextLink> · Saving creates a new version effective from the next open period.
          </>
        }
      />
      {history.data && history.data.length > 0 && (
        <div className={styles.history}>
          <Text weight="semibold">Versions</Text>
          {history.data.map((h) => (
            <Badge key={h.id} appearance={h.id === query.data?.id ? "filled" : "outline"}>
              v{h.version} from {formatDay(h.effective_period_start)}
            </Badge>
          ))}
        </div>
      )}
      {query.isPending ? (
        <GridSkeleton />
      ) : query.isError && !notFound ? (
        <ErrorBar title="Could not load the config." message={errorMessage(query.error)} />
      ) : (
        <>
          {notFound && (
            <MessageBar intent="info" style={{ marginBottom: tokens.spacingVerticalM }}>
              <MessageBarBody>No config yet — saving creates version 1 from the defaults below.</MessageBarBody>
            </MessageBar>
          )}
          {query.data && (
            <Caption1 style={{ display: "block", marginBottom: tokens.spacingVerticalM }}>
              Version {query.data.version}, effective {formatDay(query.data.effective_period_start)} · saved {formatDateTime(query.data.created_at)}
            </Caption1>
          )}
          <TimeConfigForm
            key={query.data?.id ?? "new"}
            initial={query.data ?? DEFAULT_TIME_CONFIG}
            readOnly={!canEdit}
            saveLabel="Save new version"
            onSave={(body) => save.mutateAsync(body)}
          />
        </>
      )}
    </>
  );
}

/** `/timesheets/clients/[clientId]/defaults`: Client-level timesheet defaults for new placements. */
export function ClientTimeDefaultsPage({ clientId }: { clientId: string }) {
  const { canRead, canEdit } = useCanConfigure();
  const { query, save } = useClientTimeDefaults(clientId);
  if (!canRead) return <NoAccess what="timesheet configuration" />;
  return (
    <>
      <PageHeader
        title="Timesheet defaults"
        subtitle={
          <>
            <Link as="a" href={`/clients/${clientId}`}>
              Back to client
            </Link>{" "}
            · Used for new placements of this client.
          </>
        }
      />
      {query.isPending ? (
        <GridSkeleton />
      ) : query.isError ? (
        <ErrorBar title="Could not load the defaults." message={errorMessage(query.error)} />
      ) : (
        <>
          {query.data.is_default && (
            <MessageBar intent="info" style={{ marginBottom: tokens.spacingVerticalM }}>
              <MessageBarBody>This client uses the tenant defaults. Saving creates client-specific defaults.</MessageBarBody>
            </MessageBar>
          )}
          <TimeConfigForm
            key={query.data.updated_at ?? "default"}
            initial={query.data}
            readOnly={!canEdit}
            onSave={(body) => save.mutateAsync(body)}
          />
        </>
      )}
    </>
  );
}
