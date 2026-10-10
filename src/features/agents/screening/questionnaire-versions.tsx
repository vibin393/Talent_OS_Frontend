"use client";

import {
  Badge,
  Button,
  Caption1,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle2,
  Tab,
  TabList,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular, Sparkle20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { DemandPicker } from "@/features/campus/pickers";
import { errorMessage } from "@/lib/api/errors";
import { screeningAgentApi, screeningAgentKeys } from "./api";
import { BindingEditor } from "./binding-editor";
import { ANSWER_TYPE_LABELS, KNOCKOUT_OP_LABELS, knockoutOps, knockoutValue, needsAcceptance, UNIT_LABELS, VERSION_STATUS_LABELS } from "./logic";
import type { AgentQuestion, AnswerType, KnockoutOp, QuestionDraft, Unit, VersionOut } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, minWidth: 0 },
  toolbar: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  q: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  ai: { borderLeft: `3px solid ${tokens.colorBrandStroke1}` },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "flex-end" },
  small: { width: "140px" },
  muted: { color: tokens.colorNeutralForeground3 },
  legend: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalS },
});

const TYPES = Object.keys(ANSWER_TYPE_LABELS) as AnswerType[];
const UNITS = Object.keys(UNIT_LABELS) as Unit[];
const NONE = "__none__";
const MAX_QUESTIONS = 20;

function toDraft(q: AgentQuestion | QuestionDraft): QuestionDraft {
  return {
    id: q.id ?? null,
    key: q.key,
    label: q.label,
    type: q.type,
    unit: q.unit ?? null,
    currency: q.currency ?? null,
    options: q.options ?? null,
    required: !!q.required,
    maps_to: q.maps_to ?? null,
    min: q.min ?? null,
    max: q.max ?? null,
    knockout: q.knockout ?? null,
    origin: q.origin ?? "manual",
    accepted_by: q.accepted_by ?? null,
  };
}

function uniqueKey(existing: QuestionDraft[]): string {
  const keys = new Set(existing.map((q) => q.key));
  let n = existing.length + 1;
  while (keys.has(`question_${n}`)) n += 1;
  return `question_${n}`;
}

/** Screening Agent questionnaire versions (Epic 57.1): drafts, AI suggestions, approval and "Use for" bindings. */
export function QuestionnaireVersions({ questionnaireId }: { questionnaireId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canConduct = usePermission("screening:conduct");
  const versions = useQuery({
    queryKey: screeningAgentKeys.versions(questionnaireId),
    queryFn: ({ signal }) => screeningAgentApi.versions(questionnaireId, signal),
    enabled: canConduct,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sorted = [...(versions.data ?? [])].sort((a, b) => b.version - a.version);
  const selected = sorted.find((v) => v.id === selectedId) ?? sorted.find((v) => v.status === "draft") ?? sorted.find((v) => v.status === "approved") ?? sorted[0];
  const setVersion = (v: VersionOut) =>
    queryClient.setQueryData<VersionOut[]>(screeningAgentKeys.versions(questionnaireId), (prev) =>
      prev ? (prev.some((p) => p.id === v.id) ? prev.map((p) => (p.id === v.id ? v : p.status === "approved" && v.status === "approved" ? { ...p, status: "retired" } : p)) : [...prev, v]) : [v],
    );
  const create = useMutation({
    mutationFn: () => screeningAgentApi.createVersion(questionnaireId, {}),
    onSuccess: (v) => {
      setVersion(v);
      setSelectedId(v.id);
      toast.success(`Draft v${v.version} created.`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!canConduct) return null;
  return (
    <section className={styles.root} aria-labelledby={`sqv-${questionnaireId}`}>
      <span className={styles.legend}>
        <Subtitle2 as="h3" id={`sqv-${questionnaireId}`}>
          Screening Agent versions
        </Subtitle2>
      </span>
      <Caption1 className={styles.muted}>The Screening Agent asks only the questions of the approved version.</Caption1>
      {versions.isPending ? (
        <GridSkeleton rows={3} />
      ) : versions.isError ? (
        <ErrorBar title="Could not load versions." message={errorMessage(versions.error)} />
      ) : (
        <>
          <div className={styles.toolbar}>
            {sorted.length > 0 && (
              <TabList size="small" selectedValue={selected?.id} onTabSelect={(_, d) => setSelectedId(String(d.value))} aria-label="Versions">
                {sorted.map((v) => (
                  <Tab key={v.id} value={v.id}>
                    v{v.version} · {VERSION_STATUS_LABELS[v.status]}
                  </Tab>
                ))}
              </TabList>
            )}
            {!sorted.some((v) => v.status === "draft") && (
              <Button icon={create.isPending ? <Spinner size="tiny" /> : <Add20Regular />} disabled={create.isPending} onClick={() => create.mutate()}>
                New version
              </Button>
            )}
          </div>
          {selected ? (
            <VersionEditor key={`${selected.id}:${selected.status}`} version={selected} onChanged={setVersion} />
          ) : (
            <Caption1 className={styles.muted}>No versions yet. Create one to use this questionnaire with the Screening Agent.</Caption1>
          )}
          <BindingEditor questionnaireId={questionnaireId} />
        </>
      )}
    </section>
  );
}

function VersionEditor({ version, onChanged }: { version: VersionOut; onChanged: (v: VersionOut) => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const draft = version.status === "draft";
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => version.questions.map(toDraft));
  const [dirty, setDirty] = useState(false);
  const [approving, setApproving] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const update = (i: number, patch: Partial<QuestionDraft>) => {
    setDirty(true);
    setQuestions((prev) => prev.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  };
  const applyServer = (v: VersionOut) => {
    onChanged(v);
    setQuestions(v.questions.map(toDraft));
    setDirty(false);
  };
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const save = useMutation({
    mutationFn: (qs: QuestionDraft[]) =>
      screeningAgentApi.updateVersion(version.id, { questions: qs.map((q) => ({ ...q, label: q.label.trim(), options: q.type === "choice" ? (q.options ?? []).map((o) => o.trim()).filter(Boolean) : null })) }),
    onSuccess: (v) => {
      applyServer(v);
      toast.success("Draft saved.");
    },
    onError,
  });
  const accept = useMutation({ mutationFn: (qid: string) => screeningAgentApi.acceptQuestion(version.id, qid), onSuccess: applyServer, onError });
  const remove = useMutation({ mutationFn: (qid: string) => screeningAgentApi.removeQuestion(version.id, qid), onSuccess: applyServer, onError });
  const generate = useMutation({
    mutationFn: (demandId: string) => screeningAgentApi.generateQuestions(version.questionnaire_id, demandId),
    onSuccess: (out) => {
      const room = MAX_QUESTIONS - questions.length;
      if (room <= 0 || out.questions.length === 0) {
        toast.error(room <= 0 ? "A version holds at most 20 questions." : "No questions were suggested.");
        return;
      }
      save.mutate([...questions, ...out.questions.slice(0, room).map(toDraft)]);
      setSuggestOpen(false);
    },
    onError,
  });
  const pendingAi = questions.filter(needsAcceptance).length;
  const busy = save.isPending || accept.isPending || remove.isPending || generate.isPending;
  const invalid = questions.length === 0 || questions.some((q) => !q.label.trim() || (q.type === "choice" && (q.options ?? []).filter((o) => o.trim()).length < 2));

  return (
    <div className={styles.root}>
      {version.change_note && <Caption1 className={styles.muted}>{version.change_note}</Caption1>}
      {questions.map((q, i) => {
        const ai = q.origin === "ai_generated";
        const ops = knockoutOps(q.type);
        const ko = q.knockout;
        return (
          <fieldset key={q.id ?? q.key} className={`${styles.q} ${ai ? styles.ai : ""}`}>
            <legend className={styles.legend}>
              <Text weight="semibold">Question {i + 1}</Text>
              {needsAcceptance(q) && (
                <>
                  <Badge appearance="tint" color="brand">
                    AI suggestion
                  </Badge>
                  <AiBadge agentName="Screening question generator" />
                </>
              )}
            </legend>
            <Field label="Question" required>
              <Input value={q.label} maxLength={500} disabled={!draft} onChange={(_, d) => update(i, { label: d.value })} />
            </Field>
            <div className={styles.row}>
              <Field label="Answer type">
                <Dropdown
                  className={styles.small}
                  disabled={!draft}
                  value={ANSWER_TYPE_LABELS[q.type]}
                  selectedOptions={[q.type]}
                  onOptionSelect={(_, d) => update(i, { type: (d.optionValue as AnswerType) ?? q.type, knockout: null })}
                >
                  {TYPES.map((t) => (
                    <Option key={t} value={t}>
                      {ANSWER_TYPE_LABELS[t]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              {q.type === "number" && (
                <Field label="Unit">
                  <Dropdown
                    className={styles.small}
                    disabled={!draft}
                    value={q.unit ? UNIT_LABELS[q.unit] : "None"}
                    selectedOptions={[q.unit ?? NONE]}
                    onOptionSelect={(_, d) => update(i, { unit: d.optionValue === NONE ? null : (d.optionValue as Unit) })}
                  >
                    <Option value={NONE}>None</Option>
                    {UNITS.map((u) => (
                      <Option key={u} value={u}>
                        {UNIT_LABELS[u]}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              )}
              {q.type === "money" && (
                <Field label="Currency">
                  <Input
                    className={styles.small}
                    disabled={!draft}
                    value={q.currency ?? ""}
                    maxLength={3}
                    placeholder="INR"
                    onChange={(_, d) => update(i, { currency: d.value.toUpperCase() || null })}
                  />
                </Field>
              )}
              <Checkbox label="Required" disabled={!draft} checked={!!q.required} onChange={(_, d) => update(i, { required: !!d.checked })} />
            </div>
            {q.type === "choice" && (
              <Field label="Options (comma-separated)" required>
                <Input disabled={!draft} value={(q.options ?? []).join(", ")} onChange={(_, d) => update(i, { options: d.value.split(",").map((o) => o.trimStart()) })} />
              </Field>
            )}
            {ops.length > 0 && (
              <div className={styles.row}>
                <Field label="Knockout (flag only)" hint="A knockout only flags the answer for your review. It never rejects.">
                  <Dropdown
                    className={styles.small}
                    disabled={!draft}
                    value={ko ? KNOCKOUT_OP_LABELS[ko.op] : "None"}
                    selectedOptions={[ko?.op ?? NONE]}
                    onOptionSelect={(_, d) =>
                      update(i, { knockout: d.optionValue === NONE ? null : { op: d.optionValue as KnockoutOp, value: ko?.value ?? (q.type === "boolean" ? false : "") } })
                    }
                  >
                    <Option value={NONE}>None</Option>
                    {ops.map((op) => (
                      <Option key={op} value={op}>
                        {KNOCKOUT_OP_LABELS[op]}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                {ko &&
                  (q.type === "boolean" ? (
                    <Field label="Value">
                      <Dropdown
                        className={styles.small}
                        disabled={!draft}
                        value={ko.value === true ? "Yes" : "No"}
                        selectedOptions={[String(ko.value === true)]}
                        onOptionSelect={(_, d) => update(i, { knockout: { op: ko.op, value: d.optionValue === "true" } })}
                      >
                        <Option value="true">Yes</Option>
                        <Option value="false">No</Option>
                      </Dropdown>
                    </Field>
                  ) : (
                    <Field label="Value">
                      <Input
                        disabled={!draft}
                        value={Array.isArray(ko.value) ? ko.value.join(", ") : ko.value == null ? "" : String(ko.value)}
                        onChange={(_, d) => update(i, { knockout: { op: ko.op, value: knockoutValue(q.type, ko.op, d.value) } })}
                      />
                    </Field>
                  ))}
              </div>
            )}
            {draft && (
              <div className={styles.row}>
                {needsAcceptance(q) && q.id && (
                  <Button size="small" appearance="primary" disabled={busy || dirty} onClick={() => accept.mutate(q.id as string)}>
                    Accept
                  </Button>
                )}
                {needsAcceptance(q) && q.id ? (
                  <Button size="small" disabled={busy || dirty} onClick={() => remove.mutate(q.id as string)}>
                    Remove
                  </Button>
                ) : (
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<Delete20Regular />}
                    aria-label={`Remove question ${i + 1}`}
                    disabled={questions.length <= 1}
                    onClick={() => {
                      setDirty(true);
                      setQuestions((prev) => prev.filter((_, j) => j !== i));
                    }}
                  />
                )}
              </div>
            )}
          </fieldset>
        );
      })}
      {draft && (
        <>
          <div className={styles.toolbar}>
            <Button
              icon={<Add20Regular />}
              disabled={questions.length >= MAX_QUESTIONS || busy}
              onClick={() => {
                setDirty(true);
                setQuestions((prev) => [...prev, { key: uniqueKey(prev), label: "", type: "text", required: false, origin: "manual" }]);
              }}
            >
              Add question
            </Button>
            <Button icon={<Sparkle20Regular />} disabled={busy || dirty || questions.length >= MAX_QUESTIONS} onClick={() => setSuggestOpen((o) => !o)}>
              Suggest questions with AI
            </Button>
            <Button disabled={!dirty || invalid || busy} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => save.mutate(questions)}>
              Save draft
            </Button>
            <Button appearance="primary" disabled={dirty || busy || pendingAi > 0 || questions.length === 0} onClick={() => setApproving(true)}>
              Approve version
            </Button>
          </div>
          {suggestOpen && (
            <DemandPicker label="Suggest from the demand" onPick={(d) => generate.mutate(d.id)} disabled={generate.isPending} />
          )}
          {generate.isPending && <Spinner size="tiny" label="Suggesting questions…" />}
          {dirty && <Caption1 className={styles.muted}>Save your changes before you accept suggestions or approve.</Caption1>}
          {pendingAi > 0 && (
            <MessageBar intent="info">
              <MessageBarBody>Accept or remove each AI suggestion before you approve this version.</MessageBarBody>
            </MessageBar>
          )}
        </>
      )}
      <ConfirmDialog
        open={approving}
        title={`Approve v${version.version}`}
        confirmLabel="Approve version"
        onConfirm={async () => {
          try {
            applyServer(await screeningAgentApi.approveVersion(version.id));
            toast.success(`v${version.version} approved.`);
          } catch (e) {
            onError(e);
            throw e;
          }
        }}
        onClose={() => setApproving(false)}
      >
        Approved versions are used by the Screening Agent as-is.
      </ConfirmDialog>
    </div>
  );
}
