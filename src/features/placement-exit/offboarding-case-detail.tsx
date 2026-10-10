"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle2,
  Switch,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  Textarea,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { ArrowSync20Regular, BotSparkle16Regular, Open16Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { formatDate, formatMoney } from "@/features/placements/format";
import { exitApi, exitKeys } from "./api";
import { ReasonDialog, SecureLinkDialog, SimpleDialog, useExtensionMutation } from "./extension-dialogs";
import {
  CASE_REASON_LABELS,
  CASE_STATUS_COLORS,
  CASE_STATUS_LABELS,
  canCancelCase,
  canCloseCase,
  exitErrorMessage,
  groupByOwner,
  humanize,
  isCaseOpen,
  isDocumentItem,
  ITEM_STATUS_COLORS,
  ITEM_STATUS_LABELS,
  itemLink,
  pendingMandatory,
} from "./logic";
import type { OffboardingCaseDetail, OffboardingItemOut, SettlementLine } from "./types";

const useStyles = makeStyles({
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalM },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, marginTop: tokens.spacingVerticalM },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  rowActions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS, alignItems: "center" },
  label: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  muted: { color: tokens.colorNeutralForeground3 },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "560px" },
});

function detailsText(d: Record<string, unknown> | null): string {
  if (!d) return "";
  return Object.entries(d)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .map(([k, v]) => `${humanize(k)}: ${String(v)}`)
    .join(" · ");
}

function CompleteItemDialog({ item, onClose }: { item: OffboardingItemOut; onClose: () => void }) {
  const [note, setNote] = useState("");
  const { m, error } = useExtensionMutation(
    () => exitApi.completeItem(item.id, { note: note.trim() || null }),
    `${item.label} completed`,
    onClose,
  );
  return (
    <SimpleDialog title={`Complete: ${item.label}`} primary="Mark done" busy={m.isPending} error={error} onPrimary={() => m.mutate(undefined)} onClose={onClose}>
      <Field label="Note">
        <Textarea value={note} onChange={(_, d) => setNote(d.value)} resize="vertical" />
      </Field>
    </SimpleDialog>
  );
}

function Checklist({ kase, canWrite, canClose }: { kase: OffboardingCaseDetail; canWrite: boolean; canClose: boolean }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const [dialog, setDialog] = useState<{ kind: "complete" | "waive"; item: OffboardingItemOut } | null>(null);
  const open = isCaseOpen(kase.status);
  const columns: TableColumnDefinition<OffboardingItemOut>[] = [
    createTableColumn({
      columnId: "item",
      renderHeaderCell: () => "Item",
      renderCell: (i) => (
        <div className={admin.cellStack}>
          <span className={styles.label}>
            {i.label}
            {i.mandatory && (
              <Badge size="small" appearance="outline">
                Mandatory
              </Badge>
            )}
          </span>
          {i.owner_name && (
            <Text size={200} className={admin.muted}>
              {i.owner_name}
            </Text>
          )}
          {i.waived_reason && (
            <Text size={200} className={admin.muted}>
              Waived: {i.waived_reason}
            </Text>
          )}
        </div>
      ),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (i) => (
        <span className={styles.label}>
          <Badge appearance="tint" color={ITEM_STATUS_COLORS[i.status]}>
            {ITEM_STATUS_LABELS[i.status]}
          </Badge>
          {i.auto_verified && (
            <Tooltip content={detailsText(i.verifier_details) || "Verified automatically"} relationship="description">
              <BotSparkle16Regular aria-label="Auto-verified" />
            </Tooltip>
          )}
        </span>
      ),
    }),
    createTableColumn({ columnId: "due", renderHeaderCell: () => "Due", renderCell: (i) => formatDate(i.due_date) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (i) => {
        const link = itemLink(i.kind, kase.placement_id);
        return (
          <div className={styles.rowActions}>
            {link && (
              <NextLink href={link.href}>
                {link.label} <Open16Regular aria-hidden />
              </NextLink>
            )}
            {isDocumentItem(i.kind) && i.status === "pending" && (
              <NextLink href={`/placements/${kase.placement_id}?generate=${i.kind}`}>Generate document</NextLink>
            )}
            {open && canWrite && i.status === "pending" && !i.verifier && (
              <Button size="small" onClick={() => setDialog({ kind: "complete", item: i })}>
                Complete
              </Button>
            )}
            {open && i.status === "pending" && (i.mandatory ? canClose : canWrite) && (
              <Button size="small" appearance="subtle" onClick={() => setDialog({ kind: "waive", item: i })}>
                Waive
              </Button>
            )}
          </div>
        );
      },
    }),
  ];
  return (
    <div className={styles.stack}>
      {groupByOwner(kase.items).map((g) => (
        <div key={g.role}>
          <Subtitle2 as="h2">{g.label}</Subtitle2>
          <div className={admin.surface}>
            <DataGrid items={g.items} columns={columns} getRowId={(i: OffboardingItemOut) => i.id} className={admin.grid}>
              <DataGridHeader>
                <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
              </DataGridHeader>
              <DataGridBody<OffboardingItemOut>>
                {({ item, rowId }) => (
                  <DataGridRow<OffboardingItemOut> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          </div>
        </div>
      ))}
      {dialog?.kind === "complete" && <CompleteItemDialog item={dialog.item} onClose={() => setDialog(null)} />}
      {dialog?.kind === "waive" && (
        <ReasonDialog
          title={`Waive: ${dialog.item.label}`}
          primary="Waive"
          success="Item waived"
          run={(r) => exitApi.waiveItem(dialog.item.id, r)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

/** Final settlement: final timesheet, expenses, payroll, invoice lines plus the conversion fee. */
export function SettlementView({ kase }: { kase: OffboardingCaseDetail }) {
  const admin = useAdminStyles();
  const columns: TableColumnDefinition<SettlementLine>[] = [
    createTableColumn({ columnId: "label", renderHeaderCell: () => "Line", renderCell: (l) => l.label }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (l) => (
        <Badge appearance="tint" color={ITEM_STATUS_COLORS[l.status]}>
          {ITEM_STATUS_LABELS[l.status]}
          {l.auto_verified ? " · auto" : ""}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "details", renderHeaderCell: () => "Details", renderCell: (l) => detailsText(l.details) || "—" }),
    createTableColumn({
      columnId: "link",
      renderHeaderCell: () => "",
      renderCell: (l) => {
        const href = l.link ?? itemLink(l.kind, kase.placement_id)?.href;
        return href ? <NextLink href={href}>Open</NextLink> : null;
      },
    }),
  ];
  return (
    <div className={admin.form}>
      {kase.settlement.length === 0 ? (
        <Body1 className={admin.muted}>No settlement lines yet.</Body1>
      ) : (
        <div className={admin.surface}>
          <DataGrid items={kase.settlement} columns={columns} getRowId={(l: SettlementLine) => l.kind} className={admin.grid}>
            <DataGridHeader>
              <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
            </DataGridHeader>
            <DataGridBody<SettlementLine>>
              {({ item, rowId }) => (
                <DataGridRow<SettlementLine> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        </div>
      )}
      {kase.conversion && (
        <Card>
          <Subtitle2>Conversion fee</Subtitle2>
          <Body1>
            Converted on {formatDate(kase.conversion.conversion_date)} · proposed fee{" "}
            <strong>
              {kase.conversion.fee_proposal === null ? "none" : formatMoney(kase.conversion.fee_proposal, kase.conversion.currency)}
            </strong>{" "}
            (billed in the next invoice run)
          </Body1>
        </Card>
      )}
    </div>
  );
}

function FeedbackForm({ kase, canWrite }: { kase: OffboardingCaseDetail; canWrite: boolean }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const prev = kase.feedback?.answers ?? {};
  const [reason, setReason] = useState(typeof prev.reason_for_leaving === "string" ? prev.reason_for_leaving : "");
  const [rating, setRating] = useState(typeof prev.rating === "number" ? String(prev.rating) : "");
  const [rehire, setRehire] = useState(prev.would_rehire === true);
  const [comments, setComments] = useState(typeof prev.comments === "string" ? prev.comments : "");
  const m = useMutation({
    mutationFn: () =>
      exitApi.feedback(kase.id, {
        reason_for_leaving: reason.trim() || null,
        rating: rating ? Number(rating) : null,
        would_rehire: rehire,
        comments: comments.trim() || null,
      }),
    onSuccess: (data) => {
      qc.setQueryData(exitKeys.case(kase.id), data);
      toast.success("Feedback saved");
    },
    onError: (e) => toast.error(exitErrorMessage(e)),
  });
  const disabled = !canWrite || !isCaseOpen(kase.status);
  return (
    <div className={styles.form}>
      {kase.feedback && (
        <Caption1 className={styles.muted}>
          Recorded {formatDate(kase.feedback.created_at)} by {kase.feedback.recorded_by_kind}
        </Caption1>
      )}
      <Field label="Reason for leaving">
        <Textarea disabled={disabled} value={reason} onChange={(_, d) => setReason(d.value)} resize="vertical" />
      </Field>
      <Field label="Overall experience (1–5)">
        <Dropdown disabled={disabled} value={rating} selectedOptions={rating ? [rating] : []} onOptionSelect={(_, d) => setRating(d.optionValue ?? "")}>
          {["1", "2", "3", "4", "5"].map((n) => (
            <Option key={n} value={n}>
              {n}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Switch disabled={disabled} checked={rehire} onChange={(_, d) => setRehire(d.checked)} label="Eligible for rehire" />
      <Field label="Comments">
        <Textarea disabled={disabled} value={comments} onChange={(_, d) => setComments(d.value)} resize="vertical" />
      </Field>
      {!disabled && (
        <div>
          <Button appearance="primary" disabled={m.isPending} onClick={() => m.mutate()}>
            Save feedback
          </Button>
        </div>
      )}
    </div>
  );
}

/** `/offboarding/[id]`: case header, checklist by owner, feedback, final settlement, ★ Close and Cancel. */
export function OffboardingCaseDetailView({ id }: { id: string }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const canRead = usePermission("placement:read");
  const canWrite = usePermission("offboarding:write");
  const canClose = usePermission("offboarding:close");
  const [tab, setTab] = useState<"checklist" | "settlement" | "feedback">("checklist");
  const [dialog, setDialog] = useState<"close" | "cancel" | "link" | null>(null);
  const q = useQuery({ queryKey: exitKeys.case(id), queryFn: ({ signal }) => exitApi.case(id, signal), enabled: canRead });
  const refresh = useMutation({
    mutationFn: () => exitApi.refreshCase(id),
    onSuccess: (data) => {
      qc.setQueryData(exitKeys.case(id), data);
      toast.success("Checklist refreshed");
    },
    onError: (e) => toast.error(exitErrorMessage(e)),
  });
  const close = useExtensionMutation(() => exitApi.closeCase(id), "Case closed; placement ended", () => setDialog(null));
  if (!canRead) return <NoAccess what="offboarding cases" />;
  if (q.isPending) return <Spinner label="Loading case" />;
  if (q.isError) return <ErrorBar message={exitErrorMessage(q.error)} />;
  const k = q.data;
  const open = isCaseOpen(k.status);
  const pending = pendingMandatory(k.items);
  return (
    <>
      <PageHeader
        title={`${k.human_id} · ${k.candidate_name ?? "Worker"}`}
        subtitle={
          <span>
            <NextLink href={`/placements/${k.placement_id}`}>{k.placement_human_id ?? "Placement"}</NextLink> · {k.client_name ?? ""} ·{" "}
            {CASE_REASON_LABELS[k.reason]} · last working day {formatDate(k.last_working_day)}{" "}
            <Badge appearance="tint" color={CASE_STATUS_COLORS[k.status]}>
              {CASE_STATUS_LABELS[k.status]}
            </Badge>{" "}
            {k.early_attrition && (
              <Badge appearance="filled" color="danger">
                Early attrition
              </Badge>
            )}
          </span>
        }
      />
      {(k.notice_shortfall_days ?? 0) > 0 && (
        <MessageBar intent="warning">
          <MessageBarBody>
            Notice shortfall of {k.notice_shortfall_days} {k.notice_shortfall_days === 1 ? "day" : "days"}
            {k.notice_period_days_snapshot !== null ? ` against a ${k.notice_period_days_snapshot}-day notice period` : ""}
            {k.early_termination_by ? ` (initiated by the ${k.early_termination_by})` : ""}.
          </MessageBarBody>
        </MessageBar>
      )}
      {k.reason_note && <Body1>{k.reason_note}</Body1>}
      {k.cancel_reason && (
        <MessageBar intent="info">
          <MessageBarBody>Cancelled: {k.cancel_reason}</MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.actions}>
        {canClose && open && (
          <Tooltip
            content={canCloseCase(k.status) ? "Ends the placement" : `${pending.length} mandatory item(s) still pending`}
            relationship="description"
          >
            <Button appearance="primary" disabled={!canCloseCase(k.status)} onClick={() => setDialog("close")}>
              ★ Close case
            </Button>
          </Tooltip>
        )}
        {open && (
          <Button icon={<ArrowSync20Regular />} disabled={refresh.isPending} onClick={() => refresh.mutate()}>
            Refresh checks
          </Button>
        )}
        {canWrite && open && !k.client_confirmed_at && <Button onClick={() => setDialog("link")}>Client secure link</Button>}
        {canWrite && canCancelCase(k.status, k.last_working_day) && <Button onClick={() => setDialog("cancel")}>Cancel case</Button>}
      </div>
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as typeof tab)}>
        <Tab value="checklist">
          Checklist ({k.items_open} open)
        </Tab>
        <Tab value="settlement">Final settlement</Tab>
        <Tab value="feedback">Exit feedback</Tab>
      </TabList>
      {tab === "checklist" && <Checklist kase={k} canWrite={canWrite} canClose={canClose} />}
      {tab === "settlement" && (
        <div className={styles.stack}>
          <SettlementView kase={k} />
        </div>
      )}
      {tab === "feedback" && (
        <div className={styles.stack}>
          <FeedbackForm kase={k} canWrite={canWrite} />
        </div>
      )}
      {dialog === "close" && (
        <SimpleDialog
          title="Close offboarding case"
          primary="★ Close case"
          busy={close.m.isPending}
          error={close.error}
          onPrimary={() => close.m.mutate(undefined)}
          onClose={() => setDialog(null)}
        >
          <Body1>
            Closing re-runs the automatic checks, ends the placement and records the exit. This cannot be undone.
          </Body1>
        </SimpleDialog>
      )}
      {dialog === "cancel" && (
        <ReasonDialog
          title="Cancel offboarding"
          primary="Cancel case"
          success="Case cancelled"
          intro="The placement returns to Active with its previous end date."
          run={(r) => exitApi.cancelCase(id, r)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "link" && (
        <SecureLinkDialog title="Client confirmation link" issue={() => exitApi.caseLink(id)} onClose={() => setDialog(null)} />
      )}
    </>
  );
}
