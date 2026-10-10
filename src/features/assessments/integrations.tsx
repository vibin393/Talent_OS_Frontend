"use client";

import { Badge, Caption1, Checkbox, Combobox, Field, Link, makeStyles, Option, Spinner, Text, tokens, Tooltip } from "@fluentui/react-components";
import { ClipboardTask16Regular } from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { assessmentsApi } from "./api";
import { INVITATION_STATUS_COLORS, INVITATION_STATUS_LABELS, pctLabel } from "./logic";
import type { InvitationOut } from "./types";
import { assessmentKeys, useAssessmentBadge, useAssessmentPermissions, useCandidateResults, usePublishedAssessments } from "./use-assessments";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  muted: { color: tokens.colorNeutralForeground3 },
  box: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
});

/** Pipeline card badge: the application's latest assessment status and score (batched for the whole board). */
export function AssessmentCardBadge({ applicationId }: { applicationId: string }) {
  const q = useAssessmentBadge(applicationId);
  const b = q.data;
  if (!b) return null;
  const label = `${INVITATION_STATUS_LABELS[b.status] ?? b.status}${b.score != null ? ` · ${pctLabel(b.score)}` : ""}`;
  return (
    <Tooltip content={`Assessment: ${label}`} relationship="description">
      <Badge size="small" appearance="tint" color={INVITATION_STATUS_COLORS[b.status] ?? "informative"} icon={<ClipboardTask16Regular />}>
        {label}
      </Badge>
    </Tooltip>
  );
}

/**
 * Interview plan: the published-assessment picker shown for a stage of kind "assessment" (sets `assessment_id`),
 * with a hint pointing to the workflow builder for automatic invites on stage entry.
 */
export function StageAssessmentPicker({
  value,
  onChange,
  error,
  size = "small",
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
  size?: "small" | "medium";
}) {
  const styles = useStyles();
  const { canRead, canAuthor } = useAssessmentPermissions();
  const published = usePublishedAssessments(canRead || canAuthor);
  const current = published.data?.find((a) => a.id === value);
  return (
    <Field
      label="Assessment"
      size={size}
      required
      validationState={error ? "error" : "none"}
      validationMessage={error}
      hint={
        <span>
          Automatic invites on stage entry are set up in the <AppLink href="/admin/workflows">workflow builder</AppLink>.
        </span>
      }
    >
      <Combobox
        size={size}
        value={current?.name ?? (value ? "Unavailable assessment" : "")}
        placeholder={published.isPending ? "Loading…" : "Choose a published assessment"}
        selectedOptions={value ? [value] : []}
        onOptionSelect={(_, d) => onChange(d.optionValue ?? null)}
      >
        {(published.data ?? []).map((a) => (
          <Option key={a.id} value={a.id} text={a.name}>
            {a.name}
          </Option>
        ))}
        {published.data?.length === 0 && (
          <Option disabled value="__none__" text="">
            No published assessments
          </Option>
        )}
      </Combobox>
      {published.isError && <Caption1 className={styles.muted}>{errorMessage(published.error)}</Caption1>}
    </Field>
  );
}

const SHAREABLE = new Set(["reviewed", "passed", "failed"]);

/**
 * "Include assessment results" for one submission: the candidate's reviewed / passed / failed invitations as a
 * Checkbox list, saved with PUT /submissions/{id}/assessment-shares. Shown on the submission card (the composer
 * creates and sends the submission in one step, so there is no submission id before sending).
 */
export function SubmissionAssessmentShares({ submissionId, candidateId, canEdit }: { submissionId: string; candidateId: string; canEdit: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const { canRead } = useAssessmentPermissions();
  const results = useCandidateResults(candidateId, canRead);
  const shares = useQuery({
    queryKey: assessmentKeys.shares(submissionId),
    queryFn: ({ signal }) => assessmentsApi.shares(submissionId, signal),
    enabled: canRead,
    retry: false,
  });
  const [saving, setSaving] = useState(false);
  if (!canRead) return null;
  const eligible = (results.data ?? []).filter((i: InvitationOut) => SHAREABLE.has(i.status));
  if (results.isPending || shares.isPending) return <Spinner size="tiny" label="Loading assessment results…" />;
  if (eligible.length === 0) return null;
  const selected = new Set(shares.data?.invitation_ids ?? []);
  const toggle = async (id: string, on: boolean) => {
    const next = on ? [...selected, id] : [...selected].filter((x) => x !== id);
    setSaving(true);
    try {
      const out = await assessmentsApi.saveShares(submissionId, next);
      qc.setQueryData(assessmentKeys.shares(submissionId), out);
      toast.success(on ? "Assessment result shared with the client" : "Assessment result no longer shared");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={styles.box} role="group" aria-label="Include assessment results">
      <Text weight="semibold">Include assessment results</Text>
      <Caption1 className={styles.muted}>Only the results you tick are visible to the client.</Caption1>
      {eligible.map((i) => (
        <Checkbox
          key={i.id}
          disabled={!canEdit || saving}
          checked={selected.has(i.id)}
          onChange={(_, d) => void toggle(i.id, Boolean(d.checked))}
          label={`${i.assessment_name} · ${INVITATION_STATUS_LABELS[i.status]} · ${pctLabel(i.score)}`}
        />
      ))}
      {shares.isError && <Link onClick={() => void shares.refetch()}>Could not load shares. Retry</Link>}
    </div>
  );
}
