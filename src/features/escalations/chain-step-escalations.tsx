"use client";

import { Dropdown, Field, makeStyles, Option, Text, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { usePermission } from "@/features/auth/use-permission";
import { escalationKeys, escalationsApi } from "./api";
import { usePolicies } from "./escalation-policies-admin";
import { chainBody, chainSelection } from "./escalation-model";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/**
 * Escalation per approval-chain step (Epic 32 B4). State lives here; the chain drawer calls `save(chainId)`
 * after the chain itself is saved (each step gets an owned copy of the chosen library policy).
 */
export function useChainStepEscalations(chainId: string | null, stepCount: number) {
  const canManage = usePermission("sla:manage");
  const canRead = usePermission("sla:read");
  const current = useQuery({
    queryKey: escalationKeys.chain(chainId ?? ""),
    queryFn: ({ signal }) => escalationsApi.chainSteps(chainId ?? "", signal),
    enabled: !!chainId && canRead,
  });
  const [selection, setSelection] = useState<string[] | null>(null);
  const stored = chainSelection(current.data?.steps ?? [], stepCount);
  const value = selection ? chainSelection(selection.map((id, i) => ({ position: i + 1, policy_id: id || null })), stepCount) : stored;
  return {
    enabled: canRead,
    canManage,
    value,
    set: (position: number, policyId: string) => {
      const next = [...value];
      next[position - 1] = policyId;
      setSelection(next);
    },
    /** Persist after the chain was saved; no-op when nothing changed or the user cannot manage SLAs. */
    save: async (savedChainId: string) => {
      if (!canManage || selection === null) return;
      await escalationsApi.setChainSteps(savedChainId, chainBody(value));
    },
  };
}

export function ChainStepEscalationPicker({
  steps,
  state,
}: {
  steps: readonly { name: string }[];
  state: ReturnType<typeof useChainStepEscalations>;
}) {
  const styles = useStyles();
  const policies = usePolicies(false);
  if (!state.enabled) return null;
  const options = policies.data ?? [];
  return (
    <div className={styles.root}>
      <Text weight="semibold">Escalation</Text>
      <Text size={200} className={styles.muted}>
        Notify or reassign when a step waits too long. Escalations never approve or reject.
      </Text>
      {steps.map((s, i) => {
        const selected = state.value[i] ?? "";
        const policy = options.find((p) => p.id === selected);
        return (
          <Field key={i} label={`${i + 1}. ${s.name || "Step"}`} hint={policy?.summary}>
            <Dropdown
              disabled={!state.canManage}
              value={policy?.name ?? "No escalation"}
              selectedOptions={[selected]}
              onOptionSelect={(_, d) => state.set(i + 1, d.optionValue ?? "")}
            >
              <Option value="" text="No escalation">
                No escalation
              </Option>
              {options.map((p) => (
                <Option key={p.id} value={p.id} text={p.name ?? p.summary}>
                  {p.name}
                </Option>
              ))}
            </Dropdown>
          </Field>
        );
      })}
    </div>
  );
}
