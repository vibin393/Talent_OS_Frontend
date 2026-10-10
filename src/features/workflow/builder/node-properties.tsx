"use client";

import {
  Button,
  Checkbox,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  SpinButton,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Delete20Regular, Dismiss24Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useRoles } from "@/features/admin/use-admin-data";
import { UserPicker } from "@/features/admin/user-picker";
import { ActionCard } from "../action-editor";
import { actionsForTrigger } from "../allowed-actions";
import { ConditionEditor } from "../condition-editor";
import { buildConditions, type ConditionsDraft, parseConditions } from "../rule-model";
import { NODE_LABELS, UNIT_LABELS } from "./graph-model";
import type { ApprovalNode, ApproverKind, Duration, DurationUnit, GraphNode, GraphRegistryOut, GraphTriggerOut } from "./types";

const useStyles = makeStyles({
  drawer: { width: "420px", maxWidth: "100%" },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, paddingBottom: tokens.spacingVerticalXL },
  row: { display: "flex", gap: tokens.spacingHorizontalS, "& > *": { flex: "1 1 120px" } },
  muted: { color: tokens.colorNeutralForeground3 },
});

const DELAY_UNITS: DurationUnit[] = ["minutes", "hours", "days", "business_hours", "business_days"];

const APPROVER_LABELS: Record<ApproverKind, string> = {
  entity_owner: "Record owner",
  primary_recruiter: "Primary recruiter",
  user: "A named user",
  role: "A role",
};

function DurationFields({ value, onChange, label }: { value: Duration; onChange: (d: Duration) => void; label: string }) {
  const styles = useStyles();
  return (
    <div className={styles.row}>
      <Field label={label}>
        <SpinButton min={1} value={value.value} onChange={(_, d) => onChange({ ...value, value: Math.max(1, Math.round(Number(d.value ?? d.displayValue ?? 1)) || 1) })} />
      </Field>
      <Field label="Unit">
        <Dropdown value={UNIT_LABELS[value.unit]} selectedOptions={[value.unit]} onOptionSelect={(_, d) => onChange({ ...value, unit: d.optionValue as DurationUnit })}>
          {DELAY_UNITS.map((u) => (
            <Option key={u} value={u}>
              {UNIT_LABELS[u]}
            </Option>
          ))}
        </Dropdown>
      </Field>
    </div>
  );
}

function ConditionPanel({ node, trigger, onChange, maxClauses }: { node: Extract<GraphNode, { type: "condition" }>; trigger: GraphTriggerOut | undefined; onChange: (n: GraphNode) => void; maxClauses: number }) {
  const [draft, setDraft] = useState<ConditionsDraft>(() => parseConditions(node.when).draft);
  return (
    <ConditionEditor
      value={draft}
      onChange={(d) => {
        setDraft(d);
        onChange({ ...node, when: buildConditions(d) as Record<string, unknown> });
      }}
      fields={trigger?.fields ?? []}
      errorRowId={null}
      maxClauses={maxClauses}
    />
  );
}

function ApprovalPanel({ node, onChange, policies }: { node: ApprovalNode; onChange: (n: GraphNode) => void; policies: { id: string; name: string }[] }) {
  const roles = useRoles();
  const set = (patch: Partial<ApprovalNode>) => onChange({ ...node, ...patch });
  return (
    <>
      <Field label="Title" required>
        <Input value={node.title} maxLength={200} onChange={(_, d) => set({ title: d.value })} />
      </Field>
      <Field label="Approver">
        <Dropdown
          value={APPROVER_LABELS[node.approver.kind]}
          selectedOptions={[node.approver.kind]}
          onOptionSelect={(_, d) => set({ approver: { kind: d.optionValue as ApproverKind, ref: null } })}
        >
          {(Object.keys(APPROVER_LABELS) as ApproverKind[]).map((k) => (
            <Option key={k} value={k}>
              {APPROVER_LABELS[k]}
            </Option>
          ))}
        </Dropdown>
      </Field>
      {node.approver.kind === "user" && (
        <UserPicker label="User" value={node.approver.ref ?? null} onChange={(id) => set({ approver: { kind: "user", ref: id } })} />
      )}
      {node.approver.kind === "role" && (
        <Field label="Role">
          <Dropdown
            placeholder="Choose a role"
            value={roles.data?.find((r) => r.id === node.approver.ref)?.name ?? ""}
            selectedOptions={node.approver.ref ? [node.approver.ref] : []}
            onOptionSelect={(_, d) => set({ approver: { kind: "role", ref: d.optionValue ?? null } })}
          >
            {(roles.data ?? []).map((r) => (
              <Option key={r.id} value={r.id}>
                {r.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
      )}
      <Checkbox
        checked={!!node.timeout}
        label="Time out if nobody decides"
        onChange={(_, d) => set(d.checked ? { timeout: { value: 5, unit: "business_days" } } : { timeout: null, on_timeout: null })}
      />
      {node.timeout && <DurationFields label="Time out after" value={node.timeout} onChange={(timeout) => set({ timeout })} />}
      <Field label="Escalation policy" hint="Notify or reassign when the approval waits too long. It never decides.">
        <Dropdown
          value={policies.find((p) => p.id === node.escalation_policy_id)?.name ?? "No escalation"}
          selectedOptions={[node.escalation_policy_id ?? ""]}
          onOptionSelect={(_, d) => set({ escalation_policy_id: d.optionValue || null })}
        >
          <Option value="" text="No escalation">
            No escalation
          </Option>
          {policies.map((p) => (
            <Option key={p.id} value={p.id}>
              {p.name}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Text size={200}>The approval only chooses the branch; it never changes the record&apos;s status.</Text>
    </>
  );
}

/** Inline properties `Drawer` of the selected node (Epic 32 B1). */
export function NodeProperties({
  node,
  registry,
  trigger,
  readOnly,
  errorMessage,
  onChange,
  onRemove,
  onClose,
}: {
  node: GraphNode;
  registry: GraphRegistryOut;
  trigger: GraphTriggerOut | undefined;
  readOnly: boolean;
  errorMessage: string | null;
  onChange: (n: GraphNode) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  return (
    <Drawer type="inline" separator position="end" open className={styles.drawer}>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>
          {NODE_LABELS[node.type]} <Text className={styles.muted}>({node.id})</Text>
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <div className={styles.body}>
            {errorMessage && <Text style={{ color: tokens.colorPaletteRedForeground1 }}>{errorMessage}</Text>}
            {node.type === "condition" && (
              <ConditionPanel key={node.id} node={node} trigger={trigger} onChange={onChange} maxClauses={registry.limits?.max_clauses ?? 20} />
            )}
            {node.type === "delay" && <DurationFields label="Wait" value={node.duration} onChange={(duration) => onChange({ ...node, duration })} />}
            {node.type === "approval" && <ApprovalPanel node={node} onChange={onChange} policies={registry.escalation_policies ?? []} />}
            {node.type === "action" && (
              <ActionCard
                index={0}
                count={1}
                action={{ id: node.id, type: node.action.type, params: node.action.params }}
                types={actionsForTrigger(registry.actions, trigger)}
                entityType={trigger?.entity_type}
                blockedStages={registry.move_stage_blocked_targets}
                error={false}
                errorParam={null}
                onChange={(a) => onChange({ ...node, action: { type: a.type, params: a.params } })}
                onMove={() => undefined}
                onRemove={onRemove}
              />
            )}
            {node.type === "end" && <Text>The run ends here.</Text>}
            {!readOnly && node.type !== "action" && (
              <div>
                <Button icon={<Delete20Regular />} appearance="subtle" onClick={onRemove}>
                  Remove step
                </Button>
              </div>
            )}
          </div>
        </fieldset>
      </DrawerBody>
    </Drawer>
  );
}
