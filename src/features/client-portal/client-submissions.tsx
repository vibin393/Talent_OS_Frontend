"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatMoney } from "@/features/billing/money";
import { errorMessage } from "@/lib/api/errors";
import { cpApi, cpKeys } from "./api";
import {
  availabilityLabel,
  canCompare,
  commentError,
  experienceLabel,
  FEEDBACK_LABEL,
  MAX_SLOTS,
  type SlotRow,
  validateSlots,
} from "./logic";
import type { ClientSubmissionOut, FeedbackDecision } from "./types";
import { Failure, formatDateTime, Loading, PageTitle, useCpStyles } from "./ui";

const useStyles = makeStyles({
  scroller: { overflowX: "auto", maxWidth: "100%" },
  table: {
    borderCollapse: "collapse",
    minWidth: "560px",
    "& th, & td": {
      textAlign: "left",
      verticalAlign: "top",
      padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
      borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
      minWidth: "180px",
    },
    "& th[scope=row]": { color: tokens.colorNeutralForeground3, fontWeight: tokens.fontWeightRegular, minWidth: "120px" },
  },
  slotRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: tokens.spacingHorizontalS, alignItems: "end" },
  frame: { width: "100%", height: "70vh", border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium },
});

/** `/client/compare?ids=`: side-by-side columns (horizontal scroll on mobile). */
export function ClientCompare({ ids }: { ids: string[] }) {
  const s = useCpStyles();
  const st = useStyles();
  const q = useQuery({ queryKey: cpKeys.compare(ids), queryFn: () => cpApi.compare(ids), enabled: canCompare(ids) });
  if (!canCompare(ids)) return <Failure error={new Error("Select 2 to 4 candidates to compare.")} />;
  if (q.error) return <Failure error={q.error} />;
  if (!q.data) return <Loading />;
  const items = q.data.items;
  const rows: [string, (c: ClientSubmissionOut) => React.ReactNode][] = [
    ["Headline", (c) => c.headline ?? "—"],
    ["Bill rate", (c) => `${formatMoney({ amount: c.bill_rate, currency: c.currency })} / ${c.rate_unit}`],
    ["Availability", (c) => availabilityLabel(c.availability_days)],
    ["Experience", (c) => experienceLabel(c.experience_months)],
    ["Recruiter summary", (c) => c.recruiter_summary ?? "—"],
    ["Feedback", (c) => FEEDBACK_LABEL[c.feedback_status] ?? c.feedback_status],
    [
      "Resume",
      (c) =>
        c.has_resume ? (
          <a className={s.link} href={cpApi.resumeUrl(c.id)} target="_blank" rel="noreferrer">
            Open resume
          </a>
        ) : (
          "—"
        ),
    ],
  ];
  return (
    <div className={s.page}>
      <PageTitle>Compare candidates</PageTitle>
      <div/* NOSONAR */ className={st.scroller} role="region" aria-label="Comparison" tabIndex={0}>
        <table className={st.table}>
          <thead>
            <tr>
              <td />
              {items.map((c) => (
                <th key={c.id} scope="col">
                  <a className={s.link} href={`/client/submissions/${c.id}`}>
                    {c.candidate_display_name}
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, render]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {items.map((c) => (
                  <td key={c.id}>{render(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeedbackDialog({ sub, decision, onClose }: { sub: ClientSubmissionOut; decision: FeedbackDecision | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);
  const m = useMutation({
    mutationFn: () => cpApi.feedback(sub.id, decision as FeedbackDecision, comment.trim() || null),
    onSuccess: (data) => {
      qc.setQueryData(cpKeys.submission(sub.id), data);
      void qc.invalidateQueries({ queryKey: cpKeys.submissions(sub.demand_id) });
      onClose();
    },
  });
  const err = decision ? commentError(decision, comment) : null;
  const label = decision ? FEEDBACK_LABEL[decision === "rejected" ? "rejected" : decision] : "";
  return (
    <Dialog open={decision !== null} onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{`${label}: ${sub.candidate_display_name}`}</DialogTitle>
          <DialogContent>
            <Field label="Comment" required={decision === "rejected"} validationMessage={touched && err ? err : undefined}>
              <Textarea rows={4} value={comment} onChange={(_, d) => setComment(d.value)} />
            </Field>
            {m.error ? (
              <MessageBar intent="error" aria-live="assertive">
                <MessageBarBody>{errorMessage(m.error)}</MessageBarBody>
              </MessageBar>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={m.isPending}
              onClick={() => {
                setTouched(true);
                if (!err) m.mutate();
              }}
            >
              Send feedback
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

const TZ = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata" : "Asia/Kolkata";

function SlotsDialog({ sub, open, onClose }: { sub: ClientSubmissionOut; open: boolean; onClose: () => void }) {
  const st = useStyles();
  const qc = useQueryClient();
  const [rows, setRows] = useState<SlotRow[]>([{ date: "", start: "10:00", end: "11:00" }]);
  const [touched, setTouched] = useState(false);
  const { errors, slots } = validateSlots(rows, TZ);
  const m = useMutation({
    mutationFn: () => cpApi.proposeSlots(sub.id, slots ?? []),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: cpKeys.submission(sub.id) });
      onClose();
    },
  });
  const set = (i: number, patch: Partial<SlotRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Dialog open={open} onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Propose interview slots</DialogTitle>
          <DialogContent>
            <Text>{`The recruiter confirms one of these and schedules the interview. Times are in ${TZ}.`}</Text>
            {rows.map((r, i) => (
              <div key={i} className={st.slotRow}>
                <Field label={`Slot ${i + 1} date`} validationMessage={touched && errors[i] ? errors[i] : undefined}>
                  <Input type="date" value={r.date} onChange={(_, d) => set(i, { date: d.value })} />
                </Field>
                <Field label="Start">
                  <Input type="time" value={r.start} onChange={(_, d) => set(i, { start: d.value })} />
                </Field>
                <Field label="End">
                  <Input type="time" value={r.end} onChange={(_, d) => set(i, { end: d.value })} />
                </Field>
                {rows.length > 1 ? (
                  <Button aria-label={`Remove slot ${i + 1}`} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
            {rows.length < MAX_SLOTS ? (
              <Button onClick={() => setRows((x) => [...x, { date: "", start: "10:00", end: "11:00" }])}>Add another slot</Button>
            ) : null}
            {m.error ? (
              <MessageBar intent="error" aria-live="assertive">
                <MessageBarBody>{errorMessage(m.error)}</MessageBarBody>
              </MessageBar>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={m.isPending}
              onClick={() => {
                setTouched(true);
                if (slots) m.mutate();
              }}
            >
              Send slots
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function OfferedSlots({ sub }: { sub: ClientSubmissionOut }) {
  const s = useCpStyles();
  const qc = useQueryClient();
  const offer = sub.slot_proposals.find((p) => p.kind === "recruiter_offered" && p.status === "open");
  const [index, setIndex] = useState<string>("");
  const m = useMutation({
    mutationFn: () => cpApi.chooseSlot(offer!.id, Number(index)),
    onSuccess: () => qc.invalidateQueries({ queryKey: cpKeys.submission(sub.id) }),
  });
  if (!offer) return null;
  return (
    <div className={s.card}>
      <Text weight="semibold">The recruiter offered these interview slots</Text>
      <RadioGroup value={index} onChange={(_, d) => setIndex(d.value)} aria-label="Offered slots">
        {offer.slots.map((sl, i) => (
          <Radio key={i} value={String(i)} label={`${formatDateTime(sl.starts_at)} – ${formatDateTime(sl.ends_at)}`} />
        ))}
      </RadioGroup>
      {m.error ? (
        <MessageBar intent="error" aria-live="assertive">
          <MessageBarBody>{errorMessage(m.error)}</MessageBarBody>
        </MessageBar>
      ) : null}
      <div className={s.actions}>
        <Button appearance="primary" disabled={index === "" || m.isPending} onClick={() => m.mutate()}>
          Choose
        </Button>
      </div>
    </div>
  );
}

/** `/client/submissions/[id]`: resume viewer, feedback, slot proposals / offered slots. */
export function ClientSubmissionDetail({ id }: { id: string }) {
  const s = useCpStyles();
  const st = useStyles();
  const [decision, setDecision] = useState<FeedbackDecision | null>(null);
  const [slots, setSlots] = useState(false);
  const q = useQuery({ queryKey: cpKeys.submission(id), queryFn: ({ signal }) => cpApi.submission(id, signal) });
  if (q.error) return <Failure error={q.error} />;
  if (!q.data) return <Loading />;
  const c = q.data;
  return (
    <div className={s.page}>
      <PageTitle>{c.candidate_display_name}</PageTitle>
      <div className={s.card}>
        <dl className={s.dl}>
          <dt>Demand</dt>
          <dd>{c.demand_title ?? "—"}</dd>
          <dt>Headline</dt>
          <dd>{c.headline ?? "—"}</dd>
          <dt>Experience</dt>
          <dd>{experienceLabel(c.experience_months)}</dd>
          <dt>Availability</dt>
          <dd>{availabilityLabel(c.availability_days)}</dd>
          <dt>Bill rate</dt>
          <dd className={s.num}>{`${formatMoney({ amount: c.bill_rate, currency: c.currency })} / ${c.rate_unit}`}</dd>
          <dt>Recruiter summary</dt>
          <dd>{c.recruiter_summary ?? "—"}</dd>
          <dt>Feedback</dt>
          <dd>
            <Badge appearance="tint">{FEEDBACK_LABEL[c.feedback_status] ?? c.feedback_status}</Badge>
          </dd>
          {c.interview_status ? (
            <>
              <dt>Interview</dt>
              <dd>{c.interview_status}</dd>
            </>
          ) : null}
        </dl>
        <div className={s.actions}>
          <Button appearance="primary" onClick={() => setDecision("interested")}>
            Interested
          </Button>
          <Button onClick={() => setDecision("on_hold")}>On hold</Button>
          <Button onClick={() => setDecision("rejected")}>Reject</Button>
          <Button onClick={() => setSlots(true)}>Propose interview slots</Button>
        </div>
      </div>
      <OfferedSlots sub={c} />
      {c.has_resume ? <iframe className={st.frame} title="Resume" src={cpApi.resumeUrl(c.id)} /> : null}
      <FeedbackDialog sub={c} decision={decision} onClose={() => setDecision(null)} />
      <SlotsDialog sub={c} open={slots} onClose={() => setSlots(false)} />
    </div>
  );
}
