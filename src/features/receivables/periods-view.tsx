"use client";

import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  makeStyles,
  mergeClasses,
  OverlayDrawer,
  SpinButton,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular, LockClosed20Regular, LockOpen20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { receivablesApi, receivablesKeys } from "./api";
import { LegalEntitySelect, useRcvStyles } from "./components";
import { closeGate, MONTHS, newIdempotencyKey } from "./logic";
import type { PeriodOut } from "./types";

const useStyles = makeStyles({
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: tokens.spacingHorizontalM },
  month: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  closed: { backgroundColor: tokens.colorNeutralBackground3 },
  blocker: { color: tokens.colorPaletteRedForeground1 },
});

/** Accounting periods (`/finance/periods`): month grid per Legal Entity, close drawer with the checklist (blockers
 * refuse, warnings need acknowledgement) and ★ confirm; reopen request dialog with a reason. */
export function PeriodsView() {
  const s = useRcvStyles();
  const st = useStyles();
  const perms = usePermissions();
  const allowed = hasAnyPermission(perms, ["receivables:read", "period:close"]);
  const [le, setLe] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [closing, setClosing] = useState<PeriodOut | null>(null);
  const [reopening, setReopening] = useState<PeriodOut | null>(null);
  const q = useQuery({
    queryKey: receivablesKeys.periods(le ?? "", year),
    queryFn: ({ signal }) => receivablesApi.periods(le!, year, signal),
    enabled: allowed && !!le,
  });
  if (!allowed) return <NoAccess what="accounting periods" />;
  return (
    <div className={s.page}>
      <PageHeader title="Accounting periods" subtitle="Month-end close and reopen requests" />
      <div className={s.row}>
        <LegalEntitySelect value={le} onChange={setLe} />
        <Field label="Year">
          <SpinButton value={year} min={2000} max={2100} onChange={(_, d) => d.value != null && setYear(d.value)} />
        </Field>
      </div>
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      {!q.data ? (
        <GridSkeleton />
      ) : q.data.length === 0 ? (
        <Text className={s.muted}>No periods for {year}.</Text>
      ) : (
        <div className={st.grid}>
          {q.data.map((p) => (
            <div key={p.id} className={mergeClasses(st.month, p.status === "closed" && st.closed)}>
              <Text weight="semibold">
                {MONTHS[p.month - 1]} {p.year}
              </Text>
              <div className={s.row}>
                <Badge appearance="filled" color={p.status === "closed" ? "informative" : "success"}>
                  {p.status}
                </Badge>
                {p.pending_reopen && <Badge color="warning">reopen pending</Badge>}
                {p.reopened_count > 0 && <Badge appearance="outline">reopened {p.reopened_count}x</Badge>}
              </div>
              {p.status === "open" && hasAnyPermission(perms, ["period:close"]) && (
                <Button size="small" icon={<LockClosed20Regular />} onClick={() => setClosing(p)}>
                  Close
                </Button>
              )}
              {p.status === "closed" && !p.pending_reopen && hasAnyPermission(perms, ["period:reopen"]) && (
                <Button size="small" icon={<LockOpen20Regular />} onClick={() => setReopening(p)}>
                  Request reopen
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {closing && <CloseDrawer period={closing} onClose={() => setClosing(null)} />}
      {reopening && <ReopenDialog period={reopening} onClose={() => setReopening(null)} />}
    </div>
  );
}

function CloseDrawer({ period, onClose }: { period: PeriodOut; onClose: () => void }) {
  const s = useRcvStyles();
  const st = useStyles();
  const qc = useQueryClient();
  const [key] = useState(newIdempotencyKey);
  const [acks, setAcks] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const checks = useQuery({ queryKey: receivablesKeys.checklist(period.id), queryFn: ({ signal }) => receivablesApi.checklist(period.id, signal) });
  const gate = closeGate(checks.data ?? [], acks);
  const m = useMutation({
    mutationFn: () => receivablesApi.closePeriod(period.id, [...acks], key),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: receivablesKeys.all });
      onClose();
    },
  });
  return (
    <OverlayDrawer open onOpenChange={(_, d) => !d.open && onClose()} position="end" size="medium">
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>
          Close {MONTHS[period.month - 1]} {period.year}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        {!checks.data ? (
          <GridSkeleton rows={4} />
        ) : (
          <div className={s.stack}>
            {checks.data.map((c) => (
              <div key={c.name} className={s.card}>
                <div className={s.row}>
                  <Badge color={c.count === 0 ? "success" : c.severity === "blocker" ? "danger" : "warning"}>{c.count === 0 ? "ok" : c.severity}</Badge>
                  <Text className={mergeClasses(c.severity === "blocker" && c.count > 0 && st.blocker)}>
                    {c.label} ({c.count})
                  </Text>
                  {c.link_path && c.count > 0 && (
                    <a href={c.link_path} target="_blank" rel="noreferrer">
                      View items
                    </a>
                  )}
                </div>
                {c.severity === "warning" && c.count > 0 && (
                  <Checkbox
                    label="I acknowledge this warning"
                    checked={acks.has(c.name)}
                    onChange={(_, d) =>
                      setAcks((prev) => {
                        const next = new Set(prev);
                        if (d.checked) next.add(c.name);
                        else next.delete(c.name);
                        return next;
                      })
                    }
                  />
                )}
              </div>
            ))}
            <ErrorBar message={m.error ? errorMessage(m.error) : null} />
          </div>
        )}
      </DrawerBody>
      <DrawerFooter>
        <Button appearance="primary" disabled={!gate.canClose || m.isPending} onClick={() => setConfirm(true)}>
          Close period
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </DrawerFooter>
      <Dialog open={confirm} onOpenChange={(_, d) => setConfirm(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Close the period?</DialogTitle>
            <DialogContent>Nothing can be posted into a closed month. Reopening needs approval.</DialogContent>
            <DialogActions>
              <Button
                appearance="primary"
                onClick={() => {
                  setConfirm(false);
                  m.mutate();
                }}
              >
                Close period
              </Button>
              <Button onClick={() => setConfirm(false)}>Cancel</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </OverlayDrawer>
  );
}

function ReopenDialog({ period, onClose }: { period: PeriodOut; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => receivablesApi.requestReopen(period.id, reason.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: receivablesKeys.all });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            Request reopen of {MONTHS[period.month - 1]} {period.year}
          </DialogTitle>
          <DialogContent>
            <Field label="Reason" required>
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
            <ErrorBar message={m.error ? errorMessage(m.error) : null} />
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={!reason.trim() || m.isPending} onClick={() => m.mutate()}>
              Request
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
