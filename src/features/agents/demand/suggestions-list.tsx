"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Dropdown,
  makeStyles,
  Option,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { demandAgentApi, demandAgentKeys } from "./api";
import { isNewSkill, skillKindLabel } from "./logic";
import type { DemandInsights, Suggestion } from "./types";

const useStyles = makeStyles({
  row: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    paddingBlock: tokens.spacingVerticalXS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  grow: { flexGrow: 1, minWidth: "180px", display: "flex", flexDirection: "column" },
  muted: { color: tokens.colorNeutralForeground3 },
});

const LEVELS = ["1", "2", "3", "4", "5"];

function useDecide(demandId: string) {
  const qc = useQueryClient();
  const toast = useAppToast();
  const onSuccess = (out: DemandInsights) => qc.setQueryData(demandAgentKeys.insights(demandId), out);
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const accept = useMutation({
    mutationFn: (args: { id: string; minProficiency: number | null }) =>
      demandAgentApi.acceptSuggestion(demandId, args.id, { min_proficiency: args.minProficiency }),
    onSuccess,
    onError,
  });
  const dismiss = useMutation({ mutationFn: (id: string) => demandAgentApi.dismissSuggestion(demandId, id), onSuccess, onError });
  return { accept, dismiss };
}

/** "Suggested skills": skill, kind, proposed minimum proficiency, evidence, Add / Dismiss. */
export function SkillSuggestions({ demandId, items, canUpdate }: { demandId: string; items: Suggestion[]; canUpdate: boolean }) {
  const styles = useStyles();
  const { accept, dismiss } = useDecide(demandId);
  const [levels, setLevels] = useState<Record<string, string>>({});
  if (items.length === 0) return <Caption1 className={styles.muted}>No skill suggestions.</Caption1>;
  return (
    <div>
      {items.map((s) => {
        const level = levels[s.id] ?? (s.payload.min_proficiency ? String(s.payload.min_proficiency) : "");
        return (
          <div key={s.id} className={styles.row}>
            <div className={styles.grow}>
              <Body1>{s.payload.label}</Body1>
              {s.payload.evidence && <Caption1 className={styles.muted}>“{s.payload.evidence}”</Caption1>}
            </div>
            <Badge appearance="outline">{skillKindLabel(s.payload.skill_kind)}</Badge>
            {isNewSkill(s) && (
              <Tooltip content="Adding it creates a pending skill for your skills admin to approve." relationship="description">
                <Badge appearance="tint" color="warning">
                  New skill — needs approval
                </Badge>
              </Tooltip>
            )}
            <Dropdown
              aria-label="Minimum proficiency"
              placeholder="Proficiency"
              value={level}
              selectedOptions={level ? [level] : []}
              disabled={!canUpdate}
              onOptionSelect={(_, d) => d.optionValue && setLevels((prev) => ({ ...prev, [s.id]: d.optionValue! }))}
              style={{ minWidth: "110px" }}
            >
              {LEVELS.map((l) => (
                <Option key={l} value={l}>
                  {l}
                </Option>
              ))}
            </Dropdown>
            {canUpdate && (
              <>
                <Button
                  appearance="primary"
                  size="small"
                  disabled={accept.isPending}
                  onClick={() => accept.mutate({ id: s.id, minProficiency: level ? Number(level) : null })}
                >
                  Add
                </Button>
                <Button size="small" disabled={dismiss.isPending} onClick={() => dismiss.mutate(s.id)}>
                  Dismiss
                </Button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** "Suggested contract and rate card": Link / Dismiss. */
export function LinkSuggestions({ demandId, items, canUpdate }: { demandId: string; items: Suggestion[]; canUpdate: boolean }) {
  const styles = useStyles();
  const { accept, dismiss } = useDecide(demandId);
  if (items.length === 0) return <Caption1 className={styles.muted}>No contract or rate card suggestions.</Caption1>;
  return (
    <div>
      {items.map((s) => (
        <div key={s.id} className={styles.row}>
          <div className={styles.grow}>
            <Body1>{s.payload.label}</Body1>
            <Caption1 className={styles.muted}>{s.kind === "contract" ? "Contract" : "Rate card"}</Caption1>
          </div>
          {canUpdate && (
            <>
              <Button size="small" appearance="primary" disabled={accept.isPending} onClick={() => accept.mutate({ id: s.id, minProficiency: null })}>
                Link
              </Button>
              <Button size="small" disabled={dismiss.isPending} onClick={() => dismiss.mutate(s.id)}>
                Dismiss
              </Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
