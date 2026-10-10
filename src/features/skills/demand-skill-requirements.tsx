"use client";

import {
  Button,
  Dropdown,
  makeStyles,
  Option,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { Edit16Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DetailsDrawer, ErrorBar } from "@/features/admin/ui";
import { demandsApi } from "@/features/demands/api";
import { errorMessage } from "@/lib/api/errors";
import type { DemandOut, DemandUpdate } from "@/lib/api/types";
import { PROFICIENCY_LABELS } from "./logic";

/** Epic 37 fields on demand skills (hand-written: `min_proficiency`, `expand`). */
type SkillReq = NonNullable<DemandOut["skills"]>[number] & { min_proficiency?: number | null; expand?: boolean };

const useStyles = makeStyles({
  scroll: { overflowX: "auto" },
  footer: { display: "flex", gap: tokens.spacingHorizontalS },
});

export function skillRequirementSuffix(s: SkillReq): string {
  const parts: string[] = [];
  if (s.min_proficiency) parts.push(`≥ ${s.min_proficiency}`);
  if (s.expand === false) parts.push("exact");
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}

/** "Min proficiency" and "Use related skills" per Demand skill; saves the full skill list with PATCH. */
export function DemandSkillRequirements({ demand, canUpdate }: { demand: DemandOut; canUpdate: boolean }) {
  const [open, setOpen] = useState(false);
  if (!canUpdate || !(demand.skills ?? []).length) return null;
  return (
    <>
      <Button size="small" appearance="subtle" icon={<Edit16Regular />} onClick={() => setOpen(true)}>
        Proficiency and related skills
      </Button>
      {open && <Editor demand={demand} onClose={() => setOpen(false)} />}
    </>
  );
}

function Editor({ demand, onClose }: { demand: DemandOut; onClose: () => void }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const [rows, setRows] = useState<SkillReq[]>(() => (demand.skills ?? []).map((s) => ({ expand: true, ...(s as SkillReq) })));
  const save = useMutation({
    mutationFn: () =>
      demandsApi.update(demand.id, {
        skills: rows.map((r) => ({
          label: r.label,
          skill_id: r.skill_id,
          skill_ref_kind: r.skill_ref_kind,
          kind: r.kind,
          min_years: r.min_years,
          min_proficiency: r.min_proficiency ?? null,
          expand: r.expand !== false,
        })),
      } as DemandUpdate),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["demands"] });
      onClose();
    },
  });
  const patch = (i: number, p: Partial<SkillReq>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <DetailsDrawer
      open
      size="medium"
      title="Skill requirements"
      onClose={onClose}
      footer={
        <div className={styles.footer}>
          <Button appearance="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      }
    >
      <ErrorBar message={save.error ? errorMessage(save.error) : null} />
      <div className={styles.scroll}>
        <Table size="small" aria-label="Skill requirements">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Skill</TableHeaderCell>
              <TableHeaderCell>Min proficiency</TableHeaderCell>
              <TableHeaderCell>Use related skills</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={`${r.kind}:${r.label}`}>
                <TableCell>{r.label}</TableCell>
                <TableCell>
                  <Dropdown
                    aria-label={`Min proficiency for ${r.label}`}
                    value={r.min_proficiency ? `${r.min_proficiency} · ${PROFICIENCY_LABELS[r.min_proficiency]}` : "Any"}
                    selectedOptions={[r.min_proficiency ? String(r.min_proficiency) : ""]}
                    onOptionSelect={(_, d) => patch(i, { min_proficiency: d.optionValue ? Number(d.optionValue) : null })}
                  >
                    <Option value="" text="Any">
                      Any
                    </Option>
                    {[1, 2, 3, 4, 5].map((p) => (
                      <Option key={p} value={String(p)} text={`${p} · ${PROFICIENCY_LABELS[p]}`}>
                        {`${p} · ${PROFICIENCY_LABELS[p]}`}
                      </Option>
                    ))}
                  </Dropdown>
                </TableCell>
                <TableCell>
                  <Switch
                    aria-label={`Use related skills for ${r.label}`}
                    checked={r.expand !== false}
                    onChange={(_, d) => patch(i, { expand: d.checked })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DetailsDrawer>
  );
}
