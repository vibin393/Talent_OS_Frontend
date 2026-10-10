"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircle16Filled, Circle16Regular, DismissCircle16Filled, Warning16Filled } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { complianceApi, complianceKeys } from "./api";
import { ITEM_KIND_LABELS, itemBadge, waiveReasonError } from "./logic";
import type { ChecklistItem } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  label: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  ok: { color: tokens.colorPaletteGreenForeground1 },
  bad: { color: tokens.colorPaletteRedForeground1 },
  warn: { color: tokens.colorPaletteMarigoldForeground1 },
});

function StatusIcon({ status }: { status: ChecklistItem["status"] }) {
  const s = useStyles();
  if (status === "met" || status === "waived") return <CheckmarkCircle16Filled className={s.ok} aria-hidden />;
  if (status === "expired" || status === "missing") return <DismissCircle16Filled className={s.bad} aria-hidden />;
  if (status === "expiring") return <Warning16Filled className={s.warn} aria-hidden />;
  return <Circle16Regular aria-hidden />;
}

function WaiveDialog({ placementId, item, onClose }: { placementId: string; item: ChecklistItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const err = waiveReasonError(reason);
  const m = useMutation({
    mutationFn: () => complianceApi.waive(placementId, item.id, reason.trim()),
    onSuccess: (out) => {
      qc.setQueryData(complianceKeys.placement(placementId), out);
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Waive “{item.label}”</DialogTitle>
          <DialogContent>
            <Field label="Reason" required validationMessage={touched ? err ?? undefined : undefined}>
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} onBlur={() => setTouched(true)} />
            </Field>
            {m.isError && <ErrorBar message={errorMessage(m.error)} />}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={m.isPending}
              onClick={() => {
                setTouched(true);
                if (!err) m.mutate();
              }}
            >
              Waive
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Placement "Compliance" tab: the checklist with status icons, waiver and links to the credentials. */
export function PlacementComplianceTab({ placementId, candidateId }: { placementId: string; candidateId?: string }) {
  const s = useStyles();
  const canWaive = usePermission("compliance:waive");
  const [waiving, setWaiving] = useState<ChecklistItem | null>(null);
  const q = useQuery({ queryKey: complianceKeys.placement(placementId), queryFn: ({ signal }) => complianceApi.placement(placementId, signal) });
  if (q.isPending) return <Body1>Loading…</Body1>;
  if (q.isError) return <ErrorBar message={errorMessage(q.error)} />;
  const c = q.data;
  return (
    <div className={s.root}>
      {c.blocking ? (
        <MessageBar intent="error">
          <MessageBarBody>Blocking: a mandatory item is expired or missing. Extensions wait until it is renewed or waived. Timesheets are never blocked.</MessageBarBody>
        </MessageBar>
      ) : c.non_compliant ? (
        <MessageBar intent="warning">
          <MessageBarBody>Non-compliant because of a requirement added after the placement started. It does not block.</MessageBarBody>
        </MessageBar>
      ) : null}
      {c.items.length === 0 ? (
        <Body1>No compliance requirement applies to this placement.</Body1>
      ) : (
        <Table aria-label="Compliance checklist" size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Item</TableHeaderCell>
              <TableHeaderCell>Kind</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Requirement</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {c.items.map((it) => {
              const b = itemBadge(it.status);
              return (
                <TableRow key={it.id}>
                  <TableCell>
                    <span className={s.label}>
                      <StatusIcon status={it.status} />
                      {it.label}
                      {!it.mandatory && <Caption1>(optional)</Caption1>}
                      {it.retroactive && (
                        <Badge appearance="outline" color="informative">
                          New requirement
                        </Badge>
                      )}
                      {it.unresolved && (
                        <Badge appearance="outline" color="danger">
                          Unresolved
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{ITEM_KIND_LABELS[it.kind]}</TableCell>
                  <TableCell>
                    <Badge appearance="tint" color={b.color}>
                      {b.label}
                    </Badge>
                    {it.waived_reason && <Caption1> {it.waived_reason}</Caption1>}
                  </TableCell>
                  <TableCell>{it.requirement_names.join(", ")}</TableCell>
                  <TableCell>
                    {it.kind === "credential" && candidateId && (
                      <a href={`/compliance/credentials?candidate_id=${candidateId}`}>Credentials</a>
                    )}{" "}
                    {canWaive && it.status !== "waived" && it.status !== "met" && (
                      <Button size="small" onClick={() => setWaiving(it)}>
                        Waive
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {waiving && <WaiveDialog placementId={placementId} item={waiving} onClose={() => setWaiving(null)} />}
    </div>
  );
}
