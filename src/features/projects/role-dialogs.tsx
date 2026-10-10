"use client";

import {
  Button,
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
  MessageBar,
  MessageBarBody,
  Option,
  Textarea,
} from "@fluentui/react-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { placementsApi } from "@/features/placements/api";
import { skillsApi } from "@/features/skills/api";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { projectsApi } from "./api";
import type { AssignmentOut, BillRateUnit, ProjectRoleIn, ProjectRoleOut, RoleSkill } from "./types";

/** Resolve typed skill labels to catalogue keys (`global:<id>` / `tenant:<id>`); existing role skills keep their key. */
async function resolveSkills(labels: string[], existing: RoleSkill[]): Promise<RoleSkill[]> {
  const out: RoleSkill[] = [];
  for (const label of labels) {
    const known = existing.find((s) => (s.label ?? "").toLowerCase() === label.toLowerCase());
    if (known) {
      out.push(known);
      continue;
    }
    const page = await skillsApi.search(label, true, 1, 10);
    const hit = page.items.find((s) => s.name.toLowerCase() === label.toLowerCase()) ?? page.items[0];
    if (!hit) throw new Error(`Unknown skill: ${label}`);
    out.push({ skill_key: `${hit.kind}:${hit.id}`, label: hit.name });
  }
  return out;
}

const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
const UNITS: BillRateUnit[] = ["hour", "day", "month", "fixed"];

function Shell({
  title,
  children,
  onClose,
  primary,
  disabled,
  onPrimary,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  primary: string;
  disabled: boolean;
  onPrimary: () => void;
}) {
  const admin = useAdminStyles();
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>
            <div className={admin.form}>{children}</div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={disabled} onClick={onPrimary}>
              {primary}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Add or edit a project role (title, headcount, dates, skills as comma-separated keys, bill rate). */
export function RoleDialog({
  projectId,
  role,
  onClose,
  onSaved,
}: {
  projectId: string;
  role: ProjectRoleOut | null;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const [form, setForm] = useState({
    title: role?.title ?? "",
    headcount: String(role?.headcount ?? 1),
    start_date: role?.start_date ?? "",
    end_date: role?.end_date ?? "",
    skills: (role?.skills ?? []).map((s) => s.label || s.skill_key).join(", "),
    bill_rate: role?.bill_rate ?? "",
    bill_rate_unit: (role?.bill_rate_unit ?? "hour") as BillRateUnit,
    notes: role?.notes ?? "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: async () => {
      const labels = form.skills
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const body: ProjectRoleIn = {
        title: form.title.trim(),
        headcount: Number(form.headcount),
        start_date: blank(form.start_date),
        end_date: blank(form.end_date),
        skills: await resolveSkills(labels, role?.skills ?? []),
        bill_rate: blank(form.bill_rate),
        bill_rate_unit: blank(form.bill_rate) ? form.bill_rate_unit : null,
        notes: blank(form.notes),
      };
      return role ? projectsApi.updateRole(role.id, body) : projectsApi.addRole(projectId, body);
    },
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  const errors = fieldErrors(save.error);
  const valid = !!form.title.trim() && Number.isInteger(Number(form.headcount)) && Number(form.headcount) >= 1;
  return (
    <Shell title={role ? "Edit role" : "Add role"} onClose={onClose} primary={role ? "Save" : "Add role"} disabled={!valid || save.isPending} onPrimary={() => save.mutate()}>
      <ErrorBar message={save.error && !Object.keys(errors).length ? errorMessage(save.error) : null} />
      <Field label="Title" required validationMessage={errors.title}>
        <Input value={form.title} onChange={(_, d) => set("title", d.value)} />
      </Field>
      <Field label="Headcount" required validationMessage={errors.headcount}>
        <Input type="number" min={1} value={form.headcount} onChange={(_, d) => set("headcount", d.value)} />
      </Field>
      <Field label="Start date" validationMessage={errors.start_date}>
        <Input type="date" value={form.start_date} onChange={(_, d) => set("start_date", d.value)} />
      </Field>
      <Field label="End date" validationMessage={errors.end_date}>
        <Input type="date" value={form.end_date} onChange={(_, d) => set("end_date", d.value)} />
      </Field>
      <Field label="Skills" hint="Comma-separated catalogue skills, e.g. React, TypeScript">
        <Input value={form.skills} onChange={(_, d) => set("skills", d.value)} />
      </Field>
      <Field label="Bill rate" validationMessage={errors.bill_rate}>
        <Input value={form.bill_rate} inputMode="decimal" onChange={(_, d) => set("bill_rate", d.value)} />
      </Field>
      <Field label="Bill rate unit">
        <Dropdown value={form.bill_rate_unit} selectedOptions={[form.bill_rate_unit]} onOptionSelect={(_, d) => set("bill_rate_unit", d.optionValue ?? "hour")}>
          {UNITS.map((u) => (
            <Option key={u} value={u}>
              {u}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(_, d) => set("notes", d.value)} />
      </Field>
    </Shell>
  );
}

/** Assign a Placement (searched by worker / PLC id among the client's placements) to a role. */
export function AssignDialog({
  role,
  clientId,
  onClose,
  onSaved,
}: {
  role: ProjectRoleOut;
  clientId: string;
  onClose: () => void;
  onSaved: (a: AssignmentOut) => Promise<unknown>;
}) {
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const [placementId, setPlacementId] = useState<string | null>(null);
  const [pct, setPct] = useState("100");
  const [start, setStart] = useState(role.start_date ?? "");
  const [end, setEnd] = useState(role.end_date ?? "");
  const placements = useQuery({
    queryKey: ["projects", "placement-search", clientId, deferred],
    queryFn: ({ signal }) => placementsApi.list({ client_id: clientId, q: deferred || undefined, page_size: 20 }, signal),
    placeholderData: (prev) => prev,
  });
  const save = useMutation({
    mutationFn: () => projectsApi.assign(role.id, { placement_id: placementId!, allocation_pct: pct.trim(), start_date: start, end_date: blank(end) }),
    onSuccess: async (a) => {
      await onSaved(a);
      onClose();
    },
  });
  const errors = fieldErrors(save.error);
  const n = Number(pct);
  const valid = !!placementId && !!start && n > 0 && n <= 100;
  return (
    <Shell title={`Assign to ${role.title}`} onClose={onClose} primary="Assign" disabled={!valid || save.isPending} onPrimary={() => save.mutate()}>
      <ErrorBar message={save.error && !Object.keys(errors).length ? errorMessage(save.error) : null} />
      <Field label="Placement" required validationMessage={errors.placement_id}>
        <Combobox
          freeform
          placeholder="Search by worker name or placement id"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPlacementId(null);
          }}
          onOptionSelect={(_, d) => {
            setPlacementId(d.optionValue ?? null);
            setSearch(d.optionText ?? "");
          }}
        >
          {(placements.data?.items ?? []).map((p) => (
            <Option key={p.id} value={p.id} text={`${p.human_id} · ${p.candidate_name ?? ""}`}>
              {`${p.human_id} · ${p.candidate_name ?? "—"}${p.role_title ? ` · ${p.role_title}` : ""} (${p.status})`}
            </Option>
          ))}
        </Combobox>
      </Field>
      <Field label="Allocation %" required validationMessage={errors.allocation_pct}>
        <Input value={pct} inputMode="decimal" contentAfter="%" onChange={(_, d) => setPct(d.value)} />
      </Field>
      <Field label="Start date" required validationMessage={errors.start_date}>
        <Input type="date" value={start} onChange={(_, d) => setStart(d.value)} />
      </Field>
      <Field label="End date" validationMessage={errors.end_date}>
        <Input type="date" value={end} onChange={(_, d) => setEnd(d.value)} />
      </Field>
    </Shell>
  );
}

/** End an active assignment. */
export function EndAssignmentDialog({ assignment, onClose, onSaved }: { assignment: AssignmentOut; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: () => projectsApi.endAssignment(assignment.id, date, reason.trim()),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  return (
    <Shell title={`End assignment of ${assignment.worker_name ?? "worker"}`} onClose={onClose} primary="End assignment" disabled={!date || save.isPending} onPrimary={() => save.mutate()}>
      <ErrorBar message={save.error ? errorMessage(save.error) : null} />
      <Field label="End date" required>
        <Input type="date" value={date} onChange={(_, d) => setDate(d.value)} />
      </Field>
      <Field label="Reason">
        <Textarea value={reason} onChange={(_, d) => setReason(d.value)} />
      </Field>
    </Shell>
  );
}

/** Warnings returned with a new assignment (e.g. over-allocation), shown once. */
export function AssignmentWarnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <MessageBar intent="warning" layout="multiline">
      <MessageBarBody>{warnings.join(" ")}</MessageBarBody>
    </MessageBar>
  );
}
