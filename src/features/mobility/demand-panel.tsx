"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  createTableColumn,
  Field,
  Input,
  makeStyles,
  Spinner,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime } from "@/features/admin/ui";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { mobilityApi } from "./api";
import { MobilityStatusBadge } from "./board/shared";
import { type RulesForm, rulesFormErrors, rulesFromForm, rulesToForm } from "./logic";
import type { InternalApplicationOut, OpeningRulesOut } from "./types";
import { mobilityKeys, useDemandInternalApplications, useMobilityPermissions, useOpeningRules } from "./use-mobility";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground3 },
});

const VISIBILITY_LABELS: Record<string, string> = {
  internal: "Internal only",
  both: "Internal and external",
  external: "External only",
};

/** Demand page "Internal mobility" tab: visibility (read-only), eligibility rules, internal applications. */
export function DemandMobilityPanel({ demandId }: { demandId: string }) {
  const styles = useStyles();
  const { canManage } = useMobilityPermissions();
  const rules = useOpeningRules(demandId, canManage);
  const apps = useDemandInternalApplications(demandId);

  const columns: TableColumnDefinition<InternalApplicationOut>[] = [
    createTableColumn({
      columnId: "candidate",
      renderHeaderCell: () => "Employee",
      renderCell: (a) => (
        <div>
          <Text weight="semibold">{a.candidate_name ?? "—"}</Text>
          <br />
          <Text size={200} className={styles.muted}>
            {a.employee_kind === "worker" ? "Worker" : "Employee"}
            {a.application_human_id ? ` · ${a.application_human_id}` : ""}
          </Text>
        </div>
      ),
    }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (a) => <MobilityStatusBadge status={a.status} /> }),
    createTableColumn({ columnId: "manager", renderHeaderCell: () => "Manager", renderCell: (a) => a.manager_name ?? "—" }),
    createTableColumn({ columnId: "reason", renderHeaderCell: () => "Reason", renderCell: (a) => a.rejection_reason ?? "—" }),
    createTableColumn({ columnId: "submitted", renderHeaderCell: () => "Applied", renderCell: (a) => formatDateTime(a.submitted_at) }),
  ];

  return (
    <div className={styles.root}>
      {canManage && (
        <Card className={styles.card}>
          <Subtitle2 as="h2">Visibility and eligibility</Subtitle2>
          {rules.isPending ? (
            <Spinner size="tiny" label="Loading rules" />
          ) : rules.isError ? (
            <Body1 role="alert">{errorMessage(rules.error, "Could not load the eligibility rules.")}</Body1>
          ) : (
            <RulesEditor key={rules.dataUpdatedAt} demandId={demandId} rules={rules.data} />
          )}
        </Card>
      )}
      <section aria-labelledby="mobility-apps">
        <Subtitle2 as="h2" id="mobility-apps">
          Internal applications
        </Subtitle2>
        <AdminGrid
          items={apps.data}
          columns={columns}
          getRowId={(a) => a.id}
          loading={apps.isPending && apps.fetchStatus !== "idle"}
          error={apps.error}
          emptyText="No internal applications for this demand yet."
          label="Internal applications"
        />
      </section>
    </div>
  );
}

function RulesEditor({ demandId, rules }: { demandId: string; rules: OpeningRulesOut }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [form, setForm] = useState<RulesForm>(() => rulesToForm(rules));
  const errors = rulesFormErrors(form);
  const save = useMutation({
    mutationFn: () => mobilityApi.putRules(demandId, rulesFromForm(form, rules.business_unit_ids)),
    onSuccess: (out) => {
      qc.setQueryData(mobilityKeys.rules(demandId), out);
      toast.success("Eligibility rules saved.");
    },
    onError: (e) => toast.error(errorMessage(e, "Could not save the rules.")),
  });
  const server = fieldErrors(save.error);
  const set = (k: keyof RulesForm) => (_: unknown, d: { value: string }) => setForm((f) => ({ ...f, [k]: d.value }));

  return (
    <form
      className={styles.card}
      style={{ padding: 0 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (Object.keys(errors).length === 0) save.mutate();
      }}
    >
      <div className={styles.row}>
        <Text>Visibility:</Text>
        <Badge appearance="tint" color={rules.visibility === "external" ? "subtle" : "brand"}>
          {VISIBILITY_LABELS[rules.visibility] ?? rules.visibility}
        </Badge>
        <Badge appearance="outline" color={rules.on_board ? "success" : "subtle"}>
          {rules.on_board ? "On the internal board" : "Not on the internal board"}
        </Badge>
      </div>
      <Text size={200} className={styles.muted}>
        Visibility is set on the Demand form. Leave a rule empty to apply no restriction (the default minimum tenure from settings still applies).
      </Text>
      <div className={styles.grid}>
        <Field
          label="Minimum tenure (months)"
          validationState={errors.minTenure || server.min_tenure_months ? "error" : "none"}
          validationMessage={errors.minTenure ?? server.min_tenure_months}
        >
          <Input type="number" min={0} max={600} value={form.minTenure} onChange={set("minTenure")} />
        </Field>
        <Field label="Grades" hint="Comma-separated, e.g. L3, L4" validationMessage={server.grades}>
          <Input value={form.grades} onChange={set("grades")} />
        </Field>
        <Field label="Locations" hint="Comma-separated" validationMessage={server.locations}>
          <Input value={form.locations} onChange={set("locations")} />
        </Field>
      </div>
      <Field label="Note" validationState={errors.note ? "error" : "none"} validationMessage={errors.note}>
        <Textarea value={form.note} maxLength={2000} resize="vertical" onChange={set("note")} />
      </Field>
      <div>
        <Button type="submit" appearance="primary" disabled={save.isPending || Object.keys(errors).length > 0}>
          {save.isPending ? "Saving…" : "Save rules"}
        </Button>
      </div>
    </form>
  );
}
