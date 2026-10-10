"use client";

import {
  Button,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Switch,
  type TableColumnDefinition,
  Textarea,
  Toolbar,
  ToolbarButton,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { subProcessorColumns } from "@/features/notices/sub-processors-view";
import { fieldErrors } from "@/lib/api/errors";
import { platformApi, platformKeys } from "@/lib/api/platform-client";
import type { SubProcessorOut, SubProcessorUpdate } from "@/lib/api/types";
import { needsEmergencyOverride, platformErrorMessage, SUB_PROCESSOR_NOTICE_DAYS } from "./errors";

const useStyles = makeStyles({ form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM } });

const STATUSES = ["planned", "active", "retired"] as const;
const splitList = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

function dateInDays(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** `/platform/sub-processors`: CRUD with the 30-day notice rule and an audited emergency override. */
export function SubProcessorsAdmin() {
  const styles = useAdminStyles();
  const [editing, setEditing] = useState<SubProcessorOut | "new" | null>(null);
  const list = useQuery({ queryKey: platformKeys.subProcessors, queryFn: ({ signal }) => platformApi.subProcessors(signal) });
  const columns: TableColumnDefinition<SubProcessorOut>[] = [
    ...subProcessorColumns,
    createTableColumn({
      columnId: "notice",
      renderHeaderCell: () => "Notice sent",
      renderCell: (s) => (s.notice_sent_at ? new Date(s.notice_sent_at).toLocaleDateString() : "—"),
    }),
    createTableColumn({
      columnId: "edit",
      renderHeaderCell: () => "",
      renderCell: (s) => (
        <Button size="small" appearance="subtle" onClick={() => setEditing(s)}>
          Edit
        </Button>
      ),
    }),
  ];
  return (
    <>
      <PageHeader
        title="Sub-processors"
        subtitle={`Published at /sub-processors. New entries are announced to every tenant at least ${SUB_PROCESSOR_NOTICE_DAYS} days before they take effect.`}
      />
      <Toolbar aria-label="Sub-processor commands" className={styles.toolbar}>
        <ToolbarButton appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
          Add sub-processor
        </ToolbarButton>
      </Toolbar>
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(s) => s.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No sub-processors."
        label="Sub-processors"
        sortable
      />
      {editing === "new" && <CreateDrawer onClose={() => setEditing(null)} />}
      {editing && editing !== "new" && <EditDrawer sub={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function CreateDrawer({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [categories, setCategories] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [effective, setEffective] = useState(dateInDays(SUB_PROCESSOR_NOTICE_DAYS + 1));
  const [emergency, setEmergency] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const tooSoon = needsEmergencyOverride(`${effective}T00:00:00`);
  const create = useMutation({
    mutationFn: () =>
      platformApi.createSubProcessor({
        name: name.trim(),
        purpose: purpose.trim(),
        data_categories: splitList(categories),
        processing_location: location.trim(),
        country: country.trim(),
        website: website.trim() || null,
        effective_from: new Date(`${effective}T00:00:00`).toISOString(),
        emergency: tooSoon && emergency,
        emergency_reason: tooSoon && emergency ? emergencyReason.trim() : null,
      }),
    onSuccess: async () => {
      toast.success("Sub-processor added; every tenant's admins are notified");
      await queryClient.invalidateQueries({ queryKey: platformKeys.subProcessors });
      onClose();
    },
    onError: (e) => {
      setFields(fieldErrors(e));
      setError(platformErrorMessage(e));
    },
  });
  const valid =
    name.trim() && purpose.trim() && location.trim() && country.trim() && effective && (!tooSoon || (emergency && emergencyReason.trim().length >= 10));
  const f = (k: string) => ({ validationMessage: fields[k], validationState: fields[k] ? ("error" as const) : ("none" as const) });
  return (
    <DetailsDrawer
      open
      title="Add sub-processor"
      onClose={() => !create.isPending && onClose()}
      footer={
        <>
          <Button appearance="primary" disabled={!valid || create.isPending} icon={create.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => create.mutate()}>
            Add
          </Button>
          <Button onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <ErrorBar message={error} />
        <Field label="Name" required {...f("name")}>
          <Input value={name} onChange={(_, d) => setName(d.value)} maxLength={200} />
        </Field>
        <Field label="Purpose" required {...f("purpose")}>
          <Textarea value={purpose} onChange={(_, d) => setPurpose(d.value)} rows={2} maxLength={2000} resize="vertical" />
        </Field>
        <Field label="Data categories" hint="Comma-separated" {...f("data_categories")}>
          <Input value={categories} onChange={(_, d) => setCategories(d.value)} />
        </Field>
        <Field label="Processing location" required {...f("processing_location")}>
          <Input value={location} onChange={(_, d) => setLocation(d.value)} maxLength={200} />
        </Field>
        <Field label="Country" required {...f("country")}>
          <Input value={country} onChange={(_, d) => setCountry(d.value)} maxLength={100} />
        </Field>
        <Field label="Website" {...f("website")}>
          <Input value={website} onChange={(_, d) => setWebsite(d.value)} placeholder="https://" />
        </Field>
        <Field label="Effective from" required {...f("effective_from")}>
          <Input type="date" value={effective} onChange={(_, d) => setEffective(d.value)} />
        </Field>
        {tooSoon && (
          <>
            <MessageBar intent="warning" layout="multiline">
              <MessageBarBody>
                Less than {SUB_PROCESSOR_NOTICE_DAYS} days&apos; notice. Pick {dateInDays(SUB_PROCESSOR_NOTICE_DAYS + 1)} or later, or
                use the emergency override with a reason (audited).
              </MessageBarBody>
            </MessageBar>
            <Switch label="Emergency override" checked={emergency} onChange={(_, d) => setEmergency(d.checked)} />
            {emergency && (
              <Field label="Emergency reason" required hint="At least 10 characters." {...f("emergency_reason")}>
                <Textarea value={emergencyReason} onChange={(_, d) => setEmergencyReason(d.value)} rows={2} resize="vertical" />
              </Field>
            )}
          </>
        )}
      </div>
    </DetailsDrawer>
  );
}

function EditDrawer({ sub, onClose }: { sub: SubProcessorOut; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [purpose, setPurpose] = useState(sub.purpose);
  const [categories, setCategories] = useState(sub.data_categories.join(", "));
  const [location, setLocation] = useState(sub.processing_location);
  const [country, setCountry] = useState(sub.country);
  const [website, setWebsite] = useState(sub.website ?? "");
  const [status, setStatus] = useState(sub.status as (typeof STATUSES)[number]);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const body: SubProcessorUpdate = {
        purpose: purpose.trim(),
        data_categories: splitList(categories),
        processing_location: location.trim(),
        country: country.trim(),
        website: website.trim() || null,
        status,
      };
      return platformApi.updateSubProcessor(sub.id, body);
    },
    onSuccess: async () => {
      toast.success("Sub-processor saved");
      await queryClient.invalidateQueries({ queryKey: platformKeys.subProcessors });
      onClose();
    },
    onError: (e) => setError(platformErrorMessage(e)),
  });
  return (
    <DetailsDrawer
      open
      title={sub.name}
      onClose={() => !save.isPending && onClose()}
      footer={
        <>
          <Button appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => save.mutate()}>
            Save
          </Button>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <ErrorBar message={error} />
        <Field label="Purpose">
          <Textarea value={purpose} onChange={(_, d) => setPurpose(d.value)} rows={2} resize="vertical" />
        </Field>
        <Field label="Data categories" hint="Comma-separated">
          <Input value={categories} onChange={(_, d) => setCategories(d.value)} />
        </Field>
        <Field label="Processing location">
          <Input value={location} onChange={(_, d) => setLocation(d.value)} />
        </Field>
        <Field label="Country">
          <Input value={country} onChange={(_, d) => setCountry(d.value)} />
        </Field>
        <Field label="Website">
          <Input value={website} onChange={(_, d) => setWebsite(d.value)} />
        </Field>
        <Field label="Status">
          <Dropdown value={status.charAt(0).toUpperCase() + status.slice(1)} selectedOptions={[status]} onOptionSelect={(_, d) => d.optionValue && setStatus(d.optionValue as typeof status)}>
            {STATUSES.map((s) => (
              <Option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>
    </DetailsDrawer>
  );
}
