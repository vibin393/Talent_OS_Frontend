"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Dropdown,
  Field,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Checkmark16Regular, Dismiss16Regular, History16Regular, ShieldCheckmark16Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DetailsDrawer, ErrorBar, formatDateTime } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { skillGraphApi, skillGraphKeys } from "./graph-api";
import { PROFICIENCY_LABELS, proficiencyLabel, SUGGESTION_SOURCE_LABELS, verificationBadge } from "./logic";
import type { SkillProfileRow, SkillSuggestion, Verification } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  muted: { color: tokens.colorNeutralForeground3 },
  timeline: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, listStyleType: "none", padding: 0, margin: 0 },
  item: {
    borderLeft: `2px solid ${tokens.colorNeutralStroke2}`,
    paddingLeft: tokens.spacingHorizontalM,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
  },
  superseded: { opacity: 0.6, textDecorationLine: "line-through" },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end", flexWrap: "wrap" },
  table: { minWidth: "320px" },
  scroll: { overflowX: "auto" },
});

const PROFICIENCY_OPTIONS = [1, 2, 3, 4, 5];

export function VerificationBadge({ v }: { v: Verification }) {
  const b = verificationBadge(v);
  const badge = (
    <Badge appearance={b.color === "subtle" ? "outline" : "filled"} color={b.color === "subtle" ? "subtle" : b.color}>
      {b.label}
    </Badge>
  );
  return b.tooltip ? (
    <Tooltip content={b.tooltip} relationship="description">
      {badge}
    </Tooltip>
  ) : (
    badge
  );
}

function ProficiencyPicker({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  return (
    <Field label={label}>
      <Dropdown
        value={value ? proficiencyLabel(value) : ""}
        selectedOptions={value ? [String(value)] : []}
        placeholder="Select"
        onOptionSelect={(_, d) => onChange(d.optionValue ? Number(d.optionValue) : null)}
      >
        {PROFICIENCY_OPTIONS.map((p) => (
          <Option key={p} value={String(p)} text={proficiencyLabel(p)}>
            {`${p} · ${PROFICIENCY_LABELS[p]}`}
          </Option>
        ))}
      </Dropdown>
    </Field>
  );
}

/** Candidate 360 → Skills: proficiency, verification, evidence history (drawer) and pending suggestions. */
export function SkillProficiencySection({ candidateId }: { candidateId: string }) {
  const styles = useStyles();
  const profile = useQuery({
    queryKey: skillGraphKeys.profile(candidateId),
    queryFn: ({ signal }) => skillGraphApi.profile(candidateId, signal),
  });
  const [open, setOpen] = useState<SkillProfileRow | null>(null);
  return (
    <section className={styles.root} aria-label="Skill proficiency">
      <Subtitle2 as="h3">Proficiency and verification</Subtitle2>
      <SuggestionsPanel candidateId={candidateId} />
      {profile.isLoading && <Spinner size="tiny" label="Loading proficiency…" />}
      <ErrorBar message={profile.error ? errorMessage(profile.error) : null} />
      {profile.data && profile.data.length > 0 && (
        <div className={styles.scroll}>
          <Table size="small" aria-label="Skill proficiency" className={styles.table}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Skill</TableHeaderCell>
                <TableHeaderCell>Proficiency</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Evidence</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.data.map((r) => (
                <TableRow key={r.candidate_skill_id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{proficiencyLabel(r.proficiency)}</TableCell>
                  <TableCell>
                    <VerificationBadge v={r.verification} />
                  </TableCell>
                  <TableCell>
                    <Button size="small" appearance="subtle" icon={<History16Regular />} onClick={() => setOpen(r)}>
                      {r.evidence_count}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {open && <EvidenceDrawer candidateId={candidateId} row={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function EvidenceDrawer({ candidateId, row, onClose }: { candidateId: string; row: SkillProfileRow; onClose: () => void }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const canVerify = usePermission("skill:verify");
  const [level, setLevel] = useState<number | null>(row.proficiency);
  const [note, setNote] = useState("");
  const history = useQuery({
    queryKey: skillGraphKeys.evidence(candidateId, row.candidate_skill_id),
    queryFn: ({ signal }) => skillGraphApi.evidence(candidateId, row.candidate_skill_id, signal),
  });
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: skillGraphKeys.evidence(candidateId, row.candidate_skill_id) }),
      qc.invalidateQueries({ queryKey: skillGraphKeys.profile(candidateId) }),
      qc.invalidateQueries({ queryKey: ["candidates"] }),
    ]);
  const verify = useMutation({
    mutationFn: () =>
      skillGraphApi.addEvidence(candidateId, row.candidate_skill_id, { kind: "recruiter", proficiency: level, note: note.trim() || null }),
    onSuccess: refresh,
  });
  const supersede = useMutation({
    mutationFn: (id: string) => skillGraphApi.supersede(candidateId, row.candidate_skill_id, id),
    onSuccess: refresh,
  });
  return (
    <DetailsDrawer open title={`${row.name} — evidence`} onClose={onClose}>
      <div className={styles.root}>
        <ErrorBar message={verify.error ? errorMessage(verify.error) : supersede.error ? errorMessage(supersede.error) : null} />
        {canVerify && (
          <div className={styles.row}>
            <ProficiencyPicker label="Verified proficiency" value={level} onChange={setLevel} />
            <Field label="Note">
              <Textarea value={note} onChange={(_, d) => setNote(d.value)} resize="vertical" maxLength={2000} />
            </Field>
            <Button
              appearance="primary"
              icon={<ShieldCheckmark16Regular />}
              disabled={!level || verify.isPending}
              onClick={() => verify.mutate()}
            >
              Verify
            </Button>
          </div>
        )}
        {history.isLoading && <Spinner size="tiny" />}
        <ol className={styles.timeline} aria-label="Evidence history">
          {(history.data ?? []).map((e) => (
            <li key={e.id} className={mergeClasses(styles.item, e.superseded_at ? styles.superseded : undefined)}>
              <Text weight="semibold">
                {e.kind} · {proficiencyLabel(e.proficiency)}
              </Text>
              <Caption1 className={styles.muted}>
                {formatDateTime(e.observed_at)} · {e.created_by_name ?? e.created_by_kind}
                {e.superseded_at ? " · superseded" : ""}
              </Caption1>
              {e.note && <Body1>{e.note}</Body1>}
              {canVerify && !e.superseded_at && (e.kind === "recruiter" || e.kind === "self") && (
                <Button size="small" appearance="subtle" onClick={() => supersede.mutate(e.id)} disabled={supersede.isPending}>
                  Supersede
                </Button>
              )}
            </li>
          ))}
        </ol>
      </div>
    </DetailsDrawer>
  );
}

function SuggestionsPanel({ candidateId }: { candidateId: string }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const canEdit = usePermission("candidate:update");
  const [show, setShow] = useState(false);
  const [levels, setLevels] = useState<Record<string, number | null>>({});
  const list = useQuery({
    queryKey: skillGraphKeys.suggestions(candidateId),
    queryFn: ({ signal }) => skillGraphApi.suggestions(candidateId, signal),
  });
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: skillGraphKeys.suggestions(candidateId) }),
      qc.invalidateQueries({ queryKey: skillGraphKeys.profile(candidateId) }),
      qc.invalidateQueries({ queryKey: ["candidates"] }),
    ]);
  const accept = useMutation({
    mutationFn: (s: SkillSuggestion) => skillGraphApi.accept(candidateId, s.id, levels[s.id] ?? null),
    onSuccess: refresh,
  });
  const reject = useMutation({ mutationFn: (s: SkillSuggestion) => skillGraphApi.reject(candidateId, s.id), onSuccess: refresh });
  const items = list.data ?? [];
  if (!items.length) return null;
  return (
    <>
      <MessageBar intent="info">
        <MessageBarBody>
          {items.length} suggested skill{items.length === 1 ? "" : "s"} to review. Suggestions are never verified.
        </MessageBarBody>
        <MessageBarActions>
          <Button size="small" onClick={() => setShow((v) => !v)}>
            {show ? "Hide" : "Review"}
          </Button>
        </MessageBarActions>
      </MessageBar>
      {show && (
        <div className={styles.scroll}>
          <ErrorBar message={accept.error ? errorMessage(accept.error) : reject.error ? errorMessage(reject.error) : null} />
          <Table size="small" aria-label="Skill suggestions" className={styles.table}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Skill</TableHeaderCell>
                <TableHeaderCell>Source</TableHeaderCell>
                <TableHeaderCell>Proficiency</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Text weight="semibold">{s.name}</Text>
                    {s.rationale && (
                      <Caption1 className={styles.muted} block>
                        {s.rationale}
                      </Caption1>
                    )}
                  </TableCell>
                  <TableCell>
                    {SUGGESTION_SOURCE_LABELS[s.source]}
                    {s.source === "interview" && (
                      <Caption1 className={styles.muted} block>
                        Accepting as an interviewer on this interview marks it Verified.
                      </Caption1>
                    )}
                  </TableCell>
                  <TableCell>
                    <ProficiencyPicker
                      label="Proficiency"
                      value={levels[s.id] ?? s.proposed_proficiency}
                      onChange={(v) => setLevels((prev) => ({ ...prev, [s.id]: v }))}
                    />
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <div className={styles.row}>
                        <Button size="small" icon={<Checkmark16Regular />} onClick={() => accept.mutate(s)} disabled={accept.isPending}>
                          Accept
                        </Button>
                        <Button size="small" appearance="subtle" icon={<Dismiss16Regular />} onClick={() => reject.mutate(s)} disabled={reject.isPending}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
