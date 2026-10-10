"use client";

import { Badge, Body1, Button, Field, Input, Link, Subtitle2, Textarea } from "@fluentui/react-components";
import { Checkmark20Regular, Dismiss20Regular, Play20Regular, Send20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer, ErrorBar, formatDateTime, IdSelect, useAdminStyles } from "@/features/admin/ui";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { projectsApi } from "./api";
import { DELIVERABLE_STATUS_COLORS, DELIVERABLE_STATUS_LABELS, deliverableActions } from "./logic";
import { RecordAcceptanceDialog } from "./record-acceptance-dialog";
import type { DeliverableIn, DeliverableOut, ProjectMilestone } from "./types";

const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Deliverable details (`OverlayDrawer`): edit fields, event history and start / submit / cancel /
 * record-acceptance actions. With `deliverable = null` it is the create form. */
export function DeliverableDrawer({
  projectId,
  clientId,
  deliverable,
  milestones,
  canWrite,
  canRecord,
  onClose,
  onChanged,
}: {
  projectId: string;
  clientId: string;
  deliverable: DeliverableOut | null;
  milestones: ProjectMilestone[];
  canWrite: boolean;
  canRecord: boolean;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const [current, setCurrent] = useState<DeliverableOut | null>(deliverable);
  const [form, setForm] = useState<DeliverableIn>({
    name: deliverable?.name ?? "",
    description: deliverable?.description ?? "",
    acceptance_criteria: deliverable?.acceptance_criteria ?? "",
    due_date: deliverable?.due_date ?? "",
    milestone_id: deliverable?.milestone_id ?? null,
  });
  const [recording, setRecording] = useState<"accept" | "reject" | null>(null);
  const set = <K extends keyof DeliverableIn>(k: K, v: DeliverableIn[K]) => setForm((f) => ({ ...f, [k]: v }));
  const body = (): DeliverableIn => ({
    name: form.name.trim(),
    description: blank(form.description),
    acceptance_criteria: blank(form.acceptance_criteria),
    due_date: blank(form.due_date),
    milestone_id: form.milestone_id || null,
  });
  const save = useMutation({
    mutationFn: () =>
      current ? projectsApi.updateDeliverable(current.id, { ...body(), lock_version: current.lock_version }) : projectsApi.addDeliverable(projectId, body()),
    onSuccess: async (d) => {
      toast.success(current ? "Deliverable saved" : "Deliverable added");
      await onChanged();
      if (current) setCurrent(d);
      else onClose();
    },
  });
  const act = useMutation({
    mutationFn: (a: "start" | "submit" | "cancel") => projectsApi.deliverableAction(current!.id, a),
    onSuccess: async (d) => {
      setCurrent(d);
      await onChanged();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const errors = fieldErrors(save.error);
  const actions = current ? deliverableActions(current.status) : [];
  const editable = canWrite && (!current || !["accepted", "cancelled"].includes(current.status));
  const milestoneOptions = milestones.filter((m) => m.status !== "cancelled").map((m) => ({ id: m.id, label: m.name }));

  return (
    <>
      <DetailsDrawer
        open
        size="medium"
        title={current ? current.name : "New deliverable"}
        onClose={onClose}
        footer={
          <div className={admin.footer} style={{ flexWrap: "wrap" }}>
            {canWrite && actions.includes("start") && (
              <Button icon={<Play20Regular />} disabled={act.isPending} onClick={() => act.mutate("start")}>
                Start
              </Button>
            )}
            {canWrite && actions.includes("submit") && (
              <Button icon={<Send20Regular />} disabled={act.isPending} onClick={() => act.mutate("submit")}>
                Submit for acceptance
              </Button>
            )}
            {canRecord && actions.includes("record_acceptance") && (
              <Button icon={<Checkmark20Regular />} onClick={() => setRecording("accept")}>
                Record acceptance
              </Button>
            )}
            {canRecord && actions.includes("record_rejection") && <Button onClick={() => setRecording("reject")}>Record rejection</Button>}
            {canWrite && actions.includes("cancel") && (
              <Button icon={<Dismiss20Regular />} disabled={act.isPending} onClick={() => act.mutate("cancel")}>
                Cancel deliverable
              </Button>
            )}
            {editable && (
              <Button appearance="primary" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>
                {current ? "Save" : "Add deliverable"}
              </Button>
            )}
          </div>
        }
      >
        <div className={admin.form}>
          <ErrorBar message={save.error && !Object.keys(errors).length ? errorMessage(save.error) : null} />
          {current && (
            <div className={admin.badges}>
              <Badge appearance="tint" color={DELIVERABLE_STATUS_COLORS[current.status]}>
                {DELIVERABLE_STATUS_LABELS[current.status]}
              </Badge>
              {current.milestone_name && <Badge appearance="outline">{current.milestone_name}</Badge>}
            </div>
          )}
          {current?.last_rejection_reason && (
            <ErrorBar title="Last rejection:" message={current.last_rejection_reason} />
          )}
          <Field label="Name" required validationMessage={errors.name}>
            <Input value={form.name} disabled={!editable} onChange={(_, d) => set("name", d.value)} />
          </Field>
          <Field label="Description">
            <Textarea value={form.description ?? ""} disabled={!editable} onChange={(_, d) => set("description", d.value)} />
          </Field>
          <Field label="Acceptance criteria" hint="Shown to the client when they accept">
            <Textarea value={form.acceptance_criteria ?? ""} disabled={!editable} onChange={(_, d) => set("acceptance_criteria", d.value)} />
          </Field>
          <Field label="Due date" validationMessage={errors.due_date}>
            <Input type="date" value={form.due_date ?? ""} disabled={!editable} onChange={(_, d) => set("due_date", d.value)} />
          </Field>
          <IdSelect
            label="Milestone"
            options={milestoneOptions}
            value={form.milestone_id ?? null}
            noneLabel="No milestone"
            disabled={!editable}
            onChange={(v) => set("milestone_id", v)}
          />
          {current && (
            <>
              <Subtitle2 as="h3" className={admin.sectionTitle}>
                Evidence
              </Subtitle2>
              {current.evidence_file_ids.length ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {current.evidence_file_ids.map((f, i) => (
                    <li key={f}>
                      <Link href={`/api/v1/files/${f}/download`} target="_blank" rel="noopener noreferrer">
                        Evidence {i + 1}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Body1 className={admin.muted}>None</Body1>
              )}
              <Subtitle2 as="h3" className={admin.sectionTitle}>
                History
              </Subtitle2>
              {current.events.length ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {current.events.map((e) => (
                    <li key={e.id}>
                      <span className={admin.muted}>{formatDateTime(e.at)}</span> — {e.kind.replace(/_/g, " ")}
                      {e.actor ? ` by ${e.actor}` : ""}
                      {e.reason ? `: ${e.reason}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <Body1 className={admin.muted}>No events yet.</Body1>
              )}
            </>
          )}
        </div>
      </DetailsDrawer>
      {recording && current && (
        <RecordAcceptanceDialog
          deliverable={current}
          clientId={clientId}
          mode={recording}
          onClose={() => setRecording(null)}
          onDone={async (d) => {
            setCurrent(d);
            toast.success(recording === "accept" ? "Acceptance recorded" : "Rejection recorded");
            await onChanged();
          }}
        />
      )}
    </>
  );
}
