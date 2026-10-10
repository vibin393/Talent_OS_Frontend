"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Subtitle2,
  type TableColumnDefinition,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { type RecordingPolicyRule, recordingPolicyApi, recordingPolicyKeys } from "./api";
import { type RecordingRule, RULE_LABELS, ruleLabel, UNLISTED_CAPTION } from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  test: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: tokens.spacingHorizontalM, padding: tokens.spacingHorizontalM },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  actions: { display: "flex", gap: tokens.spacingHorizontalS },
});

/** `/settings/recording-policy` (permission `ai:agent_configure`). */
export function RecordingPolicyPage() {
  const styles = useStyles();
  const canConfigure = usePermission("ai:agent_configure");
  const toast = useAppToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: recordingPolicyKeys.all, queryFn: ({ signal }) => recordingPolicyApi.list(signal), enabled: canConfigure });
  const [editing, setEditing] = useState<RecordingPolicyRule | "new" | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => recordingPolicyApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: recordingPolicyKeys.all });
      toast.success("Jurisdiction removed.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: TableColumnDefinition<RecordingPolicyRule>[] = [
    createTableColumn({ columnId: "country", renderHeaderCell: () => "Country", renderCell: (r) => r.country }),
    createTableColumn({ columnId: "region", renderHeaderCell: () => "State/region", renderCell: (r) => r.region ?? "All" }),
    createTableColumn({ columnId: "rule", renderHeaderCell: () => "Rule", renderCell: (r) => ruleLabel(r.rule) }),
    createTableColumn({ columnId: "note", renderHeaderCell: () => "Note", renderCell: (r) => r.note ?? "" }),
    createTableColumn({ columnId: "updated_by", renderHeaderCell: () => "Updated by", renderCell: (r) => r.updated_by_name ?? "System" }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (r) => (
        <div className={styles.actions}>
          <Button size="small" onClick={() => setEditing(r)}>
            Edit
          </Button>
          <Button size="small" disabled={remove.isPending} onClick={() => remove.mutate(r.id)}>
            Delete
          </Button>
        </div>
      ),
    }),
  ];
  if (!canConfigure)
    return (
      <>
        <PageHeader title="Recording policy" />
        <NoAccess what="the recording policy" />
      </>
    );
  return (
    <div className={styles.root}>
      <PageHeader title="Recording policy" subtitle="Where screening calls and interviews may be recorded." />
      <div>
        <Button appearance="primary" onClick={() => setEditing("new")}>
          Add jurisdiction
        </Button>
      </div>
      <MessageBar intent="warning">
        <MessageBarBody>Your organisation and its counsel are responsible for these rules. Talent OS enforces consent and the rule you set.</MessageBarBody>
      </MessageBar>
      <AdminGrid
        items={q.data}
        columns={columns}
        getRowId={(r) => r.id}
        loading={q.isPending}
        error={q.error}
        emptyText="No jurisdictions yet."
        label="Recording policy"
      />
      <Caption1>{UNLISTED_CAPTION}</Caption1>
      <TestLocation />
      {editing && <RuleDrawer rule={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TestLocation() {
  const styles = useStyles();
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const test = useMutation({ mutationFn: () => recordingPolicyApi.evaluate(country, region) });
  return (
    <Card>
      <Subtitle2>Test a location</Subtitle2>
      <div className={styles.test}>
        <Field label="Country">
          <Input value={country} onChange={(_, d) => setCountry(d.value)} />
        </Field>
        <Field label="State">
          <Input value={region} onChange={(_, d) => setRegion(d.value)} />
        </Field>
        <Button disabled={!country.trim() || test.isPending} onClick={() => test.mutate()}>
          Test
        </Button>
      </div>
      {test.data && (
        <Body1 role="status">
          {test.data.jurisdiction ?? "Unknown location"}: {ruleLabel(test.data.rule)}
        </Body1>
      )}
      <ErrorBar message={test.error ? errorMessage(test.error) : null} />
    </Card>
  );
}

function RuleDrawer({ rule, onClose }: { rule: RecordingPolicyRule | null; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [country, setCountry] = useState(rule?.country ?? "");
  const [region, setRegion] = useState(rule?.region ?? "");
  const [value, setValue] = useState<RecordingRule>(rule?.rule ?? "candidate_consent");
  const [note, setNote] = useState(rule?.note ?? "");
  const save = useMutation({
    mutationFn: () => {
      const body = { country, region: region.trim() || null, rule: value, note: note.trim() || null };
      return rule ? recordingPolicyApi.update(rule.id, body) : recordingPolicyApi.upsert(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: recordingPolicyKeys.all });
      toast.success("Recording policy saved.");
      onClose();
    },
  });
  return (
    <DetailsDrawer
      open
      onClose={onClose}
      title={rule ? "Edit jurisdiction" : "Add jurisdiction"}
      footer={
        <Button appearance="primary" disabled={!country.trim() || save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      }
    >
      <div className={styles.body}>
        <ErrorBar message={save.error ? errorMessage(save.error) : null} />
        <Field label="Country" required hint="Two-letter code, for example IN">
          <Input value={country} onChange={(_, d) => setCountry(d.value)} />
        </Field>
        <Field label="State/region" hint="Leave empty for the whole country">
          <Input value={region} onChange={(_, d) => setRegion(d.value)} />
        </Field>
        <Field label="Rule" required>
          <Dropdown value={RULE_LABELS[value]} selectedOptions={[value]} onOptionSelect={(_, d) => setValue((d.optionValue as RecordingRule) ?? value)}>
            {(Object.keys(RULE_LABELS) as RecordingRule[]).map((k) => (
              <Option key={k} value={k}>
                {RULE_LABELS[k]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Note">
          <Textarea value={note} onChange={(_, d) => setNote(d.value)} />
        </Field>
      </div>
    </DetailsDrawer>
  );
}
