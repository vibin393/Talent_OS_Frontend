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
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Switch,
  type TableColumnDefinition,
  Text,
} from "@fluentui/react-components";
import { Send20Regular, Warning16Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { PagingBar, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { campusApi } from "../api";
import { localToIso } from "../logic";
import type { DriveOut, InviteOut, RegistrationOut, RegistrationStatus } from "../types";
import { RegistrationStatusBadge, useCampusStyles } from "../ui";
import { useCampusPermissions, useInvalidateDrive, useRegistrations } from "../use-campus";

const PAGE = 50;
const STATUSES: RegistrationStatus[] = ["eligible", "assessed", "shortlisted", "interviewed", "offered", "joined"];

export function AssessmentsTab({ drive }: { drive: DriveOut }) {
  const admin = useAdminStyles();
  const c = useCampusStyles();
  const { canManage, canInvite } = useCampusPermissions();
  const [flagged, setFlagged] = useState(false);
  const [page, setPage] = useState(1);
  const [inviting, setInviting] = useState(false);
  const list = useRegistrations(drive.id, { status: STATUSES, flagged: flagged ? true : null }, PAGE, (page - 1) * PAGE);

  const columns: TableColumnDefinition<RegistrationOut>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Student", renderCell: (r) => r.candidate_name ?? "—" }),
    createTableColumn({ columnId: "institution", renderHeaderCell: () => "Institution", renderCell: (r) => r.institution_name ?? "—" }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (r) => <RegistrationStatusBadge status={r.status} /> }),
    createTableColumn({
      columnId: "assessment",
      renderHeaderCell: () => "Assessment",
      renderCell: (r) => (r.assessment_invitation_id ? (r.assessment_status ?? "Invited") : <span className={c.muted}>Not invited</span>),
    }),
    createTableColumn({
      columnId: "score",
      compare: (a, b) => Number(a.score ?? -1) - Number(b.score ?? -1),
      renderHeaderCell: () => "Score",
      renderCell: (r) => <Text className={c.num}>{r.score ?? "—"}</Text>,
    }),
    createTableColumn({
      columnId: "flag",
      renderHeaderCell: () => "Integrity",
      renderCell: (r) =>
        r.assessment_flag ? (
          <Badge appearance="tint" color="warning" icon={<Warning16Regular />}>
            {r.assessment_flag}
          </Badge>
        ) : (
          "—"
        ),
    }),
  ];

  return (
    <div className={c.stack}>
      {!drive.assessment_id && (
        <MessageBar intent="warning">
          <MessageBarBody>Choose an assessment in the drive set-up before inviting students.</MessageBarBody>
        </MessageBar>
      )}
      <div className={admin.toolbar}>
        <Switch label="Flagged attempts only" checked={flagged} onChange={(_, d) => {
            setFlagged(d.checked);
            setPage(1);
          }} />
        <span className={admin.grow} />
        {canManage && canInvite && (
          <Button appearance="primary" icon={<Send20Regular />} disabled={!drive.assessment_id} onClick={() => setInviting(true)}>
            Invite eligible students
          </Button>
        )}
      </div>
      <AdminGrid
        items={list.data?.items}
        columns={columns}
        getRowId={(r) => r.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No eligible students yet."
        label="Assessment results"
        sortable
        footer={list.data && <PagingBar page={page} pageSize={PAGE} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />}
      />
      {inviting && <InviteDialog drive={drive} onClose={() => setInviting(false)} />}
    </div>
  );
}

function InviteDialog({ drive, onClose }: { drive: DriveOut; onClose: () => void }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const invalidate = useInvalidateDrive(drive.id);
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteOut | null>(null);
  const eligible = drive.status_counts.eligible ?? 0;

  const submit = async () => {
    const iso = localToIso(deadline);
    if (!iso || Date.parse(iso) <= Date.now()) {
      setError("Choose a deadline in the future.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = await campusApi.invite(drive.id, { registration_ids: null, deadline_at: iso });
      setResult(out);
      await invalidate();
      toast.success(`${out.invited} invitations sent`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Invite eligible students</DialogTitle>
          <DialogContent className={c.stack}>
            {result ? (
              <div role="status" className={c.stack}>
                <Body1>
                  {result.invited} invited in {result.batches} batch{result.batches === 1 ? "" : "es"}; {result.skipped} skipped (already
                  invited).
                </Body1>
                {result.errors.length > 0 && (
                  <Caption1 className={c.danger}>
                    {result.errors.length} could not be invited: {result.errors.slice(0, 5).map((e) => e.message ?? e.code).join("; ")}
                  </Caption1>
                )}
              </div>
            ) : (
              <>
                <Body1>
                  Every Eligible student without an invitation ({eligible.toLocaleString()} now) receives the drive&apos;s assessment.
                  Running this again never invites anyone twice.
                </Body1>
                <Field label="Deadline" required>
                  <Input type="datetime-local" value={deadline} onChange={(_, d) => setDeadline(d.value)} />
                </Field>
                {error && (
                  <MessageBar intent="error" role="alert">
                    <MessageBarBody>{error}</MessageBarBody>
                  </MessageBar>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onClose}>
              {result ? "Close" : "Cancel"}
            </Button>
            {!result && (
              <Button appearance="primary" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={() => void submit()}>
                Send invitations
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
