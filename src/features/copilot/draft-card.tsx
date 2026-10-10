"use client";

/**
 * Draft Action card (Epic 54 B5): a Copilot-origin Proposal the user confirms with one click. Preview fields come from
 * the foundation proposal renderers (plain text). Confirm -> `POST /proposals/{id}/confirm` (executes as the user,
 * re-checked); Edit -> an inline form from `input_schema`, then "Confirm changes"; Discard.
 */
import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
  Subtitle2,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { renderProposal } from "@/features/agent-proposals/proposal-renderers";
import type { ProposalOut } from "@/lib/api/agentic-types";
import { errorMessage } from "@/lib/api/errors";
import { copilotApi, copilotKeys, useProposal } from "./api";
import { COPY, draftOutcome } from "./copy";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalS },
  rows: { display: "grid", gridTemplateColumns: "minmax(80px, auto) 1fr", columnGap: tokens.spacingHorizontalS, rowGap: tokens.spacingVerticalXXS },
  label: { color: tokens.colorNeutralForeground3 },
  value: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
});

interface SchemaProp {
  type?: string | string[];
  format?: string;
  maxLength?: number;
  title?: string;
  anyOf?: SchemaProp[];
}

/** Editable fields of a draft: plain strings / numbers of its arguments (ids and lists stay as drafted). */
export function editableFields(p: Pick<ProposalOut, "args" | "input_schema">): { key: string; label: string; long: boolean; numeric: boolean }[] {
  const props = ((p.input_schema?.properties ?? {}) as Record<string, SchemaProp>) || {};
  const args = p.args ?? {};
  const out: { key: string; label: string; long: boolean; numeric: boolean }[] = [];
  for (const [key, raw] of Object.entries(props)) {
    if (key.startsWith("_") || !(key in args)) continue;
    const prop = raw.anyOf?.find((x) => x.type && x.type !== "null") ?? raw;
    const type = Array.isArray(prop.type) ? prop.type.find((t) => t !== "null") : prop.type;
    if (prop.format === "uuid" || /_id$|_ids$/.test(key)) continue;
    if (type === "string" || type === "integer" || type === "number") {
      out.push({
        key,
        label: prop.title || key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
        long: type === "string" && (prop.maxLength ?? 0) > 300,
        numeric: type !== "string",
      });
    }
  }
  return out;
}

export function DraftCard({ proposalId, title: fallbackTitle }: { proposalId: string; title?: string }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const proposal = useProposal(proposalId);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const refresh = (p: ProposalOut) => {
    qc.setQueryData(copilotKeys.proposal(proposalId), p);
    void qc.invalidateQueries({ queryKey: ["copilot", "messages"] });
  };
  const confirm = useMutation({
    mutationFn: (edited: Record<string, unknown> | null) => copilotApi.confirm(proposalId, edited),
    onSuccess: (p) => {
      setEditing(false);
      refresh(p);
    },
    onError: () => void proposal.refetch(),
  });
  const discard = useMutation({ mutationFn: () => copilotApi.discard(proposalId), onSuccess: refresh });

  if (proposal.isPending) {
    return (
      <Skeleton aria-label="Loading draft">
        <SkeletonItem size={72} />
      </Skeleton>
    );
  }
  if (proposal.isError) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{errorMessage(proposal.error)}</MessageBarBody>
      </MessageBar>
    );
  }
  const p = proposal.data;
  const rendered = renderProposal(p);
  const outcome = draftOutcome(p.status, p.error_code, resultSummary(p));
  const pending = p.status === "pending";
  const fields = editableFields(p);
  const startEdit = () => {
    setValues(Object.fromEntries(fields.map((f) => [f.key, String(p.args?.[f.key] ?? "")])));
    setEditing(true);
  };
  const editedArgs = () => {
    const args: Record<string, unknown> = { ...(p.args ?? {}) };
    for (const f of fields) args[f.key] = f.numeric ? Number(values[f.key]) : values[f.key];
    return args;
  };
  const busy = confirm.isPending || discard.isPending;

  return (
    <Card className={styles.card} appearance="outline" size="small">
      <CardHeader
        header={<Subtitle2 as="h3">{`Draft · ${p.tool_title || fallbackTitle || rendered.title}`}</Subtitle2>}
        action={pending ? <Badge appearance="tint" color="warning">{COPY.needsConfirmation}</Badge> : undefined}
      />
      {rendered.summary ? <Body1 className={styles.value}>{rendered.summary}</Body1> : null}
      {editing ? (
        <div className={styles.form}>
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.long ? (
                <Textarea value={values[f.key] ?? ""} resize="vertical" onChange={(_, d) => setValues((v) => ({ ...v, [f.key]: d.value }))} />
              ) : (
                <Input
                  type={f.numeric ? "number" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(_, d) => setValues((v) => ({ ...v, [f.key]: d.value }))}
                />
              )}
            </Field>
          ))}
        </div>
      ) : rendered.rows.length ? (
        <div className={styles.rows}>
          {rendered.rows.map((r) => (
            <div key={r.label} style={{ display: "contents" }}>
              <Caption1 className={styles.label}>{r.label}</Caption1>
              <Caption1 className={styles.value}>{r.value}</Caption1>
            </div>
          ))}
        </div>
      ) : null}
      {outcome ? (
        <MessageBar intent={outcome.intent}>
          <MessageBarBody>{outcome.text}</MessageBarBody>
        </MessageBar>
      ) : null}
      {confirm.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>{`Couldn't complete: ${errorMessage(confirm.error)}`}</MessageBarBody>
        </MessageBar>
      ) : null}
      {pending ? (
        <div className={styles.actions}>
          {editing ? (
            <>
              <Button appearance="primary" disabled={busy} onClick={() => confirm.mutate(editedArgs())}>
                {COPY.confirmChanges}
              </Button>
              <Button disabled={busy} onClick={() => setEditing(false)}>
                {COPY.cancel}
              </Button>
            </>
          ) : (
            <>
              <Button appearance="primary" disabled={busy} onClick={() => confirm.mutate(null)}>
                {COPY.confirm}
              </Button>
              {fields.length ? (
                <Button disabled={busy} onClick={startEdit}>
                  {COPY.edit}
                </Button>
              ) : null}
              <Button appearance="subtle" disabled={busy} onClick={() => discard.mutate()}>
                {COPY.discard}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function resultSummary(p: ProposalOut): string | null {
  const preview = p.preview;
  if (p.status !== "executed") return null;
  return preview?.title ? `${preview.title}.` : null;
}
