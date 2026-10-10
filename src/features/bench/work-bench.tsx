"use client";

import { Badge, Body1, Button, Card, Field, Input, makeStyles, MessageBar, MessageBarBody, Text, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { errorMessage } from "@/lib/api/errors";
import { benchKeys, workBenchApi } from "./api";
import { BENCH_STATUS_COLORS, BENCH_STATUS_LABELS, formatDate, optInErrors, parseLocations, todayIso } from "./format";
import type { OptInIn } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

/** `/portal/work/bench`: the Worker's bench status, contractor opt-in and opt-out. Mobile-first; never shows cost. */
export function WorkBench() {
  const portal = usePortalStyles();
  const styles = useStyles();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: benchKeys.worker, queryFn: ({ signal }) => workBenchApi.state(signal), retry: false });
  const [form, setForm] = useState<OptInIn>({ available_from: todayIso(), work_authorization: "", preferred_locations: [] });
  const [locations, setLocations] = useState("");
  const [confirmOut, setConfirmOut] = useState(false);
  const done = () => void qc.invalidateQueries({ queryKey: benchKeys.worker });
  const optIn = useMutation({ mutationFn: (body: OptInIn) => workBenchApi.optIn(body), onSuccess: done });
  const optOut = useMutation({ mutationFn: () => workBenchApi.optOut(), onSuccess: () => { setConfirmOut(false); done(); } });
  if (q.isPending) return <LoadingBlock label="Loading your bench status" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  const state = q.data;
  const body: OptInIn = { ...form, work_authorization: form.work_authorization?.trim() || null, preferred_locations: parseLocations(locations) };
  const errors = optInErrors(body, todayIso());
  return (
    <div className={portal.page}>
      <PortalPageHeader title="Bench" subtitle="Let us know you are available for your next assignment." />
      {state.entry ? (
        <Card className={portal.card}>
          <Text weight="semibold">You are on the bench</Text>
          <Badge appearance="tint" color={BENCH_STATUS_COLORS[state.entry.status]}>
            {BENCH_STATUS_LABELS[state.entry.status]}
          </Badge>
          <dl className={portal.dl}>
            <dt>Available from</dt>
            <dd>{formatDate(state.entry.available_from)}</dd>
            <dt>Work authorization</dt>
            <dd>{state.entry.work_authorization ?? "—"}</dd>
            <dt>Preferred locations</dt>
            <dd>{state.entry.preferred_locations.join(", ") || "—"}</dd>
          </dl>
          {state.can_opt_out && !confirmOut && (
            <Button onClick={() => setConfirmOut(true)}>I am no longer available</Button>
          )}
          {confirmOut && (
            <MessageBar intent="warning">
              <MessageBarBody>
                Remove yourself from the bench? Recruiters will stop proposing you.
                <div className={styles.actions}>
                  <Button appearance="primary" size="small" disabled={optOut.isPending} onClick={() => optOut.mutate()}>
                    Yes, remove me
                  </Button>
                  <Button size="small" onClick={() => setConfirmOut(false)}>
                    Cancel
                  </Button>
                </div>
              </MessageBarBody>
            </MessageBar>
          )}
          <InlineError message={optOut.isError ? errorMessage(optOut.error) : null} />
        </Card>
      ) : state.can_opt_in ? (
        <Card className={portal.card}>
          <Text weight="semibold">Join the bench</Text>
          <Body1>Your last contract has ended. Opt in and our recruiters will consider you first for open roles.</Body1>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              if (Object.keys(errors).length === 0) optIn.mutate(body);
            }}
          >
            <Field label="Available from" required validationMessage={errors.available_from}>
              <Input type="date" value={form.available_from} onChange={(_, d) => setForm((f) => ({ ...f, available_from: d.value }))} />
            </Field>
            <Field label="Work authorization" validationMessage={errors.work_authorization}>
              <Input value={form.work_authorization ?? ""} onChange={(_, d) => setForm((f) => ({ ...f, work_authorization: d.value }))} />
            </Field>
            <Field label="Preferred locations" hint="Separate with commas" validationMessage={errors.preferred_locations}>
              <Input value={locations} onChange={(_, d) => setLocations(d.value)} />
            </Field>
            <InlineError message={optIn.isError ? errorMessage(optIn.error) : null} />
            <Button type="submit" appearance="primary" disabled={optIn.isPending || Object.keys(errors).length > 0}>
              Opt in to the bench
            </Button>
          </form>
        </Card>
      ) : (
        <Card className={portal.card}>
          <Body1 className={portal.empty}>You are not on the bench. Your recruiter will reach out about new roles.</Body1>
        </Card>
      )}
    </div>
  );
}
