"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Body1,
  Button,
  Caption1,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Label,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Rating,
  RatingDisplay,
  Spinner,
  Subtitle2,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useId, useRef, useState } from "react";
import { CompetencySuggestion, SuggestionsToggle } from "@/features/agents/interview-assistant/draft-suggestions";
import { RECOMMENDATION_NOTE, suggestionFor, suggestionsVisibleByDefault } from "@/features/agents/interview-assistant/logic";
import type { DraftRating } from "@/features/agents/interview-assistant/types";
import { RECOMMENDATIONS } from "./format";
import { hasErrors, type KitView, type ScorecardDraft, type ScorecardErrors, validateScorecard } from "./scorecard";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "860px" },
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingHorizontalL },
  ratingRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM },
  guidance: { color: tokens.colorNeutralForeground2, whiteSpace: "pre-wrap" },
  error: { color: tokens.colorPaletteRedForeground1 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
});

/**
 * Structured scorecard: kit guidance in an `Accordion`, a `Rating` 1..n with a note per competency, question notes,
 * a recommendation and a summary. Save draft (internal only) and Submit (confirmed; submitted scorecards are locked).
 * Used in-app and, in `public` mode, on the external interviewer's secure-link page.
 */
export function ScorecardForm({
  kit,
  initial,
  readOnly = false,
  onSaveDraft,
  onSubmit,
  error,
  publicMode = false,
  aiDraft,
}: {
  kit: KitView;
  initial: ScorecardDraft;
  readOnly?: boolean;
  /** Omitted in public mode (no drafts on secure links). */
  onSaveDraft?: (draft: ScorecardDraft) => Promise<unknown>;
  onSubmit: (draft: ScorecardDraft) => Promise<unknown>;
  error?: string | null;
  /** Secure-link page: no drafts, no mention of other scorecards. */
  publicMode?: boolean;
  /** Epic 60: the Interview Assistant's private draft (suggested ratings, hidden until "Show AI suggestions"). */
  aiDraft?: { ratings: DraftRating[]; showByDefault: boolean; onShown?: () => void } | null;
}) {
  const styles = useStyles();
  const id = useId();
  const [draft, setDraft] = useState<ScorecardDraft>(initial);
  const [errors, setErrors] = useState<ScorecardErrors>({ ratings: {} });
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const errorSummary = useRef<HTMLDivElement>(null);
  const [showAi, setShowAi] = useState(() => suggestionsVisibleByDefault(aiDraft?.showByDefault));
  const shownOnce = useRef(false);
  useEffect(() => {
    if (aiDraft && showAi && !readOnly && !shownOnce.current) {
      shownOnce.current = true;
      aiDraft.onShown?.();
    }
  }, [aiDraft, showAi, readOnly]);

  const setRating = (key: string, rating: number) => {
    setDraft((d) => ({ ...d, ratings: { ...d.ratings, [key]: { ...d.ratings[key], rating } } }));
    setErrors((e) => {
      const rest = { ...e.ratings };
      delete rest[key];
      return { ...e, ratings: rest };
    });
  };
  const setNote = (key: string, note: string) => setDraft((d) => ({ ...d, ratings: { ...d.ratings, [key]: { ...d.ratings[key], note } } }));

  const trySubmit = () => {
    const e = validateScorecard(draft, kit);
    setErrors(e);
    if (hasErrors(e)) {
      requestAnimationFrame(() => errorSummary.current?.focus());
      return;
    }
    setConfirming(true);
  };

  const run = async (kind: "draft" | "submit") => {
    setBusy(kind);
    try {
      if (kind === "draft") await onSaveDraft?.(draft);
      else await onSubmit(draft);
      setConfirming(false);
    } catch {
      setConfirming(false);
    } finally {
      setBusy(null);
    }
  };

  const missing = Object.keys(errors.ratings).length + (errors.recommendation ? 1 : 0);
  const guided = kit.competencies.some((c) => c.guidance) || kit.questions.some((q) => q.guidance);

  return (
    <div className={styles.root}>
      {error && (
        <MessageBar intent="error" layout="multiline" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {missing > 0 && (
        <div ref={errorSummary} tabIndex={-1} role="alert">
          <MessageBar intent="warning">
            <MessageBarBody>
              {missing === 1 ? "1 required answer is missing." : `${missing} required answers are missing.`} Rate every competency and choose a recommendation.
            </MessageBarBody>
          </MessageBar>
        </div>
      )}
      {guided && (
        <Accordion collapsible defaultOpenItems={readOnly ? [] : ["guide"]}>
          <AccordionItem value="guide">
            <AccordionHeader>Interview guide{kit.name ? ` · ${kit.name}` : ""}</AccordionHeader>
            <AccordionPanel>
              {kit.competencies
                .filter((c) => c.guidance)
                .map((c) => (
                  <Body1 as="p" key={c.key} className={styles.guidance}>
                    <strong>{c.label}:</strong> {c.guidance}
                  </Body1>
                ))}
              {kit.questions
                .filter((q) => q.guidance)
                .map((q) => (
                  <Body1 as="p" key={q.key} className={styles.guidance}>
                    <strong>{q.text}</strong> — {q.guidance}
                  </Body1>
                ))}
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      )}

      <section aria-labelledby={`${id}-competencies`}>
        <Subtitle2 as="h2" id={`${id}-competencies`}>
          Competencies
        </Subtitle2>
        <Caption1 as="p" className={styles.muted}>
          Rate each from 1 (poor) to {kit.ratingScale} (excellent).
        </Caption1>
        {aiDraft && !readOnly && (
          <SuggestionsToggle
            checked={showAi}
            onChange={(v) => setShowAi(v)}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
          {kit.competencies.map((c) => {
            const value = draft.ratings[c.key] ?? { rating: null, note: "" };
            const err = errors.ratings[c.key];
            return (
              <Card key={c.key} className={styles.card} appearance="outline">
                <div className={styles.ratingRow}>
                  <Label id={`${id}-${c.key}`} required weight="semibold">
                    {c.label}
                  </Label>
                  {readOnly ? (
                    <RatingDisplay max={kit.ratingScale} value={value.rating ?? 0} aria-labelledby={`${id}-${c.key}`} />
                  ) : (
                    <Rating
                      aria-labelledby={`${id}-${c.key}`}
                      max={kit.ratingScale}
                      value={value.rating ?? 0}
                      step={1}
                      itemLabel={(n) => `${n} of ${kit.ratingScale}`}
                      onChange={(_, d) => setRating(c.key, d.value)}
                    />
                  )}
                  <Text aria-hidden>{value.rating ? `${value.rating}/${kit.ratingScale}` : "Not rated"}</Text>
                </div>
                {aiDraft && showAi && !readOnly && suggestionFor(aiDraft.ratings, c.key) && (
                  <CompetencySuggestion
                    suggestion={suggestionFor(aiDraft.ratings, c.key)!}
                    scale={kit.ratingScale}
                    onUse={(n) => setRating(c.key, n)}
                  />
                )}
                {err && (
                  <Caption1 className={styles.error} role="alert">
                    {err}
                  </Caption1>
                )}
                <Field label="Evidence" size="small">
                  <Textarea value={value.note} readOnly={readOnly} maxLength={4000} resize="vertical" onChange={(_, d) => setNote(c.key, d.value)} />
                </Field>
              </Card>
            );
          })}
        </div>
      </section>

      {kit.questions.length > 0 && (
        <section aria-labelledby={`${id}-questions`}>
          <Subtitle2 as="h2" id={`${id}-questions`}>
            Questions
          </Subtitle2>
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, marginTop: tokens.spacingVerticalS }}>
            {kit.questions.map((q) => (
              <Field key={q.key} label={q.text} hint={q.guidance ?? undefined}>
                <Textarea
                  value={draft.answers[q.key] ?? ""}
                  readOnly={readOnly}
                  resize="vertical"
                  maxLength={8000}
                  onChange={(_, d) => setDraft((x) => ({ ...x, answers: { ...x.answers, [q.key]: d.value } }))}
                />
              </Field>
            ))}
          </div>
        </section>
      )}

      <Field label="Recommendation" required hint={aiDraft ? RECOMMENDATION_NOTE : undefined} validationState={errors.recommendation ? "error" : "none"} validationMessage={errors.recommendation}>
        <RadioGroup
          layout="horizontal"
          value={draft.recommendation ?? ""}
          disabled={readOnly}
          onChange={(_, d) => {
            setDraft((x) => ({ ...x, recommendation: d.value as ScorecardDraft["recommendation"] }));
            setErrors((e) => ({ ...e, recommendation: undefined }));
          }}
        >
          {RECOMMENDATIONS.map((r) => (
            <Radio key={r.value} value={r.value} label={r.label} />
          ))}
        </RadioGroup>
      </Field>
      <Field label="Summary">
        <Textarea value={draft.summary} readOnly={readOnly} resize="vertical" rows={4} maxLength={8000} onChange={(_, d) => setDraft((x) => ({ ...x, summary: d.value }))} />
      </Field>

      {!readOnly && (
        <div className={styles.actions}>
          <Button appearance="primary" disabled={!!busy} onClick={trySubmit}>
            Submit scorecard
          </Button>
          {onSaveDraft && (
            <Button disabled={!!busy} icon={busy === "draft" ? <Spinner size="tiny" /> : undefined} onClick={() => run("draft")}>
              Save draft
            </Button>
          )}
        </div>
      )}

      <Dialog open={confirming} modalType="alert" onOpenChange={(_, d) => !d.open && !busy && setConfirming(false)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Submit scorecard?</DialogTitle>
            <DialogContent>
              You can&apos;t edit after submitting.
              {publicMode ? "" : " Other interviewers’ scorecards become visible to you once yours is in."}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" disabled={!!busy} icon={busy === "submit" ? <Spinner size="tiny" /> : undefined} onClick={() => run("submit")}>
                Submit
              </Button>
              <Button disabled={!!busy} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
