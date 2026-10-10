"use client";

import {
  Badge,
  Button,
  Dropdown,
  Field,
  Option,
  SpinButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Tag,
  TagGroup,
  Text,
  ToolbarButton,
} from "@fluentui/react-components";
import { DatePicker } from "@fluentui/react-datepicker-compat";
import { ClipboardTask20Regular } from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar } from "@/features/admin/ui";
import { CandidatePicker } from "@/features/privacy/candidate-picker";
import { errorMessage } from "@/lib/api/errors";
import { assessmentsApi } from "./api";
import { accommodationString, endOfDayIso } from "./logic";
import type { BulkInviteResult } from "./types";
import { DialogShell, useAsmStyles } from "./ui";
import { assessmentKeys, useAssessmentPermissions, usePublishedAssessments } from "./use-assessments";

export type InviteApp = { applicationId: string; candidateId: string; name: string };

/**
 * Where the invite comes from:
 * - `application`: pipeline (one application → single invite; several → bulk with `application_ids`);
 * - `direct`: Candidate 360;
 * - `pick`: the Assessment page, where candidates are picked (bulk with `candidate_ids`).
 */
export type InviteContext =
  | { kind: "application"; apps: InviteApp[] }
  | { kind: "direct"; candidateId: string; candidateName?: string | null }
  | { kind: "pick" };

const ERROR_LABELS: Record<string, string> = {
  attempts_exhausted: "Attempts limit reached",
  assessment_not_published: "Assessment not published",
  candidate_erased: "Candidate erased",
  already_invited: "Already invited",
};

/** Reusable invite dialog: assessment (unless fixed), deadline, gating, accommodation factor and screen-reader mode. */
export function InviteDialog({
  assessmentId,
  context,
  onClose,
  onDone,
}: {
  assessmentId?: string;
  context: InviteContext;
  onClose: () => void;
  onDone?: () => void;
}) {
  const styles = useAsmStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const published = usePublishedAssessments(!assessmentId);
  const [picked, setPicked] = useState<string | null>(assessmentId ?? null);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [gating, setGating] = useState<boolean | null>(null);
  const [factor, setFactor] = useState(1);
  const [screenReader, setScreenReader] = useState(false);
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([]);
  const [results, setResults] = useState<BulkInviteResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = published.data?.find((a) => a.id === picked);
  const gatingValue = gating ?? selected?.gating_default ?? null;

  const targets =
    context.kind === "application" ? context.apps.length : context.kind === "direct" ? 1 : candidates.length;
  const nameOf = (r: BulkInviteResult) =>
    (context.kind === "application" ? context.apps.find((a) => a.applicationId === r.application_id || a.candidateId === r.candidate_id)?.name : undefined) ??
    candidates.find((c) => c.id === r.candidate_id)?.name ??
    r.candidate_id;

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    const common = {
      deadline_at: deadline ? endOfDayIso(deadline) : null,
      ...(gating !== null ? { gating } : {}),
      accommodation_factor: accommodationString(factor),
    };
    try {
      if (context.kind === "direct" || (context.kind === "application" && context.apps.length === 1)) {
        const one = context.kind === "direct" ? { candidate_id: context.candidateId, context_kind: "direct" as const } : {
          candidate_id: context.apps[0].candidateId,
          application_id: context.apps[0].applicationId,
          context_kind: "application" as const,
          context_id: context.apps[0].applicationId,
        };
        const inv = await assessmentsApi.invite({ assessment_id: picked, ...one, ...common, send_notice: true, idempotency_key: crypto.randomUUID() });
        // The single-invite body has no screen-reader flag; it is set on the fresh (still `invited`) invitation.
        if (screenReader) await assessmentsApi.patchInvitation(inv.id, { screen_reader_mode: true });
        toast.success("Invitation sent");
        void qc.invalidateQueries({ queryKey: assessmentKeys.all });
        onDone?.();
        onClose();
        return;
      }
      const body =
        context.kind === "application"
          ? { application_ids: context.apps.map((a) => a.applicationId), ...common }
          : { candidate_ids: candidates.map((c) => c.id), ...common };
      const out = await assessmentsApi.bulkInvite(picked, { ...body, screen_reader_mode: screenReader });
      setResults(out.results);
      void qc.invalidateQueries({ queryKey: assessmentKeys.all });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Bulk callers (the pipeline bulk bar) clear their selection in `onDone`, which unmounts this dialog: run it on close.
  const finish = () => {
    onDone?.();
    onClose();
  };

  if (results) {
    const created = results.filter((r) => r.status === "created").length;
    return (
      <DialogShell
        title="Invitation results"
        onClose={finish}
        actions={
          <Button appearance="primary" onClick={finish}>
            Done
          </Button>
        }
      >
        <div className={styles.stack}>
          <Text>
            {created} invited · {results.filter((r) => r.status === "exists").length} already invited · {results.filter((r) => r.status === "error").length} failed
          </Text>
          <Table size="small" aria-label="Per-candidate results">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Candidate</TableHeaderCell>
                <TableHeaderCell>Result</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={`${r.candidate_id}:${r.application_id ?? ""}`}>
                  <TableCell>{nameOf(r)}</TableCell>
                  <TableCell>
                    <Badge appearance="tint" color={r.status === "created" ? "success" : r.status === "exists" ? "informative" : "danger"}>
                      {r.status === "created" ? "Invited" : r.status === "exists" ? "Already invited" : (ERROR_LABELS[r.error_code ?? ""] ?? r.error_code ?? "Error")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogShell>
    );
  }

  return (
    <DialogShell
      title={targets > 1 ? `Invite ${targets} candidates to an assessment` : "Invite to an assessment"}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button appearance="primary" disabled={busy || !picked || targets === 0} onClick={() => void submit()}>
            Send invitation{targets > 1 ? "s" : ""}
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        {context.kind === "direct" && context.candidateName && <Text>Candidate: {context.candidateName}</Text>}
        {context.kind === "application" && (
          <TagGroup aria-label="Candidates">
            {context.apps.slice(0, 12).map((a) => (
              <Tag key={a.applicationId} size="small">
                {a.name}
              </Tag>
            ))}
            {context.apps.length > 12 && <Tag size="small">+{context.apps.length - 12} more</Tag>}
          </TagGroup>
        )}
        {!assessmentId && (
          <Field label="Assessment" required hint={published.data?.length === 0 ? "Publish an assessment first." : undefined}>
            <Dropdown
              value={selected?.name ?? ""}
              placeholder={published.isPending ? "Loading…" : "Choose a published assessment"}
              selectedOptions={picked ? [picked] : []}
              onOptionSelect={(_, d) => setPicked(d.optionValue ?? null)}
            >
              {(published.data ?? []).map((a) => (
                <Option key={a.id} value={a.id} text={a.name}>
                  {a.name}
                  {a.time_limit_minutes ? ` · ${a.time_limit_minutes} min` : ""}
                </Option>
              ))}
            </Dropdown>
          </Field>
        )}
        {context.kind === "pick" && (
          <>
            <CandidatePicker
              label="Add candidate"
              value={null}
              onChange={(id, c) => {
                if (id && !candidates.some((x) => x.id === id)) setCandidates((list) => [...list, { id, name: c?.full_name ?? id }]);
              }}
            />
            {candidates.length > 0 && (
              <TagGroup aria-label="Selected candidates" onDismiss={(_, d) => setCandidates((list) => list.filter((c) => c.id !== d.value))}>
                {candidates.map((c) => (
                  <Tag key={c.id} value={c.id} dismissible dismissIcon={{ "aria-label": `Remove ${c.name}` }}>
                    {c.name}
                  </Tag>
                ))}
              </TagGroup>
            )}
          </>
        )}
        <Field label="Deadline" hint="End of the chosen day. Empty uses the tenant default.">
          <DatePicker value={deadline} minDate={new Date()} placeholder="Choose a date" allowTextInput onSelectDate={(d) => setDeadline(d ?? null)} />
        </Field>
        <Switch
          label={gatingValue ? "Gating: a human decides Pass/Fail before the candidate moves on" : "Gating off: the result is informational"}
          checked={Boolean(gatingValue)}
          onChange={(_, d) => setGating(d.checked)}
        />
        <Field label="Accommodation (time multiplier)" hint="1.00–3.00 in steps of 0.25; extends the time limit.">
          <SpinButton
            value={factor}
            min={1}
            max={3}
            step={0.25}
            precision={2}
            onChange={(_, d) => {
              const v = d.value ?? Number(d.displayValue);
              if (Number.isFinite(v)) setFactor(Number(accommodationString(Number(v))));
            }}
          />
        </Field>
        <Switch label="Screen-reader mode (quieter timer, announcements only at 5 and 1 minutes)" checked={screenReader} onChange={(_, d) => setScreenReader(d.checked)} />
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}

/** Button + dialog for a single context (pipeline drawer, Candidate 360). Hidden without `assessment:invite`. */
export function InviteToAssessmentButton({ context, label = "Invite to assessment", size }: { context: InviteContext; label?: string; size?: "small" | "medium" }) {
  const { canInvite } = useAssessmentPermissions();
  const [open, setOpen] = useState(false);
  if (!canInvite) return null;
  return (
    <>
      <Button size={size} icon={<ClipboardTask20Regular />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && <InviteDialog context={context} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Pipeline bulk-bar toolbar button: invites the selected applications (bulk endpoint with `application_ids`). */
export function InviteToAssessmentToolbarButton({ apps, onDone }: { apps: InviteApp[]; onDone?: () => void }) {
  const { canInvite } = useAssessmentPermissions();
  const [open, setOpen] = useState(false);
  if (!canInvite) return null;
  return (
    <>
      <ToolbarButton icon={<ClipboardTask20Regular />} disabled={apps.length === 0} onClick={() => setOpen(true)}>
        Invite to assessment
      </ToolbarButton>
      {open && <InviteDialog context={{ kind: "application", apps }} onClose={() => setOpen(false)} onDone={onDone} />}
    </>
  );
}
