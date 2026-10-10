"use client";

import { Badge, Button, Tooltip } from "@fluentui/react-components";
import { ArrowSwap16Regular, ArrowSwap20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { statusLabel } from "./logic";
import { TransferDialog } from "./transfer-dialog";
import type { InternalApplicationOut } from "./types";
import { useDemandInternalApplications, useInternalApplication, useMobilityPermissions } from "./use-mobility";

function tooltipFor(a: InternalApplicationOut): string {
  return [
    `Internal application (${a.employee_kind === "worker" ? "Worker" : "Employee"})`,
    statusLabel(a.status),
    a.manager_name ? `Manager: ${a.manager_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function InternalBadge({ app, size }: { app: InternalApplicationOut; size?: "small" | "medium" }) {
  const label = app.status === "approved" ? "Internal" : `Internal · ${statusLabel(app.status)}`;
  return (
    <Tooltip content={tooltipFor(app)} relationship="description">
      <Badge size={size} appearance="tint" color={app.status === "manager_approval" ? "warning" : "brand"} icon={<ArrowSwap16Regular />} tabIndex={0}>
        {label}
      </Badge>
    </Tooltip>
  );
}

/** Pipeline card badge: "Internal" + overlay status (one list query per Demand, shared by every card). */
export function InternalCardBadge({ applicationId, demandId }: { applicationId: string; demandId: string }) {
  const q = useDemandInternalApplications(demandId);
  const app = q.data?.find((a) => a.application_id === applicationId);
  if (!app) return null;
  return <InternalBadge app={app} size="small" />;
}

/** Application detail: "Internal" badge and, behind `mobility:transfer`, the "Confirm transfer" action. */
export function InternalApplicationActions({ applicationId }: { applicationId: string }) {
  const { canTransfer } = useMobilityPermissions();
  const q = useInternalApplication(applicationId);
  const [open, setOpen] = useState(false);
  const app = q.data;
  if (!app) return null;
  const transferable = canTransfer && app.status === "approved" && !app.transfer;
  return (
    <>
      <InternalBadge app={app} />
      {app.transfer && (
        <Badge appearance="tint" color="success">
          {`Transfer effective ${app.transfer.effective_date}`}
        </Badge>
      )}
      {transferable && (
        <Button icon={<ArrowSwap20Regular />} onClick={() => setOpen(true)}>
          Confirm transfer
        </Button>
      )}
      {open && <TransferDialog app={app} onClose={() => setOpen(false)} />}
    </>
  );
}
