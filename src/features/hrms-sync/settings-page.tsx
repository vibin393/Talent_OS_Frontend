"use client";

import {
  Button,
  Checkbox,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Switch,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { hrmsApi, type HrmsSettings, hrmsKeys } from "./api";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "640px" },
  group: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
});

/** `/settings/hrms`: which workers and events push, and when the daily status pull runs. */
export function HrmsSettingsPage() {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const q = useQuery({ queryKey: hrmsKeys.settings, queryFn: ({ signal }) => hrmsApi.settings(signal) });
  const [draft, setDraft] = useState<HrmsSettings | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed local state from fetched/client-only data
    if (q.data) setDraft(q.data);
  }, [q.data]);

  const save = useMutation({
    mutationFn: (body: HrmsSettings) => hrmsApi.saveSettings(body),
    onSuccess: (d) => {
      setDraft(d);
      void qc.invalidateQueries({ queryKey: hrmsKeys.settings });
      toast.success("HRMS settings saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isPending || !draft) return <Spinner label="Loading" />;
  if (q.error) return <MessageBar intent="error"><MessageBarBody>{errorMessage(q.error)}</MessageBarBody></MessageBar>;

  const hasType = (t: string) => draft.push_worker_types.includes(t);
  const toggleType = (t: string, on: boolean) =>
    setDraft({ ...draft, push_worker_types: on ? [...new Set([...draft.push_worker_types, t])] : draft.push_worker_types.filter((x) => x !== t) });

  return (
    <div className={styles.root}>
      <PageHeader title="HRMS sync" subtitle="Choose which workers and changes are pushed to your HR system." />
      <Field label="Push these worker types">
        <div className={styles.group}>
          <Checkbox label="Employees" checked={hasType("employee")} onChange={(_, d) => toggleType("employee", Boolean(d.checked))} />
          <Checkbox label="Contractors on our payroll" checked={hasType("contractor")} onChange={(_, d) => toggleType("contractor", Boolean(d.checked))} />
        </div>
      </Field>
      <Switch label="Push new hires when they join" checked={draft.push_on_join} onChange={(_, d) => setDraft({ ...draft, push_on_join: d.checked })} />
      <Switch label="Push changes" checked={draft.push_changes} onChange={(_, d) => setDraft({ ...draft, push_changes: d.checked })} />
      <Switch label="Push exits" checked={draft.push_exits} onChange={(_, d) => setDraft({ ...draft, push_exits: d.checked })} />
      <Field label="Check HRMS status daily at">
        <Dropdown
          value={`${String(draft.pull_hour_ist).padStart(2, "0")}:00 IST`}
          selectedOptions={[String(draft.pull_hour_ist)]}
          onOptionSelect={(_, d) => d.optionValue && setDraft({ ...draft, pull_hour_ist: Number(d.optionValue) })}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <Option key={h} value={String(h)}>
              {`${String(h).padStart(2, "0")}:00 IST`}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <div>
        <Button appearance="primary" disabled={save.isPending} onClick={() => save.mutate(draft)}>
          Save
        </Button>
      </div>
    </div>
  );
}
