"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Subtitle2,
  type TableColumnDefinition,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime } from "@/features/admin/ui";
import { isApiError } from "@/lib/api/errors";
import { platformRequest } from "@/lib/api/platform-client";

const P = "/api/v1/platform/developers";
const enc = encodeURIComponent;

type VerificationOut = {
  id: string | null;
  partner_org_id: string;
  org_name: string | null;
  status: string;
  payload: Record<string, unknown>;
  message: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  org_verification_status: string | null;
  verification_expires_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Under review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Not approved",
};

const verificationApi = {
  queue: (signal?: AbortSignal) => platformRequest<VerificationOut[]>(`${P}/verification-requests?status=pending`, { signal }),
  detail: (id: string, signal?: AbortSignal) => platformRequest<VerificationOut>(`${P}/verification-requests/${enc(id)}`, { signal }),
  decide: (id: string, decision: "approve" | "request_changes" | "reject", message: string) =>
    platformRequest<VerificationOut>(`${P}/verification-requests/${enc(id)}/decide`, { method: "POST", body: { decision, message } }),
};

const keys = { queue: ["platform", "dev-verification", "queue"] as const, detail: (id: string) => ["platform", "dev-verification", id] as const };

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  grid: { display: "grid", gridTemplateColumns: "auto 1fr", gap: tokens.spacingHorizontalM, rowGap: tokens.spacingVerticalXS },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

/** `/platform/developers`: the Verified Partner review queue and decision actions (reviewer role, ★). */
export function VerificationReview() {
  const styles = useStyles();
  const [selected, setSelected] = useState<string | null>(null);
  const q = useQuery({ queryKey: keys.queue, queryFn: ({ signal }) => verificationApi.queue(signal) });

  const columns: TableColumnDefinition<VerificationOut>[] = [
    createTableColumn({ columnId: "org", renderHeaderCell: () => "Organisation", renderCell: (v) => v.org_name ?? v.partner_org_id.slice(0, 8) }),
    createTableColumn({ columnId: "country", renderHeaderCell: () => "Country", renderCell: (v) => String(v.payload.country ?? "—") }),
    createTableColumn({ columnId: "tax", renderHeaderCell: () => "Tax ID", renderCell: (v) => String(v.payload.tax_id ?? "—") }),
    createTableColumn({ columnId: "submitted", renderHeaderCell: () => "Submitted", renderCell: (v) => (v.submitted_at ? formatDateTime(v.submitted_at) : "—") }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (v) => <Badge appearance="tint">{STATUS_LABELS[v.status] ?? v.status}</Badge> }),
  ];

  return (
    <div className={styles.root}>
      <PageHeader title="Developer verification" subtitle="Verified Partner applications waiting for a reviewer." />
      <AdminGrid
        items={q.data}
        columns={columns}
        getRowId={(v) => v.id ?? v.partner_org_id}
        loading={q.isPending}
        error={q.error}
        emptyText="Nothing is waiting for verification."
        label="Verification queue"
        onRowClick={(v) => v.id && setSelected(v.id)}
      />
      {selected ? <VerificationDetail id={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function VerificationDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: keys.detail(id), queryFn: ({ signal }) => verificationApi.detail(id, signal) });
  const [action, setAction] = useState<"approve" | "request_changes" | "reject" | null>(null);
  const v = q.data;
  const payload = (v?.payload ?? {}) as Record<string, unknown>;

  return (
    <>
    <Dialog open onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{v?.org_name ?? "Verification request"}</DialogTitle>
          <DialogContent>
            {v ? (
              <div className={styles.grid}>
                <Caption1>Legal name</Caption1>
                <Body1>{String(payload.legal_name ?? "—")}</Body1>
                <Caption1>Country</Caption1>
                <Body1>{String(payload.country ?? "—")}</Body1>
                <Caption1>Tax ID</Caption1>
                <Body1>{`${String(payload.tax_id_kind ?? "")} ${String(payload.tax_id ?? "")}`.trim() || "—"}</Body1>
                <Caption1>Website</Caption1>
                <Body1>{String(payload.website ?? "—")}</Body1>
                <Caption1>Registered address</Caption1>
                <Body1>{String(payload.registered_address ?? "—")}</Body1>
                <Caption1>Support</Caption1>
                <Body1>
                  {String(payload.support_email ?? "—")} {payload.support_phone ? `· ${String(payload.support_phone)}` : ""}
                </Body1>
              </div>
            ) : (
              <Caption1>Loading…</Caption1>
            )}
            <Subtitle2 as="h3">Evidence</Subtitle2>
            <Caption1>{Array.isArray(payload.evidence_file_ids) && payload.evidence_file_ids.length ? `${payload.evidence_file_ids.length} file(s) attached` : "No evidence files."}</Caption1>
            <div className={styles.row}>
              <Button appearance="primary" onClick={() => setAction("approve")}>
                Approve
              </Button>
              <Button onClick={() => setAction("request_changes")}>Request changes</Button>
              <Button onClick={() => setAction("reject")}>Not approve</Button>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
      {action && v ? (
        <DecisionDialog
          request={v}
          action={action}
          onClose={() => setAction(null)}
          onDone={() => {
            void qc.invalidateQueries({ queryKey: keys.queue });
            setAction(null);
            onClose();
          }}
        />
      ) : null}
    </>
  );
}

const ACTION_TITLE = {
  approve: "Verify {org} as a Verified Partner?",
  request_changes: "Request changes from {org}",
  reject: "Do not approve {org}",
} as const;

function DecisionDialog({
  request,
  action,
  onClose,
  onDone,
}: {
  request: VerificationOut;
  action: "approve" | "request_changes" | "reject";
  onClose: () => void;
  onDone: () => void;
}) {
  const [message, setMessage] = useState("");
  const m = useMutation({
    mutationFn: () => verificationApi.decide(request.id!, action, message.trim()),
    onSuccess: onDone,
  });
  const needsMessage = action !== "approve";
  const roleError = isApiError(m.error) && m.error.code === "platform_role_required";
  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{ACTION_TITLE[action].replace("{org}", request.org_name ?? "this organisation")}</DialogTitle>
          <DialogContent>
            <Field label="Message to the partner" required={needsMessage}>
              <Textarea maxLength={2000} value={message} onChange={(_, d) => setMessage(d.value)} />
            </Field>
            {roleError ? (
              <MessageBar intent="warning">
                <MessageBarBody>You need the Marketplace Reviewer role to decide.</MessageBarBody>
              </MessageBar>
            ) : m.error ? (
              <MessageBar intent="error">
                <MessageBarBody>{isApiError(m.error) ? m.error.message : "Could not record the decision."}</MessageBarBody>
              </MessageBar>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={(needsMessage && !message.trim()) || m.isPending} onClick={() => m.mutate()}>
              {action === "approve" ? "Approve" : action === "reject" ? "Not approve" : "Request changes"}
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
