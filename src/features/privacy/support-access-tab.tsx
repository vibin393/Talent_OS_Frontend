"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  createTableColumn,
  makeStyles,
  Subtitle2,
  type TableColumnDefinition,
  tokens,
} from "@fluentui/react-components";
import { Checkmark20Regular, Dismiss20Regular, Prohibited20Regular } from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, formatDateTime } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { SupportGrantOut } from "@/lib/api/types";
import { privacyApi, privacyErrorMessage, privacyKeys } from "./api";
import { formatCountdown, humanize, SUPPORT_STATUS_COLORS } from "./format";
import { useNow } from "./use-now";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1080px" },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  pending: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    alignItems: "center",
    padding: tokens.spacingHorizontalM,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorPaletteYellowBorder2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorPaletteYellowBackground1,
  },
  grow: { flex: 1, minWidth: "240px", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
});

export function isGrantLive(g: Pick<SupportGrantOut, "status" | "expires_at">, now: Date): boolean {
  return g.status === "approved" && !!g.expires_at && Date.parse(g.expires_at) > now.getTime();
}

type Decision = { grant: SupportGrantOut; action: "approve" | "deny" | "revoke" };

/** Support access tab: approve or deny vendor requests; revoke active grants. */
export function SupportAccessTab() {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canApprove = usePermission("support_access:approve");
  const now = useNow();
  const [decision, setDecision] = useState<Decision | null>(null);
  const grants = useQuery({
    queryKey: privacyKeys.supportAccess,
    queryFn: ({ signal }) => privacyApi.supportAccess(signal),
    enabled: canApprove,
    refetchInterval: 60_000,
  });
  if (!canApprove) return <Body1>You need the support_access:approve permission to manage vendor support access.</Body1>;

  const all = grants.data ?? [];
  const pending = all.filter((g) => g.status === "pending");
  const live = all.filter((g) => isGrantLive(g, now));
  const history = all.filter((g) => g.status !== "pending" && !isGrantLive(g, now));

  const columns = (withActions: boolean): TableColumnDefinition<SupportGrantOut>[] => [
    createTableColumn({ columnId: "operator", renderHeaderCell: () => "Operator", renderCell: (g) => g.operator_name ?? "Talent OS support" }),
    createTableColumn({ columnId: "reason", renderHeaderCell: () => "Reason", renderCell: (g) => g.reason }),
    createTableColumn({ columnId: "ticket", renderHeaderCell: () => "Ticket", renderCell: (g) => g.ticket_ref ?? "—" }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (g) => (
        <Badge appearance="tint" color={SUPPORT_STATUS_COLORS[g.status]}>
          {humanize(g.status)}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "window",
      renderHeaderCell: () => (withActions ? "Ends in" : "Requested"),
      renderCell: (g) => (withActions ? formatCountdown(g.expires_at, now) : formatDateTime(g.created_at)),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (g) =>
        withActions ? (
          <Button size="small" icon={<Prohibited20Regular />} onClick={() => setDecision({ grant: g, action: "revoke" })}>
            Revoke
          </Button>
        ) : null,
    }),
  ];

  return (
    <div className={styles.root}>
      {grants.isError && <ErrorBar message={privacyErrorMessage(grants.error)} />}
      <Card className={styles.card}>
        <CardHeader
          header={<Subtitle2 as="h2">Requests</Subtitle2>}
          description={<Caption1>Talent OS support can read (never change) your data only while you allow it, for at most 24 hours.</Caption1>}
        />
        {pending.length === 0 ? (
          <Body1>No pending requests.</Body1>
        ) : (
          pending.map((g) => (
            <div key={g.id} className={styles.pending}>
              <div className={styles.grow}>
                <Body1>
                  <strong>{g.operator_name ?? "Talent OS support"}</strong> requests read-only access for {g.requested_hours}{" "}
                  hour(s){g.ticket_ref ? ` · ticket ${g.ticket_ref}` : ""}
                </Body1>
                <Caption1>{g.reason}</Caption1>
                <Caption1>Requested {formatDateTime(g.created_at)}</Caption1>
              </div>
              <Button appearance="primary" icon={<Checkmark20Regular />} onClick={() => setDecision({ grant: g, action: "approve" })}>
                Approve
              </Button>
              <Button icon={<Dismiss20Regular />} onClick={() => setDecision({ grant: g, action: "deny" })}>
                Deny
              </Button>
            </div>
          ))
        )}
      </Card>
      <Card className={styles.card}>
        <CardHeader header={<Subtitle2 as="h2">Active access</Subtitle2>} />
        <AdminGrid
          items={grants.data ? live : undefined}
          columns={columns(true)}
          getRowId={(g) => g.id}
          loading={grants.isPending}
          error={null}
          emptyText="Nobody from Talent OS support has access right now."
          label="Active support access"
        />
      </Card>
      <Card className={styles.card}>
        <CardHeader header={<Subtitle2 as="h2">History</Subtitle2>} />
        <AdminGrid
          items={grants.data ? history : undefined}
          columns={columns(false)}
          getRowId={(g) => g.id}
          loading={grants.isPending}
          error={null}
          emptyText="No past support access."
          label="Support access history"
        />
      </Card>
      <ConfirmDialog
        open={decision !== null}
        title={
          decision?.action === "approve"
            ? `Allow read-only access for ${decision.grant.requested_hours} hour(s)?`
            : decision?.action === "deny"
              ? "Deny this request?"
              : "Revoke access now?"
        }
        confirmLabel={decision?.action === "approve" ? "Approve" : decision?.action === "deny" ? "Deny" : "Revoke"}
        onClose={() => setDecision(null)}
        onConfirm={() =>
          privacyApi
            .decideSupport(decision!.grant.id, decision!.action)
            .then(async () => {
              toast.success(
                decision!.action === "approve" ? "Access approved" : decision!.action === "deny" ? "Request denied" : "Access revoked",
              );
              await queryClient.invalidateQueries({ queryKey: privacyKeys.supportAccess });
            })
            .catch((e) => {
              toast.error(privacyErrorMessage(e));
              throw e;
            })
        }
      >
        {decision?.action === "approve"
          ? "The operator can view (not change) your organization's data until the grant expires. Every page they open is recorded in the audit log."
          : decision?.action === "revoke"
            ? "The operator's session ends immediately."
            : "The operator is told the request was denied."}
      </ConfirmDialog>
    </div>
  );
}
