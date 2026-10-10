"use client";

import {
  Badge,
  Body1,
  Button,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  makeStyles,
  Option,
  Radio,
  RadioGroup,
  Textarea,
  tokens,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { complianceApi, complianceKeys, type CredentialFilters } from "./api";
import { credentialBadge, formatDate, looksLikeFullAadhaar, maskedNumber } from "./logic";
import type { Credential } from "./types";

const useStyles = makeStyles({
  filters: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  badges: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  actions: { display: "flex", gap: tokens.spacingHorizontalXS },
  preview: { maxWidth: "100%", maxHeight: "360px", border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
});

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending_verification", label: "Pending verification" },
  { value: "redaction_review", label: "Redaction review" },
  { value: "valid", label: "Valid" },
  { value: "expiring_soon", label: "Expiring soon" },
  { value: "expired", label: "Expired" },
  { value: "rejected", label: "Rejected" },
];

function VerifyDialog({ c, onClose }: { c: Credential; onClose: () => void }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<"valid" | "rejected">("valid");
  const [note, setNote] = useState("");
  const noteError = looksLikeFullAadhaar(note) ? "Do not enter an Aadhaar number." : null;
  const m = useMutation({
    mutationFn: () => complianceApi.verify(c.id, decision, note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["compliance"] });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            Verify {c.type_label} · {c.candidate_name}
          </DialogTitle>
          <DialogContent>
            <Body1>
              Number {maskedNumber(c.number_last4)} · expires {formatDate(c.expires_on)}
            </Body1>
            {c.document_id && (
              <Body1>
                <a href={complianceApi.documentHref(c.id)} target="_blank" rel="noreferrer">
                  Open the document
                </a>
              </Body1>
            )}
            <Field label="Decision">
              <RadioGroup value={decision} onChange={(_, d) => setDecision(d.value as "valid" | "rejected")}>
                <Radio value="valid" label="Valid — the details match the document" />
                <Radio value="rejected" label="Reject" />
              </RadioGroup>
            </Field>
            <Field label="Note" validationMessage={noteError ?? undefined}>
              <Textarea value={note} onChange={(_, d) => setNote(d.value)} />
            </Field>
            {m.isError && <ErrorBar message={errorMessage(m.error)} />}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={m.isPending || Boolean(noteError)} onClick={() => m.mutate()}>
              Save decision
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Redaction review (NFR-24): the image is shown only to `identity:view` holders; reject deletes it at once. */
function RedactionDialog({ c, onClose }: { c: Credential; onClose: () => void }) {
  const s = useStyles();
  const qc = useQueryClient();
  const canSee = usePermission("identity:view");
  const [decision, setDecision] = useState<"confirmed" | "rejected" | "">("");
  const m = useMutation({
    mutationFn: () => complianceApi.redaction(c.id, decision as "confirmed" | "rejected"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["compliance"] });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Review Aadhaar redaction · {c.candidate_name}</DialogTitle>
          <DialogContent>
            {canSee ? (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated, no-store API image
              <img className={s.preview} src={complianceApi.documentHref(c.id)} alt="Redacted Aadhaar card" />
            ) : (
              <Body1>You need the “View identity data” permission to see the image.</Body1>
            )}
            <Field label="Are the first 8 digits hidden?" required>
              <RadioGroup value={decision} onChange={(_, d) => setDecision(d.value as "confirmed" | "rejected")}>
                <Radio value="confirmed" label="Yes — the first 8 digits are not visible" disabled={!canSee} />
                <Radio value="rejected" label="No — delete the image and ask the worker to upload again" />
              </RadioGroup>
            </Field>
            {m.isError && <ErrorBar message={errorMessage(m.error)} />}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={!decision || m.isPending} onClick={() => m.mutate()}>
              Save review
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** `/compliance/credentials`: every credential with verification / expiry badges, verify and redaction review. */
export function CredentialsView() {
  const s = useStyles();
  const canRead = usePermission("compliance:read");
  const canVerify = usePermission("credential:verify");
  const [filters, setFilters] = useState<CredentialFilters>({});
  const [verifying, setVerifying] = useState<Credential | null>(null);
  const [reviewing, setReviewing] = useState<Credential | null>(null);
  const q = useQuery({
    queryKey: complianceKeys.credentials(filters),
    queryFn: ({ signal }) => complianceApi.credentials(filters, signal),
    enabled: canRead,
  });
  const types = useQuery({ queryKey: complianceKeys.types, queryFn: ({ signal }) => complianceApi.types(false, signal), enabled: canRead });
  if (!canRead) return <NoAccess what="credentials" />;

  const columns: TableColumnDefinition<Credential>[] = [
    createTableColumn({ columnId: "type", renderHeaderCell: () => "Type", renderCell: (c) => `${c.type_label ?? c.type_key} (v${c.version_no})` }),
    createTableColumn({
      columnId: "worker",
      renderHeaderCell: () => "Worker",
      renderCell: (c) => <NextLink href={`/workers/${c.candidate_id}`}>{c.candidate_name ?? "Worker"}</NextLink>,
    }),
    createTableColumn({ columnId: "number", renderHeaderCell: () => "Number", renderCell: (c) => maskedNumber(c.number_last4) }),
    createTableColumn({ columnId: "expires", renderHeaderCell: () => "Expires", renderCell: (c) => formatDate(c.expires_on) }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (c) => {
        const b = credentialBadge(c.status);
        return (
          <span className={s.badges}>
            <Badge appearance="tint" color={b.color}>
              {b.label}
            </Badge>
            {c.redaction_status === "pending_review" && (
              <Badge appearance="outline" color="warning">
                Redaction review
              </Badge>
            )}
            {c.redaction_status === "rejected" && (
              <Badge appearance="outline" color="danger">
                Re-upload requested
              </Badge>
            )}
          </span>
        );
      },
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (c) => (
        <span className={s.actions}>
          {canVerify && c.redaction_status === "pending_review" && (
            <Button size="small" onClick={() => setReviewing(c)}>
              Review redaction
            </Button>
          )}
          {canVerify && c.verification_status === "pending_verification" && c.redaction_status !== "pending_review" && (
            <Button size="small" appearance="primary" onClick={() => setVerifying(c)}>
              Verify
            </Button>
          )}
        </span>
      ),
    }),
  ];

  return (
    <>
      <PageHeader title="Credentials" subtitle="Passports, visas, licences and other worker credentials. Numbers show the last 4 digits only." />
      <div className={s.filters}>
        <Field label="Status">
          <Dropdown
            value={STATUS_OPTIONS.find((o) => o.value === (filters.status ?? ""))?.label}
            onOptionSelect={(_, d) => setFilters((f) => ({ ...f, status: d.optionValue || undefined }))}
          >
            {STATUS_OPTIONS.map((o) => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Type">
          <Dropdown
            value={types.data?.find((t) => t.key === filters.type)?.label ?? "All"}
            onOptionSelect={(_, d) => setFilters((f) => ({ ...f, type: d.optionValue || undefined }))}
          >
            <Option value="">All</Option>
            {(types.data ?? []).map((t) => (
              <Option key={t.key} value={t.key}>
                {t.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Expiring within">
          <Dropdown
            value={filters.expiring_within ? `${filters.expiring_within} days` : "Any time"}
            onOptionSelect={(_, d) => setFilters((f) => ({ ...f, expiring_within: d.optionValue ? Number(d.optionValue) : undefined }))}
          >
            <Option value="">Any time</Option>
            <Option value="30">30 days</Option>
            <Option value="60">60 days</Option>
          </Dropdown>
        </Field>
      </div>
      {q.isError && <ErrorBar message={errorMessage(q.error)} />}
      {q.isPending ? (
        <GridSkeleton />
      ) : (q.data ?? []).length === 0 ? (
        <Body1>No credentials match.</Body1>
      ) : (
        <DataGrid items={q.data ?? []} columns={columns} getRowId={(c) => c.id}>
          <DataGridHeader>
            <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
          </DataGridHeader>
          <DataGridBody<Credential>>
            {({ item, rowId }) => <DataGridRow<Credential> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>}
          </DataGridBody>
        </DataGrid>
      )}
      {verifying && <VerifyDialog c={verifying} onClose={() => setVerifying(null)} />}
      {reviewing && <RedactionDialog c={reviewing} onClose={() => setReviewing(null)} />}
    </>
  );
}
