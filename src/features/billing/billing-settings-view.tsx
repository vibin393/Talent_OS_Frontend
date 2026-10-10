"use client";

import {
  Button,
  Dropdown,
  Field,
  Input,
  Option,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import {
  ErrorBar,
  GridSkeleton,
  NoAccess,
  useAdminStyles,
} from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { billingApi, billingKeys } from "./api";
import { useBillingStyles } from "./components";
import type { BillingSettingsOut } from "./types";

/** `/settings/billing`: round-off, CN deadline, annexure, SAC codes and effective-dated GST rates. */
export function BillingSettingsView() {
  const admin = useAdminStyles();
  const s = useBillingStyles();
  const perms = usePermissions();
  const qc = useQueryClient();
  const canConfigure = hasAnyPermission(perms, ["billing:configure"]);
  const settings = useQuery({
    queryKey: billingKeys.settings,
    queryFn: ({ signal }) => billingApi.settings(signal),
    enabled: canConfigure,
  });
  const sac = useQuery({
    queryKey: billingKeys.sac,
    queryFn: ({ signal }) => billingApi.sacCodes(signal),
    enabled: canConfigure,
  });
  const rates = useQuery({
    queryKey: billingKeys.rates,
    queryFn: ({ signal }) => billingApi.taxRates(signal),
    enabled: canConfigure,
  });
  const save = useMutation({
    mutationFn: (b: Partial<BillingSettingsOut>) =>
      billingApi.updateSettings(b),
    onSuccess: (d) => qc.setQueryData(billingKeys.settings, d),
  });
  const addRate = useMutation({
    mutationFn: billingApi.addTaxRate,
    onSuccess: () => void qc.invalidateQueries({ queryKey: billingKeys.rates }),
  });
  const [rate, setRate] = useState({
    sac_code: "998513",
    rate_pct: "",
    effective_from: "",
  });
  if (!canConfigure) return <NoAccess what="billing settings" />;
  const st = settings.data;
  return (
    <>
      <PageHeader
        title="Billing"
        subtitle="GST invoicing settings, SAC codes and tax rates"
      />
      {(save.error || addRate.error) && (
        <ErrorBar message={errorMessage(save.error ?? addRate.error)} />
      )}
      {!st ? (
        <GridSkeleton rows={3} />
      ) : (
        <div className={s.card}>
          <div className={s.row}>
            <Field label="Round off">
              <Dropdown
                value={st.round_off_mode === "none" ? "None" : "Nearest rupee"}
                selectedOptions={[st.round_off_mode]}
                onOptionSelect={(_, d) =>
                  save.mutate({
                    round_off_mode:
                      d.optionValue as BillingSettingsOut["round_off_mode"],
                  })
                }
              >
                <Option value="none">None</Option>
                <Option value="nearest_rupee">Nearest rupee</Option>
              </Dropdown>
            </Field>
            <Field label="Credit-note GST deadline (MM-DD after FY end)">
              <Input
                defaultValue={st.cn_gst_deadline}
                onBlur={(e) =>
                  e.target.value !== st.cn_gst_deadline &&
                  save.mutate({ cn_gst_deadline: e.target.value })
                }
              />
            </Field>
            <Switch
              label="Timesheet annexure"
              checked={st.annexure_enabled}
              onChange={(_, d) => save.mutate({ annexure_enabled: d.checked })}
            />
          </div>
        </div>
      )}
      <h3 className={admin.sectionTitle}>SAC codes</h3>
      <div className={admin.surface}>
        <Table size="small" aria-label="SAC codes">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell>Default for</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sac.data ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.code}</TableCell>
                <TableCell>{c.description}</TableCell>
                <TableCell>
                  {c.default_for_line_kind.join(", ") || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <h3 className={admin.sectionTitle}>GST rates</h3>
      <div className={admin.toolbar}>
        <Field label="SAC">
          <Input
            value={rate.sac_code}
            onChange={(_, d) => setRate({ ...rate, sac_code: d.value })}
          />
        </Field>
        <Field label="Rate %">
          <Input
            value={rate.rate_pct}
            inputMode="decimal"
            onChange={(_, d) => setRate({ ...rate, rate_pct: d.value })}
          />
        </Field>
        <Field label="Effective from">
          <Input
            type="date"
            value={rate.effective_from}
            onChange={(_, d) => setRate({ ...rate, effective_from: d.value })}
          />
        </Field>
        <Button
          disabled={!rate.rate_pct || !rate.effective_from}
          onClick={() => addRate.mutate(rate)}
        >
          Add rate
        </Button>
      </div>
      <div className={admin.surface}>
        <Table size="small" aria-label="GST rates">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>SAC</TableHeaderCell>
              <TableHeaderCell>Rate</TableHeaderCell>
              <TableHeaderCell>From</TableHeaderCell>
              <TableHeaderCell>To</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rates.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.sac_code}</TableCell>
                <TableCell>{`${r.rate_pct}%`}</TableCell>
                <TableCell>{r.effective_from}</TableCell>
                <TableCell>{r.effective_to ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
