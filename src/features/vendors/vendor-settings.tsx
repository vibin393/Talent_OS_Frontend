"use client";

import { Button, Checkbox, Field, Input, makeStyles, SpinButton, Subtitle2, Switch, Text, tokens } from "@fluentui/react-components";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import type { VendorSettingsOut } from "./types";
import { useVendorMutations, useVendorSettings } from "./use-vendors";

const useStyles = makeStyles({
  labels: { display: "grid", gridTemplateColumns: "minmax(140px, max-content) minmax(180px, 320px)", gap: tokens.spacingVerticalS, alignItems: "center" },
});

const DOC_KINDS = ["agreement", "registration", "insurance", "other"];

/** `/admin/vendors`: vendor settings (ownership window, duplicate window, grace, mandatory documents, labels). */
export function VendorSettingsPanel() {
  const canRead = usePermission("vendor:read");
  const canWrite = usePermission("vendor:write");
  const q = useVendorSettings();
  if (!canRead) return <NoAccess what="vendor settings" />;
  if (q.error) return <ErrorBar message={errorMessage(q.error)} />;
  if (!q.data) return <GridSkeleton />;
  return <SettingsForm initial={q.data} canWrite={canWrite} />;
}

function SettingsForm({ initial, canWrite }: { initial: VendorSettingsOut; canWrite: boolean }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const toast = useAppToast();
  const { updateSettings } = useVendorMutations();
  const [draft, setDraft] = useState<VendorSettingsOut>(initial);
  const set = <K extends keyof VendorSettingsOut>(k: K, v: VendorSettingsOut[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const num = (k: "ownership_window_days" | "duplicate_activity_months" | "suspension_grace_days" | "notice_link_days", label: string, max: number) => (
    <Field label={label}>
      <SpinButton value={draft[k]} min={0} max={max} disabled={!canWrite} onChange={(_, d) => set(k, d.value ?? Number(d.displayValue) ?? draft[k])} />
    </Field>
  );
  const save = async () => {
    try {
      await updateSettings.mutateAsync(draft);
      toast.success("Vendor settings saved");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      <PageHeader title="Vendor settings" subtitle="Ownership, duplicates, documents and the progress labels vendors see." />
      <div className={admin.form}>
        {num("ownership_window_days", "Candidate ownership window (days)", 730)}
        {num("duplicate_activity_months", "Duplicate if active in the last (months)", 60)}
        {num("suspension_grace_days", "Suspend after a mandatory document expired for (days)", 365)}
        {num("notice_link_days", "Candidate notice link valid for (days)", 365)}
        <Field label="Mandatory documents">
          {DOC_KINDS.map((k) => (
            <Checkbox
              key={k}
              label={k}
              disabled={!canWrite}
              checked={draft.mandatory_document_kinds.includes(k)}
              onChange={(_, d) =>
                set("mandatory_document_kinds", d.checked ? [...draft.mandatory_document_kinds, k] : draft.mandatory_document_kinds.filter((x) => x !== k))
              }
            />
          ))}
        </Field>
        <Switch
          label="Share scorecards with vendors"
          disabled={!canWrite}
          checked={draft.scorecard_visible_to_vendor}
          onChange={(_, d) => set("scorecard_visible_to_vendor", d.checked)}
        />
        <Switch
          label="Require a bench review before releasing to vendors"
          disabled={!canWrite}
          checked={draft.require_bench_review_for_vendor_release}
          onChange={(_, d) => set("require_bench_review_for_vendor_release", d.checked)}
        />
        <Subtitle2 as="h2">Labels vendors see</Subtitle2>
        <div className={styles.labels}>
          {Object.entries(draft.vendor_labels).map(([key, label]) => (
            <div key={key} style={{ display: "contents" }}>
              <Text>{key}</Text>
              <Input
                aria-label={`Label for ${key}`}
                value={label}
                disabled={!canWrite}
                maxLength={60}
                onChange={(_, d) => set("vendor_labels", { ...draft.vendor_labels, [key]: d.value })}
              />
            </div>
          ))}
        </div>
        {canWrite && (
          <div className={admin.footer}>
            <Button appearance="primary" disabled={updateSettings.isPending} onClick={save}>
              Save
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
