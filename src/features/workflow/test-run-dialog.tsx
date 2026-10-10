"use client";

import {
  Badge,
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircle16Filled, DismissCircle16Filled } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { EntityPicker, type EntityValue } from "@/features/tasks/entity-picker";
import { errorMessage } from "@/lib/api/errors";
import type { WorkflowDryRunOut, WorkflowRegistryOut, WorkflowRuleIn } from "@/lib/api/types";
import { workflowApi } from "./api";
import { ValueEditor } from "./condition-editor";
import { actionLines, traceLines } from "./rule-model";

const useStyles = makeStyles({
  surface: { width: "min(720px, calc(100vw - 32px))", maxWidth: "min(720px, calc(100vw - 32px))" },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  extras: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: tokens.spacingHorizontalM },
  result: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, marginTop: tokens.spacingVerticalM },
  line: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-start" },
  ok: { color: tokens.colorPaletteGreenForeground1, flexShrink: 0, marginTop: "2px" },
  bad: { color: tokens.colorPaletteRedForeground1, flexShrink: 0, marginTop: "2px" },
  muted: { color: tokens.colorNeutralForeground3 },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rendered dry-run result: ✓/✗ per condition with the actual value, and "Would …" action lines. */
export function TestRunResult({ result, registry }: { result: WorkflowDryRunOut; registry: WorkflowRegistryOut | undefined }) {
  const styles = useStyles();
  const fields = registry?.triggers.flatMap((t) => t.fields) ?? [];
  const labels = Object.fromEntries((registry?.actions ?? []).map((a) => [a.type, a.label]));
  const trace = traceLines(result.condition_trace, fields);
  const actions = actionLines(result.action_results, labels);
  return (
    <div className={styles.result} aria-live="polite">
      <MessageBar intent="info">
        <MessageBarBody>{result.note || "Nothing was executed or sent."}</MessageBarBody>
      </MessageBar>
      <div className={styles.line}>
        <Subtitle2 as="h3">Conditions</Subtitle2>
        <Badge appearance="tint" color={result.matched ? "success" : "danger"}>
          {result.matched ? "Matched" : "Not matched"}
        </Badge>
      </div>
      {trace.length === 0 ? (
        <Body1 className={styles.muted}>No conditions — the rule always runs.</Body1>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {trace.map((t) => (
            <li key={t.key} className={styles.line}>
              {t.ok ? (
                <CheckmarkCircle16Filled className={styles.ok} aria-label="Passed" />
              ) : (
                <DismissCircle16Filled className={styles.bad} aria-label="Failed" />
              )}
              <Text>
                {t.label} <span className={styles.muted}>(actual: {t.actual})</span>
                {t.note && <span className={styles.muted}> — {t.note}</span>}
              </Text>
            </li>
          ))}
        </ul>
      )}
      <Subtitle2 as="h3">Actions</Subtitle2>
      {!result.matched ? (
        <Body1 className={styles.muted}>The conditions did not match, so no action would run.</Body1>
      ) : actions.length === 0 ? (
        <Body1 className={styles.muted}>This rule has no actions.</Body1>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {actions.map((a) => (
            <li key={a.key} className={styles.line}>
              {a.ok ? (
                <CheckmarkCircle16Filled className={styles.ok} aria-label="Would run" />
              ) : (
                <DismissCircle16Filled className={styles.bad} aria-label="Would fail" />
              )}
              <Text>{a.text}</Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Test run (dry run): pick a record for the trigger's entity type and optional event values; the saved
 * rule (or the unsaved draft) is evaluated with zero side effects.
 */
export function TestRunDialog({
  ruleId,
  draft,
  trigger,
  registry,
  onClose,
}: {
  /** Saved rule to test; null tests `draft` (unsaved changes). */
  ruleId: string | null;
  draft: WorkflowRuleIn;
  trigger: string;
  registry: WorkflowRegistryOut | undefined;
  onClose: () => void;
}) {
  const styles = useStyles();
  const def = registry?.triggers.find((t) => t.key === trigger);
  const entityType = def?.entity_type;
  const searchable = entityType === "candidate" || entityType === "demand";
  const [entity, setEntity] = useState<EntityValue>(null);
  const [rawId, setRawId] = useState("");
  const [extras, setExtras] = useState<Record<string, unknown>>({});
  const eventFields = (def?.fields ?? []).filter((f) => f.path.startsWith("event."));
  const entityId = searchable ? (entity?.id ?? "") : rawId.trim();

  const run = useMutation({
    mutationFn: () => {
      const cleaned = Object.fromEntries(
        Object.entries(extras)
          .filter(([, v]) => v !== "" && v !== null && v !== undefined)
          .map(([k, v]) => [k.replace(/^event\./, ""), v]),
      );
      return ruleId ? workflowApi.dryRun(ruleId, entityId, cleaned) : workflowApi.dryRunDraft(draft, entityId, cleaned);
    },
  });

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>Test run</DialogTitle>
          <DialogContent>
            <div className={styles.form}>
              <Body1 className={styles.muted}>
                {ruleId ? "Runs the saved rule" : "Runs your unsaved changes"} against a real record without changing anything.
              </Body1>
              {searchable ? (
                <EntityPicker
                  label={entityType === "demand" ? "Demand" : "Candidate"}
                  value={entity}
                  onChange={setEntity}
                  types={[entityType]}
                />
              ) : (
                <Field
                  label={`${entityType ? entityType.charAt(0).toUpperCase() + entityType.slice(1) : "Record"} ID`}
                  hint="Paste the record's ID (from its address bar)."
                  validationState={rawId && !UUID_RE.test(rawId.trim()) ? "error" : "none"}
                  validationMessage={rawId && !UUID_RE.test(rawId.trim()) ? "That is not a record ID." : undefined}
                >
                  <Input value={rawId} onChange={(_, d) => setRawId(d.value)} />
                </Field>
              )}
              {eventFields.length > 0 && (
                <div className={styles.extras}>
                  {eventFields.map((f) => (
                    <Field key={f.path} label={`${f.label} (optional)`}>
                      <ValueEditor
                        field={f}
                        op="eq"
                        value={extras[f.path] ?? null}
                        onChange={(v) => setExtras((x) => ({ ...x, [f.path]: v }))}
                      />
                    </Field>
                  ))}
                </div>
              )}
              {run.isError && (
                <MessageBar intent="error">
                  <MessageBarBody>{errorMessage(run.error, "The test run failed.")}</MessageBarBody>
                </MessageBar>
              )}
              {run.data && <TestRunResult result={run.data} registry={registry} />}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
            <Button
              appearance="primary"
              disabled={!UUID_RE.test(entityId) || run.isPending}
              icon={run.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => run.mutate()}
            >
              Run test
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
