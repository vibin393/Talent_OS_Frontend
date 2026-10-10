"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Spinner,
  Subtitle2,
  Tab,
  TabList,
  Title2,
  tokens, mergeClasses } from "@fluentui/react-components";
import {
  Add16Regular,
  Archive20Regular,
  ArrowDown20Regular,
  ArrowLeft20Regular,
  Beaker20Regular,
  Flash20Regular,
  Play20Regular,
  Save20Regular,
  Stop20Regular,
  Filter20Regular,
} from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { WorkflowRuleOut } from "@/lib/api/types";
import { ActionCard, actionAllowedFor } from "./action-editor";
import { actionsForTrigger } from "./allowed-actions";
import { workflowApi, workflowKeys } from "./api";
import { ConditionEditor } from "./condition-editor";
import { ExecutionsTab } from "./executions-tab";
import {
  type ActionDraft,
  buildRuleBody,
  emptyRule,
  newId,
  parseErrorPath,
  type RuleDraft,
  ruleDraftFrom,
  rowIdForError,
} from "./rule-model";
import { activationError } from "./rules-list";
import { TestRunDialog } from "./test-run-dialog";
import { useWorkflowRegistry, useWorkflowRule } from "./use-workflow";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  header: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  title: { flex: 1, minWidth: "240px", display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  tabs: {
    marginBottom: tokens.spacingVerticalL,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  flow: { display: "flex", flexDirection: "column", alignItems: "stretch", maxWidth: "960px" },
  connector: { display: "flex", justifyContent: "center", color: tokens.colorNeutralForeground3, paddingBlock: tokens.spacingVerticalXS },
  card: { gap: tokens.spacingVerticalM },
  cardIcon: {
    width: "32px",
    height: "32px",
    borderRadius: tokens.borderRadiusMedium,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForegroundOnBrand,
  },
  when: { backgroundColor: tokens.colorBrandBackground },
  if: { backgroundColor: tokens.colorPaletteDarkOrangeBackground3 },
  then: { backgroundColor: tokens.colorPaletteGreenBackground3 },
  row: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap", "& > *": { flex: "1 1 260px" } },
  actionsList: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  error: { outline: `${tokens.strokeWidthThick} solid ${tokens.colorPaletteRedBorder2}` },
  muted: { color: tokens.colorNeutralForeground3 },
});

type Problem = { title: string; message: string; path: string | null };

function problemFrom(e: unknown): Problem {
  if (isApiError(e) && ["invalid_condition", "invalid_action", "invalid_trigger"].includes(e.code)) {
    const path = typeof e.details.path === "string" ? e.details.path : null;
    const reason = typeof e.details.reason === "string" ? e.details.reason : e.message;
    const title = e.code === "invalid_condition" ? "Check the conditions" : e.code === "invalid_action" ? "Check the actions" : "Check the trigger";
    return { title, message: reason, path };
  }
  if (isApiError(e) && e.code === "rule_limit") return { title: "Too many active rules", message: activationError(e), path: null };
  return { title: "Could not save the rule.", message: errorMessage(e), path: null };
}

/** `/admin/workflows/[id]` (or `new`). */
export function RuleBuilderPage({ id }: { id: string }) {
  const canRead = usePermission("workflow:read");
  const isNew = id === "new";
  const rule = useWorkflowRule(isNew ? null : id);
  const registry = useWorkflowRegistry();
  if (!canRead) return <NoAccess what="workflow rules" />;
  if ((!isNew && rule.isPending) || registry.isPending) return <GridSkeleton rows={8} />;
  if (!isNew && rule.isError) {
    return (
      <>
        <ErrorBar
          title="Could not load the rule."
          message={isApiError(rule.error) && rule.error.status === 404 ? "This rule does not exist." : errorMessage(rule.error)}
        />
        <p>
          <AppLink href="/admin/workflows">Back to workflows</AppLink>
        </p>
      </>
    );
  }
  if (registry.isError) return <ErrorBar title="Could not load the rule builder." message={errorMessage(registry.error)} />;
  return <RuleBuilder key={rule.data?.id ?? "new"} rule={isNew ? undefined : rule.data} />;
}

function RuleBuilder({ rule }: { rule: WorkflowRuleOut | undefined }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canManage = usePermission("workflow:manage");
  const registry = useWorkflowRegistry().data;
  const initial = rule ? ruleDraftFrom(rule) : { draft: emptyRule(registry?.triggers.find((t) => t.available)?.key ?? ""), unsupported: false };
  const [draft, setDraft] = useState<RuleDraft>(initial.draft);
  const [savedBody, setSavedBody] = useState(() => JSON.stringify(buildRuleBody(initial.draft)));
  const [problem, setProblem] = useState<Problem | null>(null);
  const [tab, setTab] = useState<"rule" | "executions">("rule");
  const [testing, setTesting] = useState(false);
  const [confirm, setConfirm] = useState<"activate" | "archive" | null>(null);

  const body = buildRuleBody(draft);
  const dirty = !rule || JSON.stringify(body) !== savedBody;
  const trigger = registry?.triggers.find((t) => t.key === draft.trigger);
  const limits = registry?.limits ?? {};
  const errorRowId = problem?.path ? rowIdForError(draft, problem.path) : null;
  const errorTarget = problem?.path ? parseErrorPath(problem.path) : null;
  const readOnly = !canManage || !!rule?.archived_at;

  const set = (patch: Partial<RuleDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setActions = (actions: ActionDraft[]) => set({ actions });

  const refresh = (out: WorkflowRuleOut) => {
    queryClient.setQueryData(workflowKeys.rule(out.id), out);
    void queryClient.invalidateQueries({ queryKey: workflowKeys.rules });
  };

  const save = useMutation({
    mutationFn: () => (rule ? workflowApi.updateRule(rule.id, body) : workflowApi.createRule(body)),
    onSuccess: (out) => {
      setProblem(null);
      refresh(out);
      setSavedBody(JSON.stringify(body));
      toast.success(rule ? `Saved ${out.name}` : `Created ${out.name}. It is off until you turn it on.`);
      if (!rule) router.replace(`/admin/workflows/${out.id}`);
    },
    onError: (e) => setProblem(problemFrom(e)),
  });

  const toggle = useMutation({
    mutationFn: (on: boolean) => (on ? workflowApi.activate(rule?.id ?? "") : workflowApi.deactivate(rule?.id ?? "")),
    onSuccess: (out) => {
      refresh(out);
      toast.success(out.is_active ? `${out.name} is active` : `${out.name} is off`);
    },
    onError: (e) => toast.error(activationError(e)),
  });

  const archive = useMutation({
    mutationFn: () => workflowApi.archive(rule?.id ?? ""),
    onSuccess: (out) => {
      refresh(out);
      toast.success(`Archived ${out.name}`);
      router.push("/admin/workflows");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const maxActions = limits.max_actions ?? 10;
  const moveAction = (i: number, delta: -1 | 1) => {
    const next = [...draft.actions];
    const [a] = next.splice(i, 1);
    next.splice(i + delta, 0, a);
    setActions(next);
  };

  return (
    <>
      <div className={styles.back}>
        <AppLink href="/admin/workflows">
          <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Workflows
        </AppLink>
      </div>
      <div className={styles.header}>
        <div className={styles.title}>
          <Title2 as="h1">{rule ? rule.name : "New rule"}</Title2>
          {rule?.archived_at ? (
            <Badge appearance="tint" color="subtle">
              Archived
            </Badge>
          ) : rule?.is_active ? (
            <Badge appearance="filled" color="success">
              Active
            </Badge>
          ) : (
            <Badge appearance="tint" color="informative">
              Off
            </Badge>
          )}
          {rule && <Body1 className={styles.muted}>Version {rule.version}</Body1>}
        </div>
        <div className={styles.actions}>
          {canManage && !rule?.archived_at && (
            <Button
              appearance="primary"
              icon={save.isPending ? <Spinner size="tiny" /> : <Save20Regular />}
              disabled={!dirty || save.isPending || !draft.name.trim() || !draft.trigger}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          )}
          {canManage && (
            <Button icon={<Beaker20Regular />} disabled={!draft.trigger} onClick={() => setTesting(true)}>
              Test run
            </Button>
          )}
          {canManage && rule && !rule.archived_at && (
            rule.is_active ? (
              <Button icon={<Stop20Regular />} disabled={toggle.isPending} onClick={() => toggle.mutate(false)}>
                Deactivate
              </Button>
            ) : (
              <Button icon={<Play20Regular />} disabled={toggle.isPending || dirty} onClick={() => setConfirm("activate")}>
                Activate
              </Button>
            )
          )}
          {canManage && rule && !rule.archived_at && (
            <Button icon={<Archive20Regular />} appearance="subtle" onClick={() => setConfirm("archive")}>
              Archive
            </Button>
          )}
        </div>
      </div>

      {rule && (
        <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as "rule" | "executions")}>
          <Tab value="rule">Rule</Tab>
          <Tab value="executions">Executions{rule.failures_24h > 0 ? ` (${rule.failures_24h} failed today)` : ""}</Tab>
        </TabList>
      )}

      {tab === "executions" && rule ? (
        <ExecutionsTab ruleId={rule.id} registry={registry} />
      ) : (
        <div className={styles.flow}>
          {problem && (
            <MessageBar intent="error" layout="multiline" role="alert" style={{ marginBottom: tokens.spacingVerticalM }}>
              <MessageBarBody>
                <MessageBarTitle>{problem.title}</MessageBarTitle>
                {problem.message}
              </MessageBarBody>
            </MessageBar>
          )}
          {initial.unsupported && (
            <MessageBar intent="warning" style={{ marginBottom: tokens.spacingVerticalM }}>
              <MessageBarBody>
                Some conditions of this rule use a structure the builder cannot show (such as NOT). Saving replaces them with what you see.
              </MessageBarBody>
            </MessageBar>
          )}
          {rule && dirty && !rule.archived_at && (
            <MessageBar intent="info" style={{ marginBottom: tokens.spacingVerticalM }}>
              <MessageBarBody>You have unsaved changes. Test run checks them as they are; save before activating.</MessageBarBody>
            </MessageBar>
          )}

          <Card className={styles.card}>
            <div className={styles.row}>
              <Field label="Rule name" required validationState={errorTarget?.section === "name" ? "error" : "none"}>
                <Input value={draft.name} maxLength={200} disabled={readOnly} onChange={(_, d) => set({ name: d.value })} />
              </Field>
              <Field label="Description">
                <Input value={draft.description} maxLength={2000} disabled={readOnly} onChange={(_, d) => set({ description: d.value })} />
              </Field>
            </div>
          </Card>
          <div className={styles.connector} aria-hidden>
            <ArrowDown20Regular />
          </div>

          {/* 1. When */}
          <Card className={mergeClasses(styles.card, errorTarget?.section === "trigger" ? styles.error : "")}>
            <CardHeader
              image={
                <span className={mergeClasses(styles.cardIcon, styles.when)} aria-hidden>
                  <Flash20Regular />
                </span>
              }
              header={<Subtitle2 as="h2">When</Subtitle2>}
              description={<Body1 className={styles.muted}>The event that starts this rule.</Body1>}
            />
            <Field label="Trigger" required>
              <Dropdown
                placeholder="Choose a trigger"
                disabled={readOnly}
                value={trigger?.label ?? draft.trigger}
                selectedOptions={draft.trigger ? [draft.trigger] : []}
                onOptionSelect={(_, d) => {
                  const next = registry?.triggers.find((t) => t.key === d.optionValue);
                  if (!next) return;
                  const paths = new Set(next.fields.map((f) => f.path));
                  set({
                    trigger: next.key,
                    // Keep only conditions whose fields exist for the new trigger, and allowed actions.
                    conditions: {
                      ...draft.conditions,
                      items: draft.conditions.items
                        .map((i) => (i.kind === "clause" ? i : { ...i, clauses: i.clauses.filter((c) => !c.field || paths.has(c.field)) }))
                        .filter((i) => (i.kind === "clause" ? !i.field || paths.has(i.field) : i.clauses.length > 0)),
                    },
                    actions: draft.actions.filter((a) => !a.type || actionAllowedFor(a.type, next.entity_type)),
                  });
                }}
              >
                {(registry?.triggers ?? []).map((t) => (
                  <Option key={t.key} value={t.key} disabled={!t.available} text={t.label}>
                    {t.available ? t.label : `${t.label} (not available yet)`}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </Card>
          <div className={styles.connector} aria-hidden>
            <ArrowDown20Regular />
          </div>

          {/* 2. If */}
          <Card className={mergeClasses(styles.card, errorTarget?.section === "conditions-root" ? styles.error : "")}>
            <CardHeader
              image={
                <span className={mergeClasses(styles.cardIcon, styles.if)} aria-hidden>
                  <Filter20Regular />
                </span>
              }
              header={<Subtitle2 as="h2">If</Subtitle2>}
              description={<Body1 className={styles.muted}>Optional conditions on the record and the event.</Body1>}
            />
            {draft.trigger ? (
              <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                <ConditionEditor
                  value={draft.conditions}
                  onChange={(conditions) => set({ conditions })}
                  fields={trigger?.fields ?? []}
                  errorRowId={errorRowId}
                  maxClauses={limits.max_clauses ?? 20}
                />
              </fieldset>
            ) : (
              <Body1 className={styles.muted}>Choose a trigger first.</Body1>
            )}
          </Card>
          <div className={styles.connector} aria-hidden>
            <ArrowDown20Regular />
          </div>

          {/* 3. Then */}
          <Card className={mergeClasses(styles.card, errorTarget?.section === "actions-root" ? styles.error : "")}>
            <CardHeader
              image={
                <span className={mergeClasses(styles.cardIcon, styles.then)} aria-hidden>
                  <Play20Regular />
                </span>
              }
              header={<Subtitle2 as="h2">Then</Subtitle2>}
              description={<Body1 className={styles.muted}>Actions run in order. A failed action does not stop the others.</Body1>}
            />
            <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
              <div className={styles.actionsList}>
                {draft.actions.length === 0 && <Body1 className={styles.muted}>No actions yet.</Body1>}
                {draft.actions.map((a, i) => (
                  <ActionCard
                    key={a.id}
                    index={i}
                    count={draft.actions.length}
                    action={a}
                    types={actionsForTrigger(registry?.actions ?? [], trigger)}
                    entityType={trigger?.entity_type}
                    blockedStages={registry?.move_stage_blocked_targets ?? []}
                    error={errorRowId === a.id}
                    errorParam={errorTarget?.section === "actions" && errorTarget.index === i ? errorTarget.param : null}
                    onChange={(next) => setActions(draft.actions.map((x) => (x.id === a.id ? next : x)))}
                    onMove={(delta) => moveAction(i, delta)}
                    onRemove={() => setActions(draft.actions.filter((x) => x.id !== a.id))}
                  />
                ))}
                <div>
                  <Button
                    icon={<Add16Regular />}
                    disabled={draft.actions.length >= maxActions || !draft.trigger}
                    onClick={() => setActions([...draft.actions, { id: newId("a"), type: "", params: {} }])}
                  >
                    Add action
                  </Button>
                </div>
              </div>
            </fieldset>
          </Card>
        </div>
      )}

      {testing && (
        <TestRunDialog
          ruleId={rule && !dirty ? rule.id : null}
          draft={body}
          trigger={draft.trigger}
          registry={registry}
          onClose={() => setTesting(false)}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "archive" ? "Archive this rule?" : "Turn on this rule?"}
        confirmLabel={confirm === "archive" ? "Archive" : "Turn on"}
        onClose={() => setConfirm(null)}
        onConfirm={() => (confirm === "archive" ? archive.mutateAsync() : toggle.mutateAsync(true))}
      >
        {confirm === "archive"
          ? "The rule stops running and is hidden from the list. Its run history is kept."
          : "The rule will run automatically for new events within about a minute. Use Test run first to check what it would do."}
      </ConfirmDialog>
    </>
  );
}
