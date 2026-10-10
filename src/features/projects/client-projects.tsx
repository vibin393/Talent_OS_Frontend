"use client";

import {
  Badge,
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  MessageBar,
  MessageBarBody,
  Text,
  Textarea,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { portalPdfUrl } from "@/features/billing/api";
import { formatMoney } from "@/features/billing/money";
import { Empty, Failure, formatDate, Loading, PageTitle, useCpStyles } from "@/features/client-portal/ui";
import { clientPortalApi, clientPortalKeys } from "@/lib/api/client-portal-client";
import { errorMessage } from "@/lib/api/errors";
import { portalProjectKeys, portalProjectsApi } from "./api";
import { DELIVERABLE_STATUS_COLORS, DELIVERABLE_STATUS_LABELS, PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, rejectionError, sortPortalDeliverables } from "./logic";
import type { PortalProjectDeliverable } from "./types";

/** `/client/projects`: the client's projects with the count awaiting acceptance. */
export function ClientProjects() {
  const s = useCpStyles();
  const q = useQuery({ queryKey: portalProjectKeys.list, queryFn: ({ signal }) => portalProjectsApi.list(signal) });
  return (
    <div className={s.page}>
      <PageTitle>Projects</PageTitle>
      {q.error ? <Failure error={q.error} /> : null}
      {!q.data && !q.error ? <Loading /> : null}
      {q.data && q.data.length === 0 ? <Empty>No projects yet.</Empty> : null}
      <div className={s.list}>
        {q.data?.map((p) => (
          <div key={p.id} className={s.card}>
            <div className={s.row}>
              <div className={s.grow}>
                <Link className={s.link} href={`/client/projects/${p.id}`}>
                  <Text weight="semibold">{p.name}</Text>
                </Link>
                <br />
                <Text size={200} className={s.muted}>{`${p.human_id} · ${formatDate(p.start_date)} – ${formatDate(p.end_date)}`}</Text>
              </div>
              <Badge appearance="tint" color={PROJECT_STATUS_COLORS[p.status] ?? "informative"}>
                {PROJECT_STATUS_LABELS[p.status] ?? p.status}
              </Badge>
              {p.awaiting_acceptance > 0 ? (
                <Badge appearance="filled" color="warning">{`${p.awaiting_acceptance} awaiting your acceptance`}</Badge>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** `/client/projects/[id]`: deliverables (awaiting acceptance first) with Accept / Reject, roles and milestones. */
export function ClientProjectDetail({ id }: { id: string }) {
  const s = useCpStyles();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: clientPortalKeys.me, queryFn: ({ signal }) => clientPortalApi.me(signal) });
  const canAccept = (me.data?.portal_permissions ?? []).includes("deliverables:accept");
  const q = useQuery({ queryKey: portalProjectKeys.detail(id), queryFn: ({ signal }) => portalProjectsApi.get(id, signal) });
  const [accepting, setAccepting] = useState<PortalProjectDeliverable | null>(null);
  const [rejecting, setRejecting] = useState<PortalProjectDeliverable | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = async (msg: string) => {
    setNotice(msg);
    await qc.invalidateQueries({ queryKey: portalProjectKeys.list });
  };
  if (q.error) return <Failure error={q.error} />;
  if (!q.data) return <Loading />;
  const p = q.data;
  const deliverables = sortPortalDeliverables(p.deliverables.filter((d) => d.status !== "cancelled"));
  return (
    <div className={s.page}>
      <PageTitle>{p.name}</PageTitle>
      <Text className={s.muted}>{`${p.human_id} · ${PROJECT_STATUS_LABELS[p.status] ?? p.status} · ${formatDate(p.start_date)} – ${formatDate(p.end_date)}`}</Text>
      {notice ? (
        <MessageBar intent="success" aria-live="polite">
          <MessageBarBody>{notice}</MessageBarBody>
        </MessageBar>
      ) : null}

      <Text as="h2" size={500} weight="semibold">
        Deliverables
      </Text>
      {deliverables.length === 0 ? <Empty>No deliverables yet.</Empty> : null}
      <div className={s.list}>
        {deliverables.map((d) => (
          <div key={d.id} className={s.card}>
            <div className={s.row}>
              <div className={s.grow}>
                <Text weight="semibold">{d.name}</Text>
                <br />
                <Text size={200} className={s.muted}>{`Due ${formatDate(d.due_date)}${d.accepted_at ? ` · accepted ${formatDate(d.accepted_at)}` : ""}`}</Text>
              </div>
              <Badge appearance="tint" color={DELIVERABLE_STATUS_COLORS[d.status]}>
                {DELIVERABLE_STATUS_LABELS[d.status]}
              </Badge>
            </div>
            {d.description ? <Body1>{d.description}</Body1> : null}
            {d.last_rejection_reason && d.status !== "accepted" ? (
              <Text size={200} className={s.muted}>{`Last rejection: ${d.last_rejection_reason}`}</Text>
            ) : null}
            {d.status === "submitted" && canAccept ? (
              <div className={s.actions}>
                <Button appearance="primary" onClick={() => setAccepting(d)}>
                  Accept
                </Button>
                <Button onClick={() => setRejecting(d)}>Reject</Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {p.milestones.length > 0 ? (
        <>
          <Text as="h2" size={500} weight="semibold">
            Milestones
          </Text>
          <div className={s.list}>
            {p.milestones.map((m) => (
              <div key={m.id} className={s.card}>
                <div className={s.row}>
                  <div className={s.grow}>
                    <Text weight="semibold">{m.name}</Text>
                    <br />
                    <Text size={200} className={s.muted}>{`Due ${formatDate(m.due_date)}`}</Text>
                  </div>
                  <Text className={s.num}>{formatMoney(m.amount)}</Text>
                  <Badge appearance="tint" color={m.status === "accepted" ? "success" : m.status === "cancelled" ? "subtle" : "informative"}>
                    {m.billed ? "Invoiced" : m.status}
                  </Badge>
                  {m.invoice_id ? (
                    <a className={s.link} href={portalPdfUrl("invoice", m.invoice_id)}>
                      {`Invoice ${m.invoice_number ?? ""}`}
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {p.roles.length > 0 ? (
        <>
          <Text as="h2" size={500} weight="semibold">
            Team
          </Text>
          <div className={s.list}>
            {p.roles.map((r) => (
              <div key={r.id} className={s.card}>
                <div className={s.row}>
                  <div className={s.grow}>
                    <Text weight="semibold">{r.title}</Text>
                    <br />
                    <Text size={200} className={s.muted}>{`${r.workers.length}/${r.headcount} · ${formatDate(r.start_date)} – ${formatDate(r.end_date)}`}</Text>
                  </div>
                  <Text>{r.workers.join(", ") || "—"}</Text>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {accepting ? (
        <AcceptDialog
          deliverable={accepting}
          onClose={() => setAccepting(null)}
          onDone={async () => {
            await q.refetch();
            await refresh(`"${accepting.name}" accepted.`);
          }}
        />
      ) : null}
      {rejecting ? (
        <RejectDialog
          deliverable={rejecting}
          onClose={() => setRejecting(null)}
          onDone={async () => {
            await q.refetch();
            await refresh(`"${rejecting.name}" returned to the delivery team.`);
          }}
        />
      ) : null}
    </div>
  );
}

function AcceptDialog({ deliverable, onClose, onDone }: { deliverable: PortalProjectDeliverable; onClose: () => void; onDone: () => Promise<unknown> }) {
  const accept = useMutation({
    mutationFn: () => portalProjectsApi.accept(deliverable.id),
    onSuccess: async () => {
      await onDone();
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !accept.isPending && onClose()} modalType="alert">
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{`Accept "${deliverable.name}"?`}</DialogTitle>
          <DialogContent>
            {accept.error ? (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(accept.error)}</MessageBarBody>
              </MessageBar>
            ) : null}
            <Field label="Acceptance criteria">
              <Body1 style={{ whiteSpace: "pre-wrap" }}>{deliverable.acceptance_criteria || "No acceptance criteria were recorded."}</Body1>
            </Field>
            <Body1>By accepting, you confirm the deliverable meets these criteria. This is recorded against your name.</Body1>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={accept.isPending}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={accept.isPending} onClick={() => accept.mutate()}>
              Accept deliverable
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function RejectDialog({ deliverable, onClose, onDone }: { deliverable: PortalProjectDeliverable; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const invalid = rejectionError(reason);
  const reject = useMutation({
    mutationFn: () => portalProjectsApi.reject(deliverable.id, reason.trim()),
    onSuccess: async () => {
      await onDone();
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !reject.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{`Reject "${deliverable.name}"`}</DialogTitle>
          <DialogContent>
            {reject.error ? (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(reject.error)}</MessageBarBody>
              </MessageBar>
            ) : null}
            <Field
              label="Reason"
              required
              validationState={touched && invalid ? "error" : "none"}
              validationMessage={touched ? (invalid ?? undefined) : undefined}
            >
              <Textarea
                value={reason}
                onChange={(_, d) => {
                  setReason(d.value);
                  setTouched(true);
                }}
              />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={reject.isPending}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={!!invalid || reject.isPending} onClick={() => reject.mutate()}>
              Reject deliverable
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
