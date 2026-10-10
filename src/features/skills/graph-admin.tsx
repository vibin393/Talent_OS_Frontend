"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Combobox,
  Field,
  Input,
  makeStyles,
  Option,
  Radio,
  RadioGroup,
  Slider,
  SpinButton,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete16Regular, Save20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { DetailsDrawer, ErrorBar, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { SkillPicker } from "@/features/candidates/skill-picker";
import { errorMessage } from "@/lib/api/errors";
import type { SkillOut } from "@/lib/api/types";
import { skillGraphApi, skillGraphKeys } from "./graph-api";
import { clampWeight, EDGE_KIND_LABELS, formatWeight, weightError } from "./logic";
import type { EdgeKind, SkillEdge, SkillGraphSettings, SkillNode } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1100px" },
  grid: { display: "grid", gap: tokens.spacingHorizontalL, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" },
  card: { minWidth: 0 },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end", flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
  scroll: { overflowX: "auto" },
  weight: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "center" },
  footer: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

const keyOf = (s: SkillOut) => `${s.kind}:${s.id}`;

/** `/settings/skills-graph`: skill node view, tenant relationships, expansion settings and preview (Epic 37). */
export function SkillGraphAdmin() {
  const styles = useStyles();
  const canManage = usePermission("skill_graph:manage");
  const canRead = usePermission("candidate:read");
  const [selected, setSelected] = useState<{ key: string; name: string } | null>(null);
  if (!canRead && !canManage) return <NoAccess what="the skills graph" />;
  return (
    <div className={styles.root}>
      <PageHeader title="Skills graph" subtitle="Relationships between skills used by matching, search and talent pools." />
      <SkillSearch onPick={setSelected} />
      <div className={styles.grid}>
        {selected ? (
          <NodeCard skillKey={selected.key} canManage={canManage} />
        ) : (
          <Card className={styles.card}>
            <Body1 className={styles.muted}>Search for a skill to see its relationships.</Body1>
          </Card>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL }}>
          <SettingsCard canManage={canManage} />
          <PreviewCard initial={selected} />
        </div>
      </div>
      <Text className={styles.footer}>Skill relationships include data from ESCO, © European Union (CC BY 4.0).</Text>
    </div>
  );
}

function SkillSearch({ onPick }: { onPick: (s: { key: string; name: string }) => void }) {
  return (
    <SkillPicker
      label="Find a skill"
      allowNew={false}
      onPick={(skill) => {
        if (skill) onPick({ key: keyOf(skill), name: skill.name });
      }}
    />
  );
}

function EdgeTable({ edges, side, canManage, onDelete }: { edges: SkillEdge[]; side: "out" | "in"; canManage: boolean; onDelete: (e: SkillEdge) => void }) {
  const styles = useStyles();
  if (!edges.length) return <Caption1 className={styles.muted}>None</Caption1>;
  return (
    <div className={styles.scroll}>
      <Table size="small" aria-label={side === "out" ? "Outgoing relationships" : "Incoming relationships"}>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Relationship</TableHeaderCell>
            <TableHeaderCell>Weight</TableHeaderCell>
            <TableHeaderCell>Origin</TableHeaderCell>
            <TableHeaderCell aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {edges.map((e) => (
            <TableRow key={`${e.origin}:${e.id ?? e.from_skill.key + e.to_skill.key}:${e.kind}`}>
              <TableCell>
                {e.from_skill.name} <Text className={styles.muted}>{EDGE_KIND_LABELS[e.kind].toLowerCase()}</Text> {e.to_skill.name}
              </TableCell>
              <TableCell>{e.weight}</TableCell>
              <TableCell>
                <Badge appearance={e.origin === "tenant" ? "filled" : "outline"} color={e.origin === "tenant" ? "brand" : "informative"}>
                  {e.origin === "platform" ? "Platform" : e.origin === "legacy" ? "Parent" : "Tenant"}
                </Badge>
              </TableCell>
              <TableCell>
                {canManage && e.origin === "tenant" && e.id && (
                  <Button size="small" appearance="subtle" aria-label="Delete relationship" icon={<Delete16Regular />} onClick={() => onDelete(e)} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function NodeCard({ skillKey, canManage }: { skillKey: string; canManage: boolean }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const node = useQuery({ queryKey: skillGraphKeys.node(skillKey), queryFn: ({ signal }) => skillGraphApi.node(skillKey, signal) });
  const del = useMutation({
    mutationFn: (e: SkillEdge) => skillGraphApi.deleteEdge(e.id as string),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skill-graph"] }),
  });
  const n = node.data;
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">{n?.skill.name ?? "Skill"}</Subtitle2>}
        description={n ? <Caption1>{[n.skill.category, n.parent ? `Parent: ${n.parent.name}` : null].filter(Boolean).join(" · ")}</Caption1> : undefined}
        action={
          canManage ? (
            <Button icon={<Add20Regular />} onClick={() => setAdding(true)} disabled={!n}>
              Add relationship
            </Button>
          ) : undefined
        }
      />
      <ErrorBar message={node.error ? errorMessage(node.error) : del.error ? errorMessage(del.error) : null} />
      {n && (
        <>
          {n.aliases.length > 0 && <Caption1 className={styles.muted}>Also known as: {n.aliases.join(", ")}</Caption1>}
          <Text weight="semibold">Outgoing</Text>
          <EdgeTable edges={n.outgoing} side="out" canManage={canManage} onDelete={(e) => del.mutate(e)} />
          <Text weight="semibold">Incoming</Text>
          <EdgeTable edges={n.incoming} side="in" canManage={canManage} onDelete={(e) => del.mutate(e)} />
        </>
      )}
      {adding && n && <AddEdgeDrawer node={n} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function AddEdgeDrawer({ node, onClose }: { node: SkillNode; onClose: () => void }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const [kind, setKind] = useState<EdgeKind>("implies");
  const [target, setTarget] = useState<SkillOut | null>(null);
  const [weight, setWeight] = useState("0.80");
  const [note, setNote] = useState("");
  const wErr = weightError(weight);
  const create = useMutation({
    mutationFn: () =>
      skillGraphApi.createEdge({ from_key: node.skill.key, to_key: keyOf(target as SkillOut), kind, weight, note: note.trim() || null }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["skill-graph"] });
      onClose();
    },
  });
  return (
    <DetailsDrawer
      open
      title="Add relationship"
      onClose={onClose}
      footer={
        <div className={styles.row}>
          <Button appearance="primary" disabled={!target || !!wErr || create.isPending} onClick={() => create.mutate()}>
            Add
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
        <ErrorBar message={create.error ? errorMessage(create.error) : null} />
        <Field label={`${node.skill.name} …`}>
          <RadioGroup value={kind} onChange={(_, d) => setKind(d.value as EdgeKind)}>
            {(Object.keys(EDGE_KIND_LABELS) as EdgeKind[]).map((k) => (
              <Radio key={k} value={k} label={EDGE_KIND_LABELS[k]} />
            ))}
          </RadioGroup>
        </Field>
        <SkillPicker
          label="Target skill"
          allowNew={false}
          excludeKeys={[node.skill.key]}
          onPick={(skill) => setTarget(skill)}
        />
        {target && <Body1>Target: {target.name}</Body1>}
        <Field label="Weight" validationMessage={wErr ?? undefined} validationState={wErr ? "error" : "none"}>
          <div className={styles.weight}>
            <Slider
              min={0.05}
              max={1}
              step={0.05}
              value={clampWeight(Number(weight))}
              onChange={(_, d) => setWeight(formatWeight(d.value))}
              aria-label="Weight slider"
            />
            <Input value={weight} onChange={(_, d) => setWeight(d.value)} aria-label="Weight" style={{ width: 80 }} />
          </div>
        </Field>
        <Field label="Note">
          <Textarea value={note} onChange={(_, d) => setNote(d.value)} maxLength={2000} />
        </Field>
      </div>
    </DetailsDrawer>
  );
}

function SettingsCard({ canManage }: { canManage: boolean }) {
  const settings = useQuery({ queryKey: skillGraphKeys.settings, queryFn: ({ signal }) => skillGraphApi.settings(signal) });
  if (settings.error) return <ErrorBar message={errorMessage(settings.error)} />;
  if (!settings.data) return null;
  return <SettingsForm key={settings.data.graph_version} initial={settings.data} canManage={canManage} />;
}

function SettingsForm({ initial, canManage }: { initial: SkillGraphSettings; canManage: boolean }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const [form, setForm] = useState(() => ({
    expansion_default: initial.expansion_default,
    match_depth: initial.match_depth,
    min_weight: initial.min_weight,
    inference_auto_suggest: initial.inference_auto_suggest,
  }));
  const wErr = weightError(form.min_weight);
  const save = useMutation({
    mutationFn: () => skillGraphApi.saveSettings(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skill-graph"] }),
  });
  return (
    <Card>
      <CardHeader header={<Subtitle2 as="h2">Expansion settings</Subtitle2>} />
      <ErrorBar message={save.error ? errorMessage(save.error) : null} />
      <Switch
        label="Use related skills by default on new Demand skills"
        checked={form.expansion_default}
        disabled={!canManage}
        onChange={(_, d) => setForm({ ...form, expansion_default: d.checked })}
      />
      <Field label="Matching depth (hops)">
        <SpinButton
          min={1}
          max={2}
          value={form.match_depth}
          disabled={!canManage}
          onChange={(_, d) => setForm({ ...form, match_depth: Math.min(2, Math.max(1, Number(d.value ?? d.displayValue) || 1)) })}
        />
      </Field>
      <Field label="Minimum weight" validationMessage={wErr ?? undefined} validationState={wErr ? "error" : "none"}>
        <Input value={form.min_weight} disabled={!canManage} onChange={(_, d) => setForm({ ...form, min_weight: d.value })} />
      </Field>
      <Switch
        label="Suggest skills automatically (graph and, when enabled, AI)"
        checked={form.inference_auto_suggest}
        disabled={!canManage}
        onChange={(_, d) => setForm({ ...form, inference_auto_suggest: d.checked })}
      />
      {canManage && (
        <div className={styles.row}>
          <Button appearance="primary" icon={<Save20Regular />} disabled={!!wErr || save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      )}
      <Caption1 className={styles.muted}>Graph version {initial.graph_version}</Caption1>
    </Card>
  );
}

function PreviewCard({ initial }: { initial: { key: string; name: string } | null }) {
  const styles = useStyles();
  const [depth, setDepth] = useState(1);
  const deferred = useDeferredValue(initial?.key ?? "");
  const preview = useQuery({
    queryKey: skillGraphKeys.preview(deferred, depth),
    queryFn: () => skillGraphApi.preview([deferred], depth),
    enabled: !!deferred,
  });
  return (
    <Card>
      <CardHeader
        header={<Subtitle2 as="h2">Preview expansion</Subtitle2>}
        description={<Caption1>Skills that satisfy {initial?.name ?? "the selected skill"} in matching and search.</Caption1>}
        action={
          <Combobox
            aria-label="Depth"
            value={`Depth ${depth}`}
            selectedOptions={[String(depth)]}
            onOptionSelect={(_, d) => setDepth(Number(d.optionValue ?? 1))}
            style={{ minWidth: 110 }}
          >
            <Option value="1">Depth 1</Option>
            <Option value="2">Depth 2</Option>
          </Combobox>
        }
      />
      <ErrorBar message={preview.error ? errorMessage(preview.error) : null} />
      {preview.data && (
        <div className={styles.scroll}>
          <Table size="small" aria-label="Expansion preview">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Skill</TableHeaderCell>
                <TableHeaderCell>Weight</TableHeaderCell>
                <TableHeaderCell>Why</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.data.items
                .filter((i) => i.depth > 0)
                .map((i) => (
                  <TableRow key={`${i.root}:${i.key}`}>
                    <TableCell>{i.name}</TableCell>
                    <TableCell>{i.weight}</TableCell>
                    <TableCell>
                      <Caption1>{i.path.map((p) => p.label).join(" → ")}</Caption1>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
