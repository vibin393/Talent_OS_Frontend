"use client";

import { Button, makeStyles, MessageBar, MessageBarBody, Spinner, SpinButton, Switch, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { type LedgerSettings, ledgerApi, ledgerKeys } from "./api";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "640px" },
  field: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
});

/** `/settings/ledger`: auto-push, payment push, the pull cadence and the suggestion-stale window. */
export function LedgerSettingsPage() {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const q = useQuery({ queryKey: ledgerKeys.settings, queryFn: ({ signal }) => ledgerApi.settings(signal) });
  const [draft, setDraft] = useState<LedgerSettings | null>(null);
  useEffect(() => {
    if (q.data) setDraft(q.data);
  }, [q.data]);

  const save = useMutation({
    mutationFn: (body: LedgerSettings) => ledgerApi.saveSettings(body),
    onSuccess: (d) => {
      setDraft(d);
      void qc.invalidateQueries({ queryKey: ledgerKeys.settings });
      toast.success("Ledger settings saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isPending || !draft) return <Spinner label="Loading" />;
  if (q.error) return <MessageBar intent="error"><MessageBarBody>{errorMessage(q.error)}</MessageBarBody></MessageBar>;

  return (
    <div className={styles.root}>
      <PageHeader title="Ledger sync" subtitle="How documents and payments flow to and from your accounting system." />
      <Switch label="Push documents automatically when issued" checked={draft.auto_push_on_issue} onChange={(_, d) => setDraft({ ...draft, auto_push_on_issue: d.checked })} />
      <Switch label="Push payments recorded in Talent OS" checked={draft.push_payments} onChange={(_, d) => setDraft({ ...draft, push_payments: d.checked })} />
      <div className={styles.field}>
        <label htmlFor="pull-mins">Check for new payments every (minutes)</label>
        <SpinButton
          id="pull-mins"
          min={30}
          max={1440}
          value={draft.pull_payments_every_minutes}
          onChange={(_, d) => d.value != null && setDraft({ ...draft, pull_payments_every_minutes: d.value })}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="stale-days">Mark suggestions stale after (days)</label>
        <SpinButton id="stale-days" min={1} max={365} value={draft.suggestion_stale_days} onChange={(_, d) => d.value != null && setDraft({ ...draft, suggestion_stale_days: d.value })} />
      </div>
      <div>
        <Button appearance="primary" disabled={save.isPending} onClick={() => save.mutate(draft)}>
          Save
        </Button>
      </div>
    </div>
  );
}
