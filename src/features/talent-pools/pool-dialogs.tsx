"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Spinner,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { useAppToast } from "@/components/toast";
import { adminApi } from "@/features/admin/api";
import { ErrorBar, IdSelect } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { demandsApi } from "@/features/demands/api";
import { EMPTY_DEMAND_FILTERS } from "@/features/demands/query";
import { SOURCE_LABELS as SEGMENT_SOURCE_LABELS } from "@/features/segments/logic";
import { SegmentBuilder } from "@/features/segments/segment-builder";
import type { Definition, SourceKey, Visibility } from "@/features/segments/types";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { poolKeys, poolsApi } from "./api";
import {
  pipelineResultText,
  templateErrorMessage,
  templateNeedsBatch,
  templateStatus,
  VISIBILITY_LABELS,
  visibilityOptions,
} from "./logic";
import type { PoolKind, PoolOut, PoolTemplate } from "./types";
import { useInvalidatePools, usePools } from "./use-pools";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  wide: { maxWidth: "1040px", width: "calc(100vw - 32px)" },
  medium: { maxWidth: "640px", width: "calc(100vw - 32px)" },
  row: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap" },
  grow: { flex: "1 1 220px" },
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, margin: 0, padding: 0, listStyleType: "none" },
  template: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    flexWrap: "wrap",
    padding: tokens.spacingVerticalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  templateText: { display: "flex", flexDirection: "column", flex: "1 1 260px", minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Team dropdown for `visibility=team` (when the user may list teams; otherwise the server uses theirs). */
function TeamSelect({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const canListTeams = usePermission("team:read");
  const teams = useQuery({
    queryKey: ["admin", "teams", "lookup"],
    queryFn: ({ signal }) => adminApi.listTeams(1, 100, signal),
    enabled: canListTeams,
    staleTime: 5 * 60_000,
  });
  if (!canListTeams || teams.isError) return <Caption1>The pool is shared with your team.</Caption1>;
  return (
    <IdSelect
      label="Team"
      options={(teams.data?.items ?? []).map((t) => ({ id: t.id, label: t.name }))}
      value={value}
      onChange={onChange}
      noneLabel="My team"
    />
  );
}

function VisibilityField({
  value,
  onChange,
  teamId,
  onTeamChange,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  teamId: string | null;
  onTeamChange: (id: string | null) => void;
}) {
  const canManage = usePermission("pool:manage");
  return (
    <>
      <Field label="Visibility" hint={canManage ? undefined : "Organization-wide pools need the manage pools permission."}>
        <RadioGroup layout="horizontal" value={value} onChange={(_, d) => onChange(d.value as Visibility)}>
          {visibilityOptions(canManage).map((v) => (
            <Radio key={v} value={v} label={VISIBILITY_LABELS[v]} />
          ))}
        </RadioGroup>
      </Field>
      {value === "team" && <TeamSelect value={teamId} onChange={onTeamChange} />}
    </>
  );
}

/** "New pool": static, or dynamic with an inline segment built in the segment builder. */
export function NewPoolDialog({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const invalidate = useInvalidatePools();
  const canSegment = usePermission("segment:write");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<PoolKind>("static");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [sourceKey, setSourceKey] = useState<SourceKey>("candidates.candidate");
  const [definition, setDefinition] = useState<Definition>({ filters: null });
  const create = useMutation({
    mutationFn: () =>
      poolsApi.create({
        name: name.trim(),
        description: description.trim() || null,
        kind,
        visibility,
        team_id: visibility === "team" ? teamId : null,
        ...(kind === "dynamic" ? { segment: { source_key: sourceKey, definition } } : {}),
      }),
    onSuccess: async (pool) => {
      toast.success(kind === "dynamic" ? "Pool created. Its first refresh is running." : "Pool created.");
      await invalidate();
      router.push(`/talent-pools/${pool.id}`);
    },
  });
  const errs = fieldErrors(create.error);
  const dynamicBlocked = kind === "dynamic" && (!canSegment || !definition.filters);
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !create.isPending && onClose()}>
      <DialogSurface className={kind === "dynamic" ? styles.wide : styles.medium}>
        <DialogBody>
          <DialogTitle>New talent pool</DialogTitle>
          <DialogContent className={styles.form}>
            {create.isError && Object.keys(errs).length === 0 && <ErrorBar title="Could not create the pool." message={errorMessage(create.error)} />}
            <div className={styles.row}>
              <Field label="Name" required className={styles.grow} validationMessage={errs.name}>
                <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
              </Field>
              <Field label="Kind">
                <RadioGroup layout="horizontal" value={kind} onChange={(_, d) => setKind(d.value as PoolKind)}>
                  <Radio value="static" label="Static (hand-picked)" />
                  <Radio value="dynamic" label="Dynamic (segment)" />
                </RadioGroup>
              </Field>
            </div>
            <Field label="Description">
              <Textarea value={description} maxLength={2000} onChange={(_, d) => setDescription(d.value)} />
            </Field>
            <VisibilityField value={visibility} onChange={setVisibility} teamId={teamId} onTeamChange={setTeamId} />
            {kind === "dynamic" &&
              (canSegment ? (
                <>
                  <Field label="Records">
                    <Dropdown
                      value={SEGMENT_SOURCE_LABELS[sourceKey]}
                      selectedOptions={[sourceKey]}
                      onOptionSelect={(_, d) => {
                        if (!d.optionValue || d.optionValue === sourceKey) return;
                        setSourceKey(d.optionValue as SourceKey);
                        setDefinition({ filters: null });
                      }}
                    >
                      {(Object.keys(SEGMENT_SOURCE_LABELS) as SourceKey[]).map((k) => (
                        <Option key={k} value={k}>
                          {SEGMENT_SOURCE_LABELS[k]}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                  <SegmentBuilder key={sourceKey} sourceKey={sourceKey} onChange={setDefinition} />
                </>
              ) : (
                <MessageBar intent="warning">
                  <MessageBarBody>You need the edit segments permission to create a dynamic pool.</MessageBarBody>
                </MessageBar>
              ))}
          </DialogContent>
          <DialogActions>
            <Button disabled={create.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!name.trim() || dynamicBlocked || create.isPending}
              icon={create.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => create.mutate()}
            >
              Create pool
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Edit name, description and visibility of a pool. */
export function EditPoolDialog({ pool, onClose }: { pool: PoolOut; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const invalidate = useInvalidatePools();
  const [name, setName] = useState(pool.name);
  const [description, setDescription] = useState(pool.description ?? "");
  const [visibility, setVisibility] = useState<Visibility>(pool.visibility);
  const [teamId, setTeamId] = useState<string | null>(pool.team_id);
  const save = useMutation({
    mutationFn: () =>
      poolsApi.update(pool.id, {
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        team_id: visibility === "team" ? teamId : null,
      }),
    onSuccess: async () => {
      toast.success("Pool saved.");
      await invalidate();
      onClose();
    },
  });
  const errs = fieldErrors(save.error);
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface className={styles.medium}>
        <DialogBody>
          <DialogTitle>Edit pool</DialogTitle>
          <DialogContent className={styles.form}>
            {save.isError && Object.keys(errs).length === 0 && <ErrorBar title="Could not save the pool." message={errorMessage(save.error)} />}
            <Field label="Name" required validationMessage={errs.name}>
              <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
            </Field>
            <Field label="Description">
              <Textarea value={description} maxLength={2000} onChange={(_, d) => setDescription(d.value)} />
            </Field>
            <VisibilityField value={visibility} onChange={setVisibility} teamId={teamId} onTeamChange={setTeamId} />
          </DialogContent>
          <DialogActions>
            <Button disabled={save.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!name.trim() || save.isPending}
              icon={save.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function TemplateRow({ t }: { t: PoolTemplate }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const invalidate = useInvalidatePools();
  const [batch, setBatch] = useState("");
  const status = templateStatus(t);
  const needsBatch = templateNeedsBatch(t);
  const enable = useMutation({
    mutationFn: () => poolsApi.enableTemplate(t.key, needsBatch ? batch.trim() : null),
    onSuccess: async (pool) => {
      toast.success(`${t.name} enabled. Its first refresh is running.`);
      await invalidate();
      router.push(`/talent-pools/${pool.id}`);
    },
    onError: (e) => toast.error(templateErrorMessage(e) ?? errorMessage(e, "Could not enable the template.")),
  });
  return (
    <li className={styles.template}>
      <div className={styles.templateText}>
        <Text weight="semibold">{t.name}</Text>
        {t.description && <Caption1 className={styles.muted}>{t.description}</Caption1>}
        <Caption1 className={styles.muted}>{SEGMENT_SOURCE_LABELS[t.source_key] ?? t.source_key}</Caption1>
        {status.reason && <Caption1>{status.reason}</Caption1>}
      </div>
      <Badge appearance="tint" color={status.color}>
        {status.label}
      </Badge>
      {needsBatch && status.canEnable && (
        <Input aria-label={`Batch for ${t.name}`} placeholder="Batch, e.g. 2027" value={batch} onChange={(_, d) => setBatch(d.value)} />
      )}
      {t.enabled && t.pool_id ? (
        <Link onClick={() => router.push(`/talent-pools/${t.pool_id}`)}>Open pool</Link>
      ) : (
        <Button
          appearance="primary"
          size="small"
          disabled={!status.canEnable || enable.isPending || (needsBatch && !batch.trim())}
          icon={enable.isPending ? <Spinner size="tiny" /> : undefined}
          onClick={() => enable.mutate()}
        >
          Enable
        </Button>
      )}
    </li>
  );
}

/** "Templates": seed pool templates (disabled by default) with an Enable action. */
export function TemplatesDialog({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const templates = useQuery({ queryKey: poolKeys.templates, queryFn: ({ signal }) => poolsApi.templates(signal) });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={styles.medium}>
        <DialogBody>
          <DialogTitle>Pool templates</DialogTitle>
          <DialogContent className={styles.form}>
            <Body1>Enabling a template creates an organization-wide dynamic pool that you can edit afterwards.</Body1>
            {templates.isPending ? (
              <Spinner size="small" label="Loading templates…" />
            ) : templates.isError ? (
              <ErrorBar title="Could not load the templates." message={errorMessage(templates.error)} />
            ) : (
              <ul className={styles.list}>
                {templates.data.map((t) => (
                  <TemplateRow key={t.key} t={t} />
                ))}
              </ul>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Demand search `Combobox` (title or req id). */
function DemandCombobox({ value, onChange }: { value: string | null; onChange: (id: string | null, label: string) => void }) {
  const [text, setText] = useState("");
  const q = useDeferredValue(text.trim());
  const demands = useQuery({
    queryKey: ["demands", "picker", q],
    queryFn: ({ signal }) => demandsApi.list({ ...EMPTY_DEMAND_FILTERS, q }, 20, signal),
    placeholderData: (prev) => prev,
  });
  const items = demands.data?.items ?? [];
  return (
    <Field label="Demand" required>
      <Combobox
        freeform
        placeholder="Search demands by title or ID"
        value={text}
        selectedOptions={value ? [value] : []}
        onChange={(e) => {
          setText(e.target.value);
          onChange(null, "");
        }}
        onOptionSelect={(_, d) => {
          const dm = items.find((x) => x.id === d.optionValue);
          if (!dm) return;
          const label = `${dm.title} (${dm.req_id})`;
          setText(label);
          onChange(dm.id, label);
        }}
      >
        {items.map((d) => (
          <Option key={d.id} value={d.id} text={`${d.title} (${d.req_id})`}>
            {`${d.title} (${d.req_id})`}
          </Option>
        ))}
      </Combobox>
    </Field>
  );
}

/** "Add to pipeline": pick a Demand, then add the selected pool members to its pipeline. */
export function AddToPipelineDialog({
  poolId,
  candidateIds,
  onClose,
}: {
  poolId: string;
  candidateIds: string[];
  onClose: () => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const [demandId, setDemandId] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => poolsApi.addToPipeline(demandId!, poolId, { candidate_ids: candidateIds }),
    onSuccess: (r) => {
      toast.success(`Pipeline: ${pipelineResultText(r.items)}.`);
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !add.isPending && onClose()}>
      <DialogSurface className={styles.medium}>
        <DialogBody>
          <DialogTitle>Add to pipeline</DialogTitle>
          <DialogContent className={styles.form}>
            <Body1>
              Add {candidateIds.length} {candidateIds.length === 1 ? "candidate" : "candidates"} to a demand&apos;s pipeline.
            </Body1>
            {add.isError && <ErrorBar title="Could not add to the pipeline." message={errorMessage(add.error)} />}
            <DemandCombobox value={demandId} onChange={(id) => setDemandId(id)} />
          </DialogContent>
          <DialogActions>
            <Button disabled={add.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!demandId || add.isPending || candidateIds.length === 0}
              icon={add.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => add.mutate()}
            >
              Add to pipeline
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** "Add to Pool": pick one of the static pools the user can edit and add the candidates to it. */
export function AddToPoolDialog({ candidateIds, onClose }: { candidateIds: string[]; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const invalidate = useInvalidatePools();
  const pools = usePools({ kind: "static" });
  const editable = (pools.data ?? []).filter((p) => p.can_edit && p.status === "active");
  const [poolId, setPoolId] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => poolsApi.addMembers(poolId!, candidateIds),
    onSuccess: async (r) => {
      const name = editable.find((p) => p.id === poolId)?.name ?? "the pool";
      toast.success(r.added ? `Added to ${name}.` : `Already in ${name}.`);
      await invalidate();
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !add.isPending && onClose()}>
      <DialogSurface className={styles.medium}>
        <DialogBody>
          <DialogTitle>Add to pool</DialogTitle>
          <DialogContent className={styles.form}>
            {add.isError && <ErrorBar title="Could not add to the pool." message={errorMessage(add.error)} />}
            {pools.isPending ? (
              <Spinner size="small" label="Loading pools…" />
            ) : pools.isError ? (
              <ErrorBar title="Could not load pools." message={errorMessage(pools.error)} />
            ) : editable.length === 0 ? (
              <Body1>You have no static pools to add to. Create one on the Talent Pools page.</Body1>
            ) : (
              <IdSelect
                label="Static pool"
                hint="Dynamic pools are filled by their segment and cannot be added to by hand."
                options={editable.map((p) => ({ id: p.id, label: `${p.name} (${p.member_count})` }))}
                value={poolId}
                onChange={setPoolId}
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={add.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!poolId || add.isPending}
              icon={add.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => add.mutate()}
            >
              Add
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
