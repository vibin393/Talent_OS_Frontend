"use client";

import {
  Button,
  Caption1,
  Field,
  makeStyles,
  Radio,
  RadioGroup,
  Spinner,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Checkmark20Regular, Dismiss20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { buildDecideBody, decideErrors, type LineDecisionState } from "./format";
import type { DecideIn, Decision } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  line: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  head: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: tokens.spacingHorizontalS },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  button: { minHeight: "44px" },
});

export type DecisionLine = { id: string; title: string; detail?: string; amount: string };

/**
 * Per-line approve / reject (comment required for each rejected line) plus a whole-claim reject (comment
 * required). With `perLine` false only the whole-claim decision is offered.
 */
export function DecisionPanel({
  lines,
  perLine,
  pending,
  onDecide,
}: {
  lines: DecisionLine[];
  perLine: boolean;
  pending: boolean;
  onDecide: (body: DecideIn) => void;
}) {
  const styles = useStyles();
  const [state, setState] = useState<LineDecisionState>({});
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setLine = (id: string, patch: Partial<{ decision: Decision; comment: string }>) =>
    setState((s) => ({ ...s, [id]: { decision: s[id]?.decision ?? "approve", comment: s[id]?.comment ?? "", ...patch } }));

  const go = (action: Decision) => {
    const body = buildDecideBody(action, comment, perLine ? lines.map((l) => l.id) : [], state);
    const errs = decideErrors(body);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onDecide(body);
  };
  const rejectedCount = lines.filter((l) => state[l.id]?.decision === "reject").length;

  return (
    <div className={styles.root}>
      {perLine &&
        lines.map((l) => {
          const d = state[l.id]?.decision ?? "approve";
          return (
            <div key={l.id} className={styles.line}>
              <div className={styles.head}>
                <Text weight="semibold">{l.title}</Text>
                <Text>{l.amount}</Text>
              </div>
              {l.detail && <Caption1>{l.detail}</Caption1>}
              <RadioGroup
                layout="horizontal"
                value={d}
                aria-label={`Decision for ${l.title}`}
                onChange={(_, v) => setLine(l.id, { decision: v.value as Decision })}
              >
                <Radio value="approve" label="Approve" />
                <Radio value="reject" label="Reject" />
              </RadioGroup>
              {d === "reject" && (
                <Field label="Reason" required validationMessage={errors[l.id]}>
                  <Textarea value={state[l.id]?.comment ?? ""} maxLength={2000} onChange={(_, v) => setLine(l.id, { comment: v.value })} />
                </Field>
              )}
            </div>
          );
        })}
      <Field label="Comment" hint="Required when rejecting the whole claim" validationMessage={errors.claim}>
        <Textarea value={comment} maxLength={4000} onChange={(_, v) => setComment(v.value)} />
      </Field>
      <div className={styles.actions}>
        <Button
          appearance="primary"
          className={styles.button}
          icon={pending ? <Spinner size="tiny" /> : <Checkmark20Regular />}
          disabled={pending}
          onClick={() => go("approve")}
        >
          {perLine && rejectedCount > 0 ? `Approve with ${rejectedCount} rejected` : "Approve"}
        </Button>
        <Button className={styles.button} icon={<Dismiss20Regular />} disabled={pending} onClick={() => go("reject")}>
          Reject claim
        </Button>
      </div>
    </div>
  );
}
