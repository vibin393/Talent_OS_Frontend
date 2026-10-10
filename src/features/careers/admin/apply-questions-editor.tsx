"use client";

import {
  Body1,
  Button,
  Card,
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
  MessageBarBody,
  Option,
  Spinner,
  Switch,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDown20Regular, ArrowUp20Regular, Delete20Regular, TextBulletListSquareEdit20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { useMe } from "@/features/auth/use-me";
import { errorMessage } from "@/lib/api/errors";
import { careerSiteApi, careerSiteKeys } from "./api";
import { emptyQuestion, fromPublic, MAPS_TO, MAX_QUESTIONS, type QuestionDraft, questionKey, QUESTION_TYPES, toQuestions, validateQuestions } from "./questions-form";

const useStyles = makeStyles({
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  card: { padding: tokens.spacingHorizontalM, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  row: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: tokens.spacingHorizontalM, alignItems: "end" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: tokens.spacingHorizontalS },
  surface: { maxWidth: "760px", width: "100%" },
});

const NONE = "__none__";

function Editor({ demandId, initial, onClose }: { demandId: string; initial: QuestionDraft[]; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const [list, setList] = useState<QuestionDraft[]>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (i: number, patch: Partial<QuestionDraft>) => setList((l) => l.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, by: number) =>
    setList((l) => {
      const next = [...l];
      const [q] = next.splice(i, 1);
      next.splice(i + by, 0, q);
      return next;
    });
  const err = (k: string) => ({ validationState: errors[k] ? ("error" as const) : ("none" as const), validationMessage: errors[k] || undefined });

  const save = async () => {
    setError(null);
    const e = validateQuestions(list);
    setErrors(e);
    if (Object.keys(e).length) {
      setError("Fix the highlighted questions and save again.");
      return;
    }
    setBusy(true);
    try {
      await careerSiteApi.setApplyQuestions(demandId, toQuestions(list));
      toast.success("Apply questions saved");
      onClose();
    } catch (x) {
      setError(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogContent className={styles.list}>
        <Body1>Candidates answer these when they apply on the career site (up to {MAX_QUESTIONS}). Mapped answers are proposed to recruiters, never written to the profile automatically.</Body1>
        {error && (
          <MessageBar intent="error" role="alert">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
        {list.length === 0 && <Text>No apply questions. Candidates only send their details and resume.</Text>}
        {list.map((q, i) => (
          <Card key={i} className={styles.card}>
            <div className={styles.head}>
              <Text weight="semibold">Question {i + 1}</Text>
              <div>
                <Button appearance="subtle" icon={<ArrowUp20Regular />} aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                <Button appearance="subtle" icon={<ArrowDown20Regular />} aria-label={`Move question ${i + 1} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)} />
                <Button appearance="subtle" icon={<Delete20Regular />} aria-label={`Remove question ${i + 1}`} onClick={() => setList((l) => l.filter((_, j) => j !== i))} />
              </div>
            </div>
            <Field label="Question" required {...err(`${i}.label`)}>
              <Input
                value={q.label}
                maxLength={500}
                onChange={(_, d) => {
                  const taken = list.filter((_, j) => j !== i).map((x) => x.key);
                  // Keep the key in step with the label until the question is saved once.
                  const auto = q.key === questionKey(q.label, taken);
                  set(i, { label: d.value, ...(auto ? { key: questionKey(d.value, taken) } : {}) });
                }}
              />
            </Field>
            <div className={styles.row}>
              <Field label="Answer type">
                <Dropdown
                  value={QUESTION_TYPES.find((t) => t.value === q.type)?.label ?? q.type}
                  selectedOptions={[q.type]}
                  onOptionSelect={(_, d) => d.optionValue && set(i, { type: d.optionValue as QuestionDraft["type"] })}
                >
                  {QUESTION_TYPES.map((t) => (
                    <Option key={t.value} value={t.value}>
                      {t.label}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Maps to profile field" hint="Optional; proposed to recruiters">
                <Dropdown
                  value={MAPS_TO.find((m) => m.value === q.maps_to)?.label ?? "None"}
                  selectedOptions={[q.maps_to || NONE]}
                  onOptionSelect={(_, d) => set(i, { maps_to: d.optionValue === NONE ? "" : (d.optionValue as QuestionDraft["maps_to"]) })}
                >
                  <Option value={NONE}>None</Option>
                  {MAPS_TO.map((m) => (
                    <Option key={m.value} value={m.value}>
                      {m.label}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Key" {...err(`${i}.key`)}>
                <Input value={q.key} maxLength={60} onChange={(_, d) => set(i, { key: d.value })} />
              </Field>
            </div>
            {q.type === "choice" && (
              <Field label="Options" hint="One per line" required {...err(`${i}.options`)}>
                <Textarea value={q.options} resize="vertical" onChange={(_, d) => set(i, { options: d.value })} />
              </Field>
            )}
            <Switch checked={q.required} label="Required" onChange={(_, d) => set(i, { required: d.checked })} />
          </Card>
        ))}
        <div>
          <Button icon={<Add20Regular />} disabled={list.length >= MAX_QUESTIONS} onClick={() => setList((l) => [...l, emptyQuestion(l.map((x) => x.key))])}>
            Add question
          </Button>
        </div>
      </DialogContent>
      <DialogActions>
        <Button appearance="primary" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={save}>
          Save questions
        </Button>
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
      </DialogActions>
    </>
  );
}

function Loader({ demandId, postingId, onClose }: { demandId: string; postingId: string; onClose: () => void }) {
  const { data: me } = useMe();
  const slug = me?.tenant.slug;
  const current = useQuery({
    queryKey: careerSiteKeys.applyQuestions(postingId),
    queryFn: ({ signal }) => careerSiteApi.publicApplyForm(slug as string, postingId, signal),
    enabled: !!slug,
    retry: false,
    staleTime: 0,
  });
  if (!slug || current.isPending) return <DialogContent><Spinner label="Loading questions…" /></DialogContent>;
  // Without an enabled career site the public form is unavailable: start from an empty list.
  const initial = current.data ? current.data.apply_questions.map(fromPublic) : [];
  return <Editor demandId={demandId} initial={initial} onClose={onClose} />;
}

/** "Apply questions" button + dialog for a demand's live posting (Epic 9, B5). */
export function ApplyQuestionsButton({ demandId, postingId }: { demandId: string; postingId: string }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="small" icon={<TextBulletListSquareEdit20Regular />} onClick={() => setOpen(true)}>
        Apply questions
      </Button>
      {open && (
        <Dialog open onOpenChange={(_, d) => !d.open && setOpen(false)}>
          <DialogSurface className={styles.surface}>
            <DialogBody>
              <DialogTitle>Apply questions</DialogTitle>
              <Loader demandId={demandId} postingId={postingId} onClose={() => setOpen(false)} />
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </>
  );
}
