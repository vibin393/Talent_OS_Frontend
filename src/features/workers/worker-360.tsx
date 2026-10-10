"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Body1,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  Spinner,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Eye16Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, formatDateTime, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { WorkerCredentialsSection } from "@/features/compliance/worker-credentials-section";
import { placementKeys, placementsApi } from "@/features/placements/api";
import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/features/placements/format";
import { errorMessage } from "@/lib/api/errors";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalM },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center", flexWrap: "wrap" },
  value: { fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase500 },
});

/**
 * Unmask a PAN / bank number. The value is fetched on demand, shown in a `Dialog` only, and kept in component
 * state -- never in the query cache.
 */
function UnmaskButton({ candidateId, field, bankAccountId }: { candidateId: string; field: "pan" | "bank_account"; bankAccountId?: string }) {
  const styles = useStyles();
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reveal = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await placementsApi.unmask(candidateId, field, bankAccountId);
      setValue(out.value);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button size="small" icon={<Eye16Regular />} onClick={reveal} disabled={busy}>
        Unmask
      </Button>
      {error && <Text role="alert">{error}</Text>}
      <Dialog open={value !== null} onOpenChange={(_, d) => !d.open && setValue(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{field === "pan" ? "PAN" : "Bank account number"}</DialogTitle>
            <DialogContent>
              <Text className={styles.value}>{value}</Text>
              <Body1 block>This view was recorded in the audit log.</Body1>
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setValue(null)}>
                Close
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}

/** `/workers/[id]`: Worker 360 -- profile, placements, masked PAN / bank and registered sections. */
export function Worker360({ candidateId }: { candidateId: string }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const canRead = usePermission("worker:read");
  const canUnmask = usePermission("identity:view");
  const q = useQuery({ queryKey: placementKeys.worker(candidateId), queryFn: ({ signal }) => placementsApi.worker(candidateId, signal), enabled: canRead });
  if (!canRead) return <NoAccess what="workers" />;
  if (q.isPending) return <Spinner label="Loading worker" />;
  if (q.isError) return <ErrorBar message={errorMessage(q.error)} />;
  const w = q.data;
  const active = w.bank_accounts.find((b) => b.status === "active");
  const pending = w.bank_accounts.filter((b) => b.status === "pending_approval");
  return (
    <>
      <PageHeader title={w.full_name ?? "Worker"} subtitle={w.profile ? `Worker ID ${w.profile.worker_human_id}` : undefined} />
      <Card className={styles.card}>
        <dl className={admin.detailList}>
          <dt>Email</dt>
          <dd>{w.email ?? "—"}</dd>
          <dt>Emergency contact</dt>
          <dd>
            {[w.profile?.emergency_name, w.profile?.emergency_relation, w.profile?.emergency_phone].filter(Boolean).join(" · ") || "—"}
          </dd>
          <dt>PAN</dt>
          <dd className={styles.row}>
            {w.profile?.pan_last4 ? `•••••••${w.profile.pan_last4}` : "—"}
            {w.profile?.pan_status === "hr_checked" && <Badge appearance="tint" color="success">Checked</Badge>}
            {canUnmask && w.profile?.pan_last4 && <UnmaskButton candidateId={candidateId} field="pan" />}
          </dd>
          <dt>Bank account</dt>
          <dd className={styles.row}>
            {active ? `•••• ${active.account_number_last4} · ${active.ifsc}` : "—"}
            {canUnmask && active && <UnmaskButton candidateId={candidateId} field="bank_account" bankAccountId={active.id} />}
          </dd>
        </dl>
        {pending.length > 0 && (
          <Text>
            Bank change pending HR approval: ending {pending.map((b) => b.account_number_last4).join(", ")} (see{" "}
            <NextLink href="/approvals">Approvals</NextLink>)
          </Text>
        )}
      </Card>
      <Accordion multiple collapsible defaultOpenItems={["placements"]}>
        <AccordionItem value="placements">
          <AccordionHeader>Placements ({w.placements.length})</AccordionHeader>
          <AccordionPanel>
            <ul>
              {w.placements.map((p) => (
                <li key={p.id} className={styles.row}>
                  <NextLink href={`/placements/${p.id}`}>{p.human_id}</NextLink> {p.client_name ?? ""} · {formatDate(p.actual_start_date ?? p.planned_start_date)}
                  <Badge appearance="tint" color={STATUS_COLORS[p.status]}>
                    {STATUS_LABELS[p.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem value="bank">
          <AccordionHeader>Bank details history</AccordionHeader>
          <AccordionPanel>
            <ul>
              {w.bank_accounts.map((b) => (
                <li key={b.id}>
                  •••• {b.account_number_last4} · {b.ifsc} · {b.status.replace("_", " ")} · {formatDateTime(b.created_at)}
                </li>
              ))}
            </ul>
          </AccordionPanel>
        </AccordionItem>
        {Object.entries(w.sections).map(([key, value]) => (
          <AccordionItem key={key} value={key}>
            <AccordionHeader>{key.replace(/_/g, " ")}</AccordionHeader>
            <AccordionPanel>
              {key === "credentials" ? <WorkerCredentialsSection candidateId={candidateId} /> : <pre>{JSON.stringify(value, null, 2)}</pre>}
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
}
