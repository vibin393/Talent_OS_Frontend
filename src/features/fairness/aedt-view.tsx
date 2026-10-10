"use client";

import {
  Badge,
  Button,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer, ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { FairnessNav } from "./fairness-nav";
import { AEDT_FEATURE_LABELS, AEDT_STATUS, formatDate } from "./logic";
import type { AedtFeature, AedtIn, AedtOut, AedtStatus } from "./types";
import { useAedts, useFairnessPermissions, useSaveAedt } from "./use-fairness";

const useStyles = makeStyles({
  toolbar: { display: "flex", justifyContent: "flex-end", marginBottom: tokens.spacingVerticalM },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  info: { marginBottom: tokens.spacingVerticalM },
});

const EMPTY: AedtIn = {
  feature: "other",
  name: "",
  version: null,
  first_used_on: null,
  data_used: null,
  job_categories: [],
  used_to_filter: false,
  status: "inactive",
  notes: null,
};

// Agent entries (Epic 65) are seeded by the platform, not created by hand.
const FEATURES = (Object.keys(AEDT_FEATURE_LABELS) as AedtFeature[]).filter((f) => !f.startsWith("agent_"));
const STATUSES = Object.keys(AEDT_STATUS) as AedtStatus[];

/** `/fairness/aedt`: inventory of automated employment decision tools (`aedt:manage` edits). */
export function AedtView() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const { canRead, canManageAedt } = useFairnessPermissions();
  const q = useAedts(canRead || canManageAedt);
  const [editing, setEditing] = useState<AedtOut | "new" | null>(null);
  if (!canRead && !canManageAedt) return <NoAccess what="the AEDT inventory" />;
  return (
    <>
      <PageHeader title="AEDT inventory" subtitle="Automated employment decision tools used in hiring, for bias audits and the NYC LL144 notice." />
      <FairnessNav current="aedt" />
      <MessageBar intent="info" className={styles.info} layout="multiline">
        <MessageBarBody>Seeded entries start inactive. Review each one and set it to Active to confirm it is in use.</MessageBarBody>
      </MessageBar>
      {canManageAedt && (
        <div className={styles.toolbar}>
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
            Add tool
          </Button>
        </div>
      )}
      {q.isPending ? (
        <GridSkeleton rows={4} />
      ) : q.isError ? (
        <ErrorBar title="Could not load the AEDT inventory." message={errorMessage(q.error)} />
      ) : q.data.length === 0 ? (
        <div className={admin.empty}>No tools in the inventory.</div>
      ) : (
        <div className={admin.surface}>
          <Table aria-label="AEDT inventory" className={admin.grid}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Feature</TableHeaderCell>
                <TableHeaderCell>Version</TableHeaderCell>
                <TableHeaderCell>First used</TableHeaderCell>
                <TableHeaderCell>Filters candidates</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                {canManageAedt && <TableHeaderCell>Actions</TableHeaderCell>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((a) => {
                const s = AEDT_STATUS[a.status] ?? { label: a.status, color: "subtle" as const };
                return (
                  <TableRow key={a.id}>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{AEDT_FEATURE_LABELS[a.feature] ?? a.feature}</TableCell>
                    <TableCell>{a.version ?? "—"}</TableCell>
                    <TableCell>{formatDate(a.first_used_on)}</TableCell>
                    <TableCell>{a.used_to_filter ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <Badge appearance="tint" color={s.color}>
                        {s.label}
                      </Badge>
                    </TableCell>
                    {canManageAedt && (
                      <TableCell>
                        <Button size="small" icon={<Edit20Regular />} onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && <AedtEditor key={editing === "new" ? "new" : editing.id} entry={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function AedtEditor({ entry, onClose }: { entry: AedtOut | null; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const save = useSaveAedt();
  const [d, setD] = useState<AedtIn>(() => (entry ? { ...EMPTY, ...entry } : EMPTY));
  const [categories, setCategories] = useState((entry?.job_categories ?? []).join(", "));
  const set = <K extends keyof AedtIn>(k: K, v: AedtIn[K]) => setD((x) => ({ ...x, [k]: v }));
  const invalid = !d.name.trim();
  const submit = () => {
    const body: AedtIn = {
      feature: d.feature,
      name: d.name.trim(),
      version: d.version?.trim() || null,
      first_used_on: d.first_used_on || null,
      data_used: d.data_used?.trim() || null,
      job_categories: categories
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      used_to_filter: d.used_to_filter,
      status: d.status,
      notes: d.notes?.trim() || null,
    };
    save.mutate(
      { id: entry?.id ?? null, body },
      {
        onSuccess: () => {
          toast.success(entry ? "Tool updated." : "Tool added.");
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };
  return (
    <DetailsDrawer
      open
      title={entry ? `Edit ${entry.name}` : "Add tool"}
      onClose={onClose}
      footer={
        <>
          <Button disabled={save.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button appearance="primary" disabled={invalid || save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Name" required>
          <Input value={d.name} onChange={(_, x) => set("name", x.value)} />
        </Field>
        <Field label="Feature">
          <Dropdown value={AEDT_FEATURE_LABELS[d.feature]} selectedOptions={[d.feature]} onOptionSelect={(_, x) => x.optionValue && set("feature", x.optionValue as AedtFeature)}>
            {FEATURES.map((f) => (
              <Option key={f} value={f}>
                {AEDT_FEATURE_LABELS[f]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Version">
          <Input value={d.version ?? ""} onChange={(_, x) => set("version", x.value || null)} />
        </Field>
        <Field label="First used on">
          <Input type="date" value={d.first_used_on ?? ""} onChange={(_, x) => set("first_used_on", x.value || null)} />
        </Field>
        <Field label="Data used">
          <Textarea value={d.data_used ?? ""} onChange={(_, x) => set("data_used", x.value || null)} resize="vertical" />
        </Field>
        <Field label="Job categories" hint="Comma separated; leave empty for all.">
          <Input value={categories} onChange={(_, x) => setCategories(x.value)} />
        </Field>
        <Switch label="Used to filter or rank candidates" checked={d.used_to_filter} onChange={(_, x) => set("used_to_filter", x.checked)} />
        <Field label="Status">
          <Dropdown value={AEDT_STATUS[d.status].label} selectedOptions={[d.status]} onOptionSelect={(_, x) => x.optionValue && set("status", x.optionValue as AedtStatus)}>
            {STATUSES.map((s) => (
              <Option key={s} value={s}>
                {AEDT_STATUS[s].label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Notes">
          <Textarea value={d.notes ?? ""} onChange={(_, x) => set("notes", x.value || null)} resize="vertical" />
        </Field>
      </div>
    </DetailsDrawer>
  );
}
