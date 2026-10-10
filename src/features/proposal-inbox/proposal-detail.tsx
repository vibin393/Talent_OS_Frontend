"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle1,
  Subtitle2,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppLink } from "@/components/app-link";
import { AiBadge } from "@/components/ai/ai-badge";
import { renderProposal, type RenderedProposal } from "@/features/agent-proposals/proposal-renderers";
import { formatDateTime } from "@/features/admin/ui";
import { subjectHref } from "@/features/ai-governance/logic";
import { useUserNames } from "@/features/privacy/use-user-names";
import { inboxApi, type InboxProposal } from "./api";
import {
  confidenceText,
  createOpenedTracker,
  type DecisionError,
  decisionError,
  formValues,
  parseEdited,
  rejectReasonError,
  schemaFields,
  type SchemaField,
} from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, minWidth: 0 },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  rows: {
    display: "grid",
    gridTemplateColumns: "max-content minmax(0, 1fr)",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

/** Plain-text preview rows (never HTML). */
export function PreviewRows({ rendered }: { rendered: RenderedProposal }) {
  const styles = useStyles();
  return (
    <>
      {rendered.summary && <Body1 style={{ whiteSpace: "pre-wrap" }}>{rendered.summary}</Body1>}
      {rendered.rows.length > 0 && (
        <dl className={styles.rows}>
          {rendered.rows.map((r, i) => (
            <div key={`${r.label}-${i}`} style={{ display: "contents" }}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

const openedTracker = createOpenedTracker((id) => {
  void inboxApi.opened(id).catch(() => undefined);
});

/**
 * Detail pane of one Proposal: "What will happen", "Why", "Confidence", "Evidence", "From run" and the decision
 * actions. Rendering a Proposal fires `POST /ai-governance/proposals/{id}/opened` once.
 */
export function ProposalDetail({
  proposal,
  canSeeRun,
  onDecided,
}: {
  proposal: InboxProposal;
  canSeeRun: boolean;
  onDecided: (id: string) => void;
}) {
  const styles = useStyles();
  const userName = useUserNames();
  const [dialog, setDialog] = useState<"edit" | "reject" | null>(null);
  const [error, setError] = useState<DecisionError | null>(null);
  const [rerunDone, setRerunDone] = useState(false);
  const rendered = renderProposal(proposal);
  const pending = proposal.status === "pending";

  useEffect(() => {
    openedTracker(proposal.id);
  }, [proposal.id]);

  const approve = useMutation({
    mutationFn: () => inboxApi.decide(proposal.id, { decision: "approve" }),
    onSuccess: () => onDecided(proposal.id),
    onError: (e) => setError(decisionError(e)),
  });
  const rerun = useMutation({
    mutationFn: () => inboxApi.rerun(proposal.agent_key, proposal.target_type ?? "", proposal.target_id ?? ""),
    onSuccess: () => setRerunDone(true),
    onError: (e) => setError(decisionError(e)),
  });
  const target = subjectHref(proposal.target_type, proposal.target_id);
  const owner = userName(proposal.owner_user_id);

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <Caption1>{proposal.human_id}</Caption1>
        <AiBadge agentName={proposal.agent_name} ownerName={owner} mode="suggest" />
        <Badge appearance="tint" color={proposal.risk === "high" ? "danger" : "informative"}>
          {proposal.risk === "high" ? "High" : "Low"}
        </Badge>
      </div>
      <Subtitle1 as="h2">{rendered.title || proposal.title}</Subtitle1>
      {error && (
        <MessageBar intent={error.intent} layout="multiline" role="alert">
          <MessageBarBody>{rerunDone ? "The agent is running again on this record." : error.text}</MessageBarBody>
          {error.rerun && proposal.target_type && proposal.target_id && !rerunDone && (
            <MessageBarActions>
              <Button size="small" disabled={rerun.isPending} onClick={() => rerun.mutate()}>
                Re-run agent
              </Button>
            </MessageBarActions>
          )}
        </MessageBar>
      )}
      <section className={styles.section} aria-labelledby="pd-what">
        <Subtitle2 as="h3" id="pd-what">
          What will happen
        </Subtitle2>
        <PreviewRows rendered={rendered} />
      </section>
      <section className={styles.section} aria-labelledby="pd-why">
        <Subtitle2 as="h3" id="pd-why">
          Why
        </Subtitle2>
        <Body1 style={{ whiteSpace: "pre-wrap" }}>{proposal.rationale || "—"}</Body1>
      </section>
      <section className={styles.section} aria-labelledby="pd-conf">
        <Subtitle2 as="h3" id="pd-conf">
          Confidence
        </Subtitle2>
        <Text>{confidenceText(proposal.confidence)}</Text>
        <Caption1 className={styles.muted}>The agent&apos;s own confidence. It is not a score of the candidate.</Caption1>
      </section>
      <section className={styles.section} aria-labelledby="pd-evidence">
        <Subtitle2 as="h3" id="pd-evidence">
          Evidence
        </Subtitle2>
        {proposal.evidence.length === 0 ? (
          <Text className={styles.muted}>—</Text>
        ) : (
          <ul style={{ margin: 0, paddingLeft: tokens.spacingHorizontalL }}>
            {proposal.evidence.map((e, i) => {
              const href = subjectHref(e.type, e.id);
              const text = e.label ?? `${e.type} ${e.id.slice(0, 8)}`;
              return <li key={`${e.type}-${e.id}-${i}`}>{href ? <AppLink href={href}>{text}</AppLink> : text}</li>;
            })}
          </ul>
        )}
      </section>
      {target && (
        <Text>
          Record: <AppLink href={target}>{proposal.target_type}</AppLink>
        </Text>
      )}
      {canSeeRun && proposal.run_id && (
        <Text>
          From run: <AppLink href={`/admin/ai/runs/${proposal.run_id}`}>View run</AppLink>
        </Text>
      )}
      <Caption1 className={styles.muted}>Expires {formatDateTime(proposal.expires_at)}</Caption1>
      {pending && proposal.can_decide && (
        <div className={styles.actions}>
          <Button
            appearance="primary"
            disabled={approve.isPending}
            icon={approve.isPending ? <Spinner size="tiny" /> : undefined}
            onClick={() => {
              setError(null);
              approve.mutate();
            }}
          >
            Approve
          </Button>
          {proposal.input_schema && <Button onClick={() => setDialog("edit")}>Edit and approve</Button>}
          <Button onClick={() => setDialog("reject")}>Reject</Button>
        </div>
      )}
      {dialog === "reject" && (
        <RejectDialog
          proposal={proposal}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            onDecided(proposal.id);
          }}
          onError={(e) => setError(e)}
        />
      )}
      {dialog === "edit" && (
        <EditDialog
          proposal={proposal}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            onDecided(proposal.id);
          }}
        />
      )}
    </div>
  );
}

function RejectDialog({
  proposal,
  onClose,
  onDone,
  onError,
}: {
  proposal: InboxProposal;
  onClose: () => void;
  onDone: () => void;
  onError: (e: DecisionError) => void;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const reject = useMutation({
    mutationFn: () => inboxApi.decide(proposal.id, { decision: "reject", note: reason.trim() }),
    onSuccess: onDone,
    onError: (e) => {
      onError(decisionError(e));
      onClose();
    },
  });
  const err = touched ? rejectReasonError(reason) : null;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !reject.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Reject {proposal.human_id}?</DialogTitle>
          <DialogContent>
            <Field label="Reason (required)" required validationState={err ? "error" : "none"} validationMessage={err ?? undefined}>
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} onBlur={() => setTouched(true)} maxLength={1000} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={reject.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={reject.isPending}
              onClick={() => {
                setTouched(true);
                if (!rejectReasonError(reason)) reject.mutate();
              }}
            >
              Reject
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function FieldInput({ field, value, onChange, error }: { field: SchemaField; value: string; onChange: (v: string) => void; error?: string }) {
  const common = { label: field.label, required: field.required, validationState: error ? ("error" as const) : ("none" as const), validationMessage: error };
  if (field.type === "boolean") return <Checkbox label={field.label} checked={value === "true"} onChange={(_, d) => onChange(d.checked ? "true" : "false")} />;
  if (field.type === "enum") {
    return (
      <Field {...common}>
        <Dropdown value={value} selectedOptions={value ? [value] : []} onOptionSelect={(_, d) => onChange(d.optionValue ?? "")}>
          {(field.options ?? []).map((o) => (
            <Option key={o} value={o}>
              {o}
            </Option>
          ))}
        </Dropdown>
      </Field>
    );
  }
  if (field.type === "text" || field.type === "json") {
    return (
      <Field {...common}>
        <Textarea
          value={value}
          onChange={(_, d) => onChange(d.value)}
          resize="vertical"
          style={field.type === "json" ? { fontFamily: tokens.fontFamilyMonospace } : undefined}
        />
      </Field>
    );
  }
  return (
    <Field {...common}>
      <Input type={field.type === "string" ? "text" : "number"} value={value} onChange={(_, d) => onChange(d.value)} />
    </Field>
  );
}

function EditDialog({ proposal, onClose, onDone }: { proposal: InboxProposal; onClose: () => void; onDone: () => void }) {
  const styles = useStyles();
  const [fields] = useState(() => schemaFields(proposal.input_schema));
  const [values, setValues] = useState(() => formValues(fields, proposal.args));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<DecisionError | null>(null);
  const save = useMutation({
    mutationFn: (edited: Record<string, unknown>) => inboxApi.decide(proposal.id, { decision: "approve", edited_args: edited }),
    onSuccess: onDone,
    onError: (e) => setFailure(decisionError(e)),
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface style={{ maxWidth: 640 }}>
        <DialogBody>
          <DialogTitle>Edit and approve {proposal.human_id}</DialogTitle>
          <DialogContent className={styles.form}>
            {fields.length === 0 && <Body1>This action has no editable fields.</Body1>}
            {fields.map((f) => (
              <FieldInput key={f.name} field={f} value={values[f.name] ?? ""} error={errors[f.name]} onChange={(v) => setValues((x) => ({ ...x, [f.name]: v }))} />
            ))}
            {failure && (
              <MessageBar intent={failure.intent} role="alert">
                <MessageBarBody>{failure.text}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={save.isPending}
              icon={save.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => {
                const parsed = parseEdited(fields, values, proposal.args);
                setErrors(parsed.errors);
                if (Object.keys(parsed.errors).length === 0) save.mutate(parsed.args);
              }}
            >
              Approve
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
