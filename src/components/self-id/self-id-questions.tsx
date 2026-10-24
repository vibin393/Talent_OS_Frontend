"use client";

import {
  Body1,
  Button,
  Caption1,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Spinner,
  Subtitle2,
  tokens,
} from "@fluentui/react-components";
import { useId } from "react";
import { dimensionOptions, PREFER_NOT, SELF_ID_STATEMENT, visibleDimensions } from "@/features/fairness/logic";
import type { DimensionOut, NoticeOut, SelfIdAnswers } from "@/features/fairness/types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, minWidth: 0 },
  statement: {
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    borderLeft: `${tokens.strokeWidthThickest} solid ${tokens.colorBrandStroke1}`,
  },
  notice: {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    maxHeight: "220px",
    overflowY: "auto",
    padding: tokens.spacingHorizontalM,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}` },
  },
  muted: { color: tokens.colorNeutralForeground2 },
  radios: { "& label": { minHeight: "32px", overflowWrap: "anywhere" } },
  actions: { display: "flex", flexWrap: "wrap-reverse", gap: tokens.spacingHorizontalS, justifyContent: "flex-end" },
  button: { minHeight: "44px", minWidth: "44px" },
});

export type SelfIdQuestionsProps = {
  dimensions: readonly DimensionOut[];
  notice: NoticeOut | null;
  value: SelfIdAnswers;
  onChange: (value: SelfIdAnswers) => void;
  /** Save the answers (omit to render the questions only). */
  onSubmit?: () => void;
  submitLabel?: string;
  /** Skip / cancel (skipping is the default; nothing is required). */
  onSkip?: () => void;
  skipLabel?: string;
  busy?: boolean;
  error?: string | null;
  /** Extra actions (e.g. "Delete my answers") rendered before the buttons. */
  extraActions?: React.ReactNode;
  headingLevel?: "h2" | "h3";
  title?: string;
};

/**
 * Optional demographic self-identification (Epic 49): the separate notice with its version, one radio group per
 * enabled dimension (gender, age band, disability only) defaulting to "Prefer not to say". Props-driven so the
 * careers apply success step and the Candidate Portal privacy page share it.
 */
export function SelfIdQuestions({
  dimensions,
  notice,
  value,
  onChange,
  onSubmit,
  submitLabel = "Save answers",
  onSkip,
  skipLabel = "Skip",
  busy = false,
  error,
  extraActions,
  headingLevel = "h2",
  title = "Voluntary self-identification",
}: SelfIdQuestionsProps) {
  const styles = useStyles();
  const id = useId();
  const dims = visibleDimensions(dimensions);
  if (dims.length === 0) return null;
  const noticeId = `${id}-notice`;
  return (
    <section className={styles.root} aria-labelledby={`${id}-title`}>
      <Subtitle2 as={headingLevel} id={`${id}-title`}>
        {title}
      </Subtitle2>
      <Body1 className={styles.statement} id={`${id}-statement`}>
        <strong>{SELF_ID_STATEMENT}</strong> Your answers are kept separately from your application, used only in anonymous,
        aggregated fairness statistics, and you can change or delete them at any time in the candidate portal.
      </Body1>
      {notice && (
        <div>
          <Caption1 className={styles.muted} id={noticeId}>
            {notice.title} (version {notice.version})
          </Caption1>
          {/* Plain text rendering of the notice body: never interpreted as HTML. */}
          <div/* NOSONAR */ className={styles.notice} tabIndex={0} role="region" aria-labelledby={noticeId}>
            <Body1>{notice.text}</Body1>
          </div>
        </div>
      )}
      {dims.map((d) => (
        <Field key={d.key} label={d.label} className={styles.radios}>
          <RadioGroup
            value={value[d.key] ?? PREFER_NOT}
            disabled={busy}
            aria-describedby={`${id}-statement`}
            onChange={(_, data) => onChange({ ...value, [d.key]: data.value })}
          >
            {dimensionOptions(d).map((o) => (
              <Radio key={o.key} value={o.key} label={o.label} />
            ))}
          </RadioGroup>
        </Field>
      ))}
      {error && (
        <MessageBar intent="error" layout="multiline" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {(onSubmit || onSkip || extraActions) && (
        <div className={styles.actions}>
          {extraActions}
          {onSkip && (
            <Button className={styles.button} disabled={busy} onClick={onSkip}>
              {skipLabel}
            </Button>
          )}
          {onSubmit && (
            <Button
              appearance="primary"
              className={styles.button}
              disabled={busy || !notice}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={onSubmit}
            >
              {submitLabel}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
