"use client";

import { Button, Card, CardHeader, Field, Input, makeStyles, Subtitle2, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, IdSelect, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { RoleOut } from "@/lib/api/types";
import { commercialsApi, commercialsKeys } from "../api";
import type { ApprovalStep, CommercialsSettingsOut } from "../types";

const useStyles = makeStyles({ card: { padding: tokens.spacingHorizontalL, maxWidth: "640px", marginBottom: tokens.spacingVerticalL } });

const list = (v: string) =>
  v
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

function stepRole(steps: ApprovalStep[]): string | null {
  const s = steps[0];
  return s?.approver_kind === "role" && typeof s.approver_ref.role_id === "string" ? s.approver_ref.role_id : null;
}

/** `/settings/commercials`: renewal lead days, PO alert thresholds, expiry alert days and the approver role
 * of rate / PO exceptions (default: the Finance Admin role, else the Tenant Admin). */
export function CommercialsSettings() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canRead = usePermission("contract:read");
  const canWrite = usePermission("settings:manage");
  const settings = useQuery({ queryKey: commercialsKeys.settings, queryFn: ({ signal }) => commercialsApi.settings(signal), enabled: canRead });
  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: ({ signal }) => api.get<RoleOut[]>("/api/v1/admin/roles", { signal }), enabled: canWrite });
  const [form, setForm] = useState({ lead: "", thresholds: "", expiry: "", rateRole: null as string | null, poRole: null as string | null });
  const [seen, setSeen] = useState<CommercialsSettingsOut | undefined>(undefined);
  if (settings.data && settings.data !== seen) {
    const s = settings.data;
    setSeen(s);
    setForm({
      lead: s.contract_renewal_lead_days.join(", "),
      thresholds: s.po_alert_thresholds_pct.join(", "),
      expiry: String(s.po_expiry_alert_days),
      rateRole: stepRole(s.rate_exception_steps),
      poRole: stepRole(s.po_exception_steps),
    });
  }
  const step = (roleId: string | null): ApprovalStep[] =>
    roleId
      ? [{ name: "Finance approval", approver_kind: "role", approver_ref: { role_id: roleId } }]
      : [{ name: "Finance approval", approver_kind: "finance_role", approver_ref: { role_key: "finance_admin" } }];
  const save = useMutation({
    mutationFn: () =>
      commercialsApi.updateSettings({
        contract_renewal_lead_days: list(form.lead),
        po_alert_thresholds_pct: list(form.thresholds),
        po_expiry_alert_days: Number(form.expiry),
        rate_exception_steps: step(form.rateRole),
        po_exception_steps: step(form.poRole),
      }),
    onSuccess: async () => {
      toast.success("Commercial settings saved");
      await queryClient.invalidateQueries({ queryKey: commercialsKeys.settings });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!canRead) return <NoAccess what="commercial settings" />;
  if (settings.isPending) return <GridSkeleton rows={4} />;
  if (settings.isError) return <ErrorBar message={errorMessage(settings.error)} />;
  const roleOptions = (roles.data ?? []).map((r) => ({ id: r.id, label: r.name }));
  return (
    <>
      <PageHeader title="Commercial settings" subtitle="Contract renewals, PO alerts and who approves rate and PO exceptions" />
      <Card className={styles.card}>
        <CardHeader header={<Subtitle2 as="h2">Alerts</Subtitle2>} />
        <fieldset disabled={!canWrite} className={admin.form} style={{ border: 0, padding: 0, margin: 0 }}>
          <Field label="Contract renewal reminders (days before the end)" hint="Comma-separated, e.g. 60, 30">
            <Input value={form.lead} onChange={(_, d) => setForm((f) => ({ ...f, lead: d.value }))} />
          </Field>
          <Field label="PO consumption alerts (%)" hint="Comma-separated, e.g. 80, 100">
            <Input value={form.thresholds} onChange={(_, d) => setForm((f) => ({ ...f, thresholds: d.value }))} />
          </Field>
          <Field label="PO expiry alert (days before the end)">
            <Input type="number" value={form.expiry} onChange={(_, d) => setForm((f) => ({ ...f, expiry: d.value }))} />
          </Field>
        </fieldset>
      </Card>
      <Card className={styles.card}>
        <CardHeader header={<Subtitle2 as="h2">Exception approvers</Subtitle2>} />
        <IdSelect label="Rate exceptions" options={roleOptions} value={form.rateRole} noneLabel="Finance Admin (default)" disabled={!canWrite} onChange={(v) => setForm((f) => ({ ...f, rateRole: v }))} />
        <IdSelect label="PO exceptions" options={roleOptions} value={form.poRole} noneLabel="Finance Admin (default)" disabled={!canWrite} onChange={(v) => setForm((f) => ({ ...f, poRole: v }))} />
      </Card>
      {canWrite && (
        <Button appearance="primary" disabled={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      )}
    </>
  );
}
