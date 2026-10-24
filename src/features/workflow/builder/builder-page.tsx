"use client";

import {
  Badge,
  Body1,
  Card,
  Combobox,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  OptionGroup,
  Spinner,
  Switch,
  Tab,
  TabList,
  Title2,
  tokens,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  Tooltip,
} from "@fluentui/react-components";
import {
  ArrowLeft20Regular,
  ArrowRedo20Regular,
  ArrowUndo20Regular,
  Beaker20Regular,
  FullScreenMaximize20Regular,
  Save20Regular,
  TextBulletListLtr20Regular,
} from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { workflowKeys } from "../api";
import { activationError } from "../rules-list";
import { graphApi } from "./api";
import { DryRunDrawer } from "./dry-run-drawer";
import { GraphExecutions } from "./graph-executions";
import {
  addNode,
  emptyGraph,
  type History,
  historyOf,
  MAX_STEPS,
  nodeById,
  nodeIdFromPath,
  outline,
  pathHighlight,
  push,
  redo,
  removeNode,
  stepCount,
  undo,
  updateNode,
  validateGraph,
} from "./graph-model";
import { NodeProperties } from "./node-properties";
import { OutlinePanel } from "./outline-panel";
import type { Graph, GraphRegistryOut, GraphRuleBody, GraphRuleOut, NodeType, PathStep } from "./types";
import { useWorkflowRegistry } from "./use-workflow-registry";
import { useWorkflowRule } from "./use-workflow-rule";
import { type CanvasHandle, WorkflowCanvas } from "./workflow-canvas";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalS },
  meta: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap", padding: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM, "& > *": { flex: "1 1 240px" } },
  toolbar: { flexWrap: "wrap", marginBottom: tokens.spacingVerticalS },
  split: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "stretch" },
  canvas: { flex: 1, minWidth: 0 },
  tabs: { marginBottom: tokens.spacingVerticalM, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  muted: { color: tokens.colorNeutralForeground3 },
});

type Problem = { title: string; message: string; path: string | null };

function problemFrom(e: unknown): Problem {
  if (isApiError(e) && ["invalid_graph", "invalid_condition", "invalid_action", "invalid_trigger", "graph_and_form"].includes(e.code)) {
    const path = typeof e.details.path === "string" ? e.details.path : null;
    const reason = typeof e.details.reason === "string" ? e.details.reason.replace(/_/g, " ") : e.message;
    return { title: "Check the workflow", message: `${e.message} (${reason})`, path };
  }
  if (isApiError(e) && e.code === "rule_limit") return { title: "Too many active rules", message: activationError(e), path: null };
  return { title: "Could not save the workflow.", message: errorMessage(e), path: null };
}

/** `/admin/workflows/[id]` (or `new`): the visual workflow builder (Epic 32 B1). */
export function WorkflowBuilderPage({ id }: { id: string }) {
  const canRead = usePermission("workflow:read");
  const isNew = id === "new";
  const rule = useWorkflowRule(isNew ? null : id);
  const registry = useWorkflowRegistry();
  if (!canRead) return <NoAccess what="workflow rules" />;
  if ((!isNew && rule.isPending) || registry.isPending) return <GridSkeleton rows={8} />;
  if (!isNew && rule.isError) {
    return (
      <>
        <ErrorBar title="Could not load the workflow." message={isApiError(rule.error) && rule.error.status === 404 ? "This workflow does not exist." : errorMessage(rule.error)} />
        <AppLink href="/admin/workflows">Back to workflows</AppLink>
      </>
    );
  }
  if (registry.isError) return <ErrorBar title="Could not load the builder." message={errorMessage(registry.error)} />;
  return <Builder key={rule.data?.id ?? "new"} rule={isNew ? undefined : rule.data} registry={registry.data} />;
}

function Builder({ rule, registry }: { rule: GraphRuleOut | undefined; registry: GraphRegistryOut }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canManage = usePermission("workflow:manage");
  const canvas = useRef<CanvasHandle>(null);
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [trigger, setTrigger] = useState(rule?.trigger ?? registry.triggers.find((t) => t.available)?.key ?? "");
  const [history, setHistory] = useState<History<Graph>>(() => historyOf(rule?.graph ?? emptyGraph()));
  const graph = history.present;
  const [savedBody, setSavedBody] = useState(() => (rule ? JSON.stringify(bodyOf(rule.name, rule.description ?? "", rule.trigger, rule.graph)) : ""));
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"canvas" | "outline" | "executions">("canvas");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [dryOpen, setDryOpen] = useState(false);
  const [walked, setWalked] = useState<PathStep[] | null>(null);
  const readOnly = !canManage || !!rule?.archived_at;
  const maxSteps = registry.max_steps ?? MAX_STEPS;

  const body = bodyOf(name, description, trigger, graph);
  const dirty = !rule || JSON.stringify(body) !== savedBody;
  const triggerDef = registry.triggers.find((t) => t.key === trigger);
  const labels = useMemo(
    () => ({
      fields: Object.fromEntries((triggerDef?.fields ?? []).map((f) => [f.path, f.label])),
      actions: Object.fromEntries(registry.actions.map((a) => [a.type, a.label])),
    }),
    [triggerDef, registry.actions],
  );
  const issues = validateGraph(graph, { maxSteps, maxActions: registry.limits?.max_actions, maxDelayDays: registry.limits?.max_delay_days });
  const serverErrorNode = nodeIdFromPath(graph, problem?.path);
  const errorIds = new Set<string>([...issues.flatMap((i) => (i.nodeId ? [i.nodeId] : [])), ...(serverErrorNode ? [serverErrorNode] : [])]);
  const rows = !dirty && rule ? rule.outline : outline(graph, labels);
  const steps = stepCount(graph);
  const walkedSet = walked ? pathHighlight(graph, walked) : null;
  const triggers = registry.triggers;
  const groups = useMemo(() => {
    const out = new Map<string, typeof triggers>();
    for (const t of triggers) out.set(t.group ?? "Phase 1", [...(out.get(t.group ?? "Phase 1") ?? []), t]);
    return [...out.entries()];
  }, [triggers]);

  const change = (next: Graph) => {
    setHistory((h) => push(h, next));
    setWalked(null);
  };

  const save = useMutation({
    mutationFn: () => (rule ? graphApi.update(rule.id, body) : graphApi.create(body)),
    onSuccess: (out) => {
      setProblem(null);
      queryClient.setQueryData([...workflowKeys.rule(out.id), "graph"], out);
      void queryClient.invalidateQueries({ queryKey: workflowKeys.rules });
      setHistory(historyOf(out.graph));
      setSavedBody(JSON.stringify(bodyOf(out.name, out.description ?? "", out.trigger, out.graph)));
      toast.success(rule ? `Saved ${out.name}` : `Created ${out.name}. It is off until you turn it on.`);
      if (!rule) router.replace(`/admin/workflows/${out.id}`);
    },
    onError: (e) => {
      const p = problemFrom(e);
      setProblem(p);
      const nodeId = nodeIdFromPath(graph, p.path);
      if (nodeId) {
        setSelected(nodeId);
        canvas.current?.focusNode(nodeId);
      }
    },
  });

  const toggle = useMutation({
    mutationFn: (on: boolean) => (on ? graphApi.activate(rule?.id ?? "") : graphApi.deactivate(rule?.id ?? "")),
    onSuccess: (out) => {
      queryClient.setQueryData([...workflowKeys.rule(out.id), "graph"], out);
      void queryClient.invalidateQueries({ queryKey: workflowKeys.rules });
      toast.success(out.is_active ? `${out.name} is on` : `${out.name} is off`);
    },
    onError: (e) => toast.error(activationError(e)),
  });

  const onAdd = (fromId: string | null, field: string | null, type: NodeType) => {
    if (steps >= maxSteps && type !== "end") {
      toast.error(`A workflow has at most ${maxSteps} steps.`);
      return;
    }
    const { graph: next, id } = addNode(graph, fromId, field, type);
    change(next);
    setSelected(id);
  };
  const selectedNode = selected ? nodeById(graph, selected) : undefined;
  const selectedIssue = issues.find((i) => i.nodeId === selected)?.message ?? (serverErrorNode === selected ? problem?.message ?? null : null);
  const isActive = !!rule?.is_active;

  return (
    <>
      <div className={styles.back}>
        <AppLink href="/admin/workflows">
          <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Workflows
        </AppLink>
      </div>
      <div className={styles.header}>
        <Title2 as="h1">{rule ? rule.name : "New workflow"}</Title2>
        {rule?.archived_at && <Badge color="subtle">Archived</Badge>}
        <Tooltip content={`At most ${maxSteps} steps, end steps excluded`} relationship="description">
          <Badge appearance="tint" color={steps > maxSteps ? "danger" : "informative"}>{`${steps} / ${maxSteps} steps`}</Badge>
        </Tooltip>
        {rule && <Body1 className={styles.muted}>Version {rule.version}</Body1>}
        {rule && rule.waiting_runs > 0 && <Badge color="informative">{rule.waiting_runs} waiting</Badge>}
        {rule?.is_p1_form && (
          <AppLink href={`/admin/workflows/${rule.id}/simple`}>
            <TextBulletListLtr20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Simple editor
          </AppLink>
        )}
      </div>

      <Toolbar aria-label="Workflow" className={styles.toolbar}>
        {canManage && !rule?.archived_at && (
          <ToolbarButton
            appearance="primary"
            icon={save.isPending ? <Spinner size="tiny" /> : <Save20Regular />}
            disabled={!dirty || save.isPending || !name.trim() || !trigger}
            onClick={() => save.mutate()}
          >
            Save
          </ToolbarButton>
        )}
        {canManage && rule && !rule.archived_at && (
          <Tooltip content={dirty ? "Save before turning it on" : "Runs for new events within about a minute"} relationship="description">
            <Switch label={isActive ? "On" : "Off"} checked={isActive} disabled={toggle.isPending || (dirty && !isActive)} onChange={(_, d) => toggle.mutate(d.checked)} />
          </Tooltip>
        )}
        <ToolbarDivider />
        {canManage && (
          <ToolbarButton icon={<Beaker20Regular />} disabled={!trigger} onClick={() => setDryOpen(true)}>
            Dry run
          </ToolbarButton>
        )}
        <ToolbarButton aria-label="Undo" icon={<ArrowUndo20Regular />} disabled={readOnly || history.past.length === 0} onClick={() => setHistory(undo)} />
        <ToolbarButton aria-label="Redo" icon={<ArrowRedo20Regular />} disabled={readOnly || history.future.length === 0} onClick={() => setHistory(redo)} />
        <ToolbarButton icon={<FullScreenMaximize20Regular />} onClick={() => canvas.current?.fit()} disabled={tab !== "canvas"}>
          Zoom to fit
        </ToolbarButton>
      </Toolbar>

      {problem && (
        <MessageBar intent="error" layout="multiline" role="alert" style={{ marginBottom: tokens.spacingVerticalS }}>
          <MessageBarBody>
            <MessageBarTitle>{problem.title}</MessageBarTitle>
            {problem.message}
          </MessageBarBody>
        </MessageBar>
      )}
      {issues.length > 0 && !readOnly && (
        <MessageBar intent="warning" layout="multiline" style={{ marginBottom: tokens.spacingVerticalS }}>
          <MessageBarBody>{issues.slice(0, 3).map((i) => i.message).join(" ")}</MessageBarBody>
        </MessageBar>
      )}

      <Card className={styles.meta}>
        <Field label="Name" required>
          <Input value={name} maxLength={200} disabled={readOnly} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Trigger" required hint={triggerDef?.owner_epic && !triggerDef.available ? `Available once Epic ${triggerDef.owner_epic} ships` : undefined}>
          <Combobox
            disabled={readOnly}
            value={triggerDef?.label ?? trigger}
            selectedOptions={trigger ? [trigger] : []}
            onOptionSelect={(_, d) => d.optionValue && setTrigger(d.optionValue)}
          >
            {groups.map(([group, items]) => (
              <OptionGroup key={group} label={group}>
                {items.map((t) => (
                  <Option key={t.key} value={t.key} text={t.label} disabled={!t.available} title={!t.available && t.owner_epic ? `Available once Epic ${t.owner_epic} ships` : undefined}>
                    {t.available ? t.label : `${t.label} (Epic ${t.owner_epic ?? "?"})`}
                  </Option>
                ))}
              </OptionGroup>
            ))}
          </Combobox>
        </Field>
        <Field label="Description">
          <Input value={description} maxLength={2000} disabled={readOnly} onChange={(_, d) => setDescription(d.value)} />
        </Field>
      </Card>

      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as typeof tab)}>
        <Tab value="canvas">Canvas</Tab>
        <Tab value="outline">Outline</Tab>
        {rule && <Tab value="executions">Executions</Tab>}
      </TabList>

      {tab === "executions" && rule ? (
        <GraphExecutions ruleId={rule.id} />
      ) : (
        <div className={styles.split}>
          <div className={styles.canvas}>
            {tab === "canvas" ? (
              <WorkflowCanvas
                ref={canvas}
                graph={graph}
                labels={labels}
                selectedId={selected}
                errorIds={errorIds}
                walked={walkedSet}
                readOnly={readOnly}
                onSelect={setSelected}
                onAdd={onAdd}
                onMove={(id, x, y) => setHistory((h) => ({ ...h, present: { ...h.present, layout: { ...(h.present.layout ?? {}), [id]: { x, y } } } }))}
              />
            ) : (
              <OutlinePanel graph={graph} rows={rows} selectedId={selected} errorIds={errorIds} readOnly={readOnly} onSelect={setSelected} onAdd={onAdd} />
            )}
          </div>
          {selectedNode && (
            <NodeProperties
              key={selectedNode.id}
              node={selectedNode}
              registry={registry}
              trigger={triggerDef}
              readOnly={readOnly}
              errorMessage={selectedIssue}
              onChange={(n) => change(updateNode(graph, n))}
              onRemove={() => {
                change(removeNode(graph, selectedNode.id));
                setSelected(null);
              }}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      )}

      {dryOpen && (
        <DryRunDrawer
          open
          ruleId={rule && !dirty ? rule.id : null}
          body={body}
          graph={graph}
          entityLabel={triggerDef?.entity_type?.replace(/_/g, " ") ?? "Record"}
          onClose={() => setDryOpen(false)}
          onPath={setWalked}
        />
      )}
    </>
  );
}

function bodyOf(name: string, description: string, trigger: string, graph: Graph): GraphRuleBody {
  return { name: name.trim(), description: description.trim() || null, trigger, graph };
}
