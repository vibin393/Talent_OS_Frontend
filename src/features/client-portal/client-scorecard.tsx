"use client";

import { Button, Field, MessageBar, MessageBarBody, Radio, RadioGroup, Text, Textarea } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { clientPortalRequest, CLIENT_PORTAL_PREFIX } from "@/lib/api/client-portal-client";
import { errorMessage } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { cpKeys } from "./api";
import { Failure, formatDateTime, Loading, PageTitle, useCpStyles } from "./ui";

type ScorecardView = components["schemas"]["PublicScorecardView"];

const enc = encodeURIComponent;

/** `/client/scorecards/[id]`: the P1 external scorecard (FR-41) filled from the portal; submitting consumes the
 * participant's scorecard link, so the emailed link stops working. */
export function ClientScorecardForm({ participantId }: { participantId: string }) {
  const s = useCpStyles();
  const qc = useQueryClient();
  const url = `${CLIENT_PORTAL_PREFIX}/scorecards/${enc(participantId)}`;
  const q = useQuery({ queryKey: ["client-portal", "scorecard", participantId], queryFn: ({ signal }) => clientPortalRequest<ScorecardView>(url, { signal }) });
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState("");
  const [summary, setSummary] = useState("");
  const [touched, setTouched] = useState(false);
  const m = useMutation({
    mutationFn: () =>
      clientPortalRequest<{ status: string }>(url, {
        method: "POST",
        body: {
          ratings: Object.entries(ratings).map(([competency_key, rating]) => ({ competency_key, rating })),
          answers: [],
          recommendation,
          summary: summary.trim() || null,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cpKeys.scorecards }),
  });
  if (q.error) return <Failure error={q.error} />;
  if (!q.data) return <Loading />;
  const v = q.data;
  if (m.isSuccess || v.state === "submitted") {
    return (
      <div className={s.page}>
        <PageTitle>Scorecard submitted</PageTitle>
        <Text>Thank you. The recruiter can see your scorecard now.</Text>
      </div>
    );
  }
  const scale = Array.from({ length: v.rating_scale }, (_, i) => String(i + 1));
  const complete = v.competencies.every((c) => ratings[c.key]) && recommendation !== "";
  return (
    <div className={s.page}>
      <PageTitle>{`Scorecard: ${v.candidate_display_name}`}</PageTitle>
      <Text className={s.muted}>{`${v.demand_title ?? ""} · ${v.stage_name} · ${formatDateTime(v.starts_at)}`}</Text>
      {v.state === "not_started" ? <Text>You can submit once the interview has started.</Text> : null}
      <form
        className={s.card}
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (complete) m.mutate();
        }}
      >
        {v.competencies.map((c) => (
          <Field
            key={c.key}
            label={c.label}
            hint={c.guidance ?? undefined}
            required
            validationMessage={touched && !ratings[c.key] ? "Choose a rating" : undefined}
          >
            <RadioGroup
              layout="horizontal"
              value={ratings[c.key] ? String(ratings[c.key]) : ""}
              onChange={(_, d) => setRatings((r) => ({ ...r, [c.key]: Number(d.value) }))}
            >
              {scale.map((n) => (
                <Radio key={n} value={n} label={n} />
              ))}
            </RadioGroup>
          </Field>
        ))}
        <Field label="Recommendation" required validationMessage={touched && !recommendation ? "Choose a recommendation" : undefined}>
          <RadioGroup value={recommendation} onChange={(_, d) => setRecommendation(d.value)}>
            {v.recommendation_options.map((o) => (
              <Radio key={o} value={o} label={o.replace("_", " ")} />
            ))}
          </RadioGroup>
        </Field>
        <Field label="Summary">
          <Textarea rows={4} value={summary} onChange={(_, d) => setSummary(d.value)} />
        </Field>
        {m.error ? (
          <MessageBar intent="error" aria-live="assertive">
            <MessageBarBody>{errorMessage(m.error)}</MessageBarBody>
          </MessageBar>
        ) : null}
        <div className={s.actions}>
          <Button type="submit" appearance="primary" disabled={m.isPending || v.state !== "open"}>
            Submit scorecard
          </Button>
        </div>
      </form>
    </div>
  );
}
