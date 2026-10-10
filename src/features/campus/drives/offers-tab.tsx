"use client";

import {
  Body1,
  Button,
  Checkbox,
  createTableColumn,
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
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  type TableColumnDefinition,
  Text,
  Textarea,
} from "@fluentui/react-components";
import { DocumentSignature20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { campusApi, campusKeys } from "../api";
import { formatDate } from "../logic";
import type { BulkOffersOut, DriveOut, JoiningRow, OfferOverrides } from "../types";
import { RegistrationStatusBadge, useCampusStyles } from "../ui";
import { useCampusPermissions, useInvalidateDrive, useJoining } from "../use-campus";

/** Offers: bulk create (each offer keeps its own approval and release), joining tracking, renege. */
export function OffersTab({ drive }: { drive: DriveOut }) {
  const admin = useAdminStyles();
  const c = useCampusStyles();
  const { canManage, canOffer } = useCampusPermissions();
  const joining = useJoining(drive.id);
  const [creating, setCreating] = useState(false);
  const [reneging, setReneging] = useState<JoiningRow | null>(null);

  const columns: TableColumnDefinition<JoiningRow>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Student", renderCell: (r) => r.candidate_name ?? "—" }),
    createTableColumn({ columnId: "institution", renderHeaderCell: () => "Institution", renderCell: (r) => r.institution_name ?? "—" }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (r) => <RegistrationStatusBadge status={r.status} /> }),
    createTableColumn({
      columnId: "offer",
      renderHeaderCell: () => "Offer",
      renderCell: (r) => (r.offer_id ? (r.offer_status ?? "Open") : "—"),
    }),
    createTableColumn({ columnId: "joining", renderHeaderCell: () => "Planned joining", renderCell: (r) => formatDate(r.planned_joining_date) }),
    createTableColumn({ columnId: "accepted", renderHeaderCell: () => "Accepted", renderCell: (r) => formatDate(r.accepted_at) }),
    createTableColumn({ columnId: "joined", renderHeaderCell: () => "Joined", renderCell: (r) => formatDate(r.joined_at) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => <span aria-label="Actions" />,
      renderCell: (r) => (
        <RowActions
          label={r.candidate_name ?? "student"}
          actions={canManage && r.status === "offered" && !r.joined_at ? [{ label: "Mark reneged", onClick: () => setReneging(r) }] : []}
        />
      ),
    }),
  ];

  return (
    <div className={c.stack}>
      <div className={admin.toolbar}>
        <Body1 className={admin.grow}>Each offer goes through its own approval and release, exactly like a single offer.</Body1>
        {canOffer && (
          <Button appearance="primary" icon={<DocumentSignature20Regular />} onClick={() => setCreating(true)}>
            Create offers
          </Button>
        )}
      </div>
      <AdminGrid
        items={joining.data}
        columns={columns}
        getRowId={(r) => r.registration_id}
        loading={joining.isPending}
        error={joining.error}
        emptyText="No offers yet."
        label="Offers and joining"
      />
      {creating && <BulkOffersDialog drive={drive} onClose={() => setCreating(false)} />}
      {reneging && <RenegeDialog drive={drive} row={reneging} onClose={() => setReneging(null)} />}
    </div>
  );
}

function BulkOffersDialog({ drive, onClose }: { drive: DriveOut; onClose: () => void }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const invalidate = useInvalidateDrive(drive.id);
  const candidates = useQuery({
    queryKey: [...campusKeys.registrationsRoot(drive.id), "offer-candidates"],
    queryFn: ({ signal }) => campusApi.registrations(drive.id, { status: ["interviewed"] }, 500, 0, signal),
  });
  const items = (candidates.data?.items ?? []).filter((r) => !r.offer_id);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const chosen = selected ?? new Set(items.map((r) => r.id));
  const [joiningDate, setJoiningDate] = useState("");
  const [payRate, setPayRate] = useState("");
  const [unit, setUnit] = useState<NonNullable<OfferOverrides["pay_rate_unit"]>>("year");
  const [location, setLocation] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkOffersOut | null>(null);
  const names = new Map(items.map((r) => [r.id, r.candidate_name ?? "Student"]));

  const toggle = (id: string, on: boolean) => {
    const next = new Set(chosen);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };
  const submit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(joiningDate)) return setError("Choose the planned joining date.");
    if (chosen.size === 0) return setError("Select at least one student.");
    if (payRate.trim() && !/^\d+(\.\d{1,2})?$/.test(payRate.trim())) return setError("Pay rate is a number with up to 2 decimals.");
    const overrides: OfferOverrides = {};
    if (payRate.trim()) {
      overrides.pay_rate = payRate.trim();
      overrides.pay_rate_unit = unit;
    }
    if (location.trim()) overrides.location = location.trim();
    if (expiry) overrides.expiry_date = expiry;
    setBusy(true);
    setError(null);
    try {
      const out = await campusApi.bulkOffers(drive.id, {
        registration_ids: [...chosen],
        planned_joining_date: joiningDate,
        overrides: Object.keys(overrides).length ? overrides : null,
      });
      setResult(out);
      await invalidate();
      toast.success(`${out.created} offers created`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface style={{ maxWidth: 720 }}>
        <DialogBody>
          <DialogTitle>Create offers</DialogTitle>
          <DialogContent className={c.stack}>
            {result ? (
              <div role="status" className={c.stack}>
                <Text>
                  {result.created} created, {result.failed} failed.
                </Text>
                <div className={c.tableWrap}>
                  <Table aria-label="Offer results" size="small">
                    <TableHeader>
                      <TableRow>
                        <TableHeaderCell>Student</TableHeaderCell>
                        <TableHeaderCell>Result</TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.results.map((r) => (
                        <TableRow key={r.registration_id}>
                          <TableCell>{names.get(r.registration_id) ?? r.registration_id.slice(0, 8)}</TableCell>
                          <TableCell className={r.error_code ? c.danger : undefined}>
                            {r.error_code ? (r.message ?? r.error_code) : (r.offer_status ?? "Created")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <>
                {!drive.offer_template_id && (
                  <MessageBar intent="warning">
                    <MessageBarBody>The drive has no offer template; offers use your default template.</MessageBarBody>
                  </MessageBar>
                )}
                <div className={c.grid2}>
                  <Field label="Planned joining date" required>
                    <Input type="date" value={joiningDate} onChange={(_, d) => setJoiningDate(d.value)} />
                  </Field>
                  <Field label="Offer expires (optional)">
                    <Input type="date" value={expiry} onChange={(_, d) => setExpiry(d.value)} />
                  </Field>
                  <Field label="Pay rate (optional)">
                    <Input inputMode="decimal" value={payRate} onChange={(_, d) => setPayRate(d.value)} />
                  </Field>
                  <Field label="Per">
                    <Dropdown value={unit} selectedOptions={[unit]} onOptionSelect={(_, d) => setUnit(d.optionValue as typeof unit)}>
                      {(["year", "month", "day", "hour"] as const).map((u) => (
                        <Option key={u} value={u}>
                          {u}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                  <Field label="Location (optional)">
                    <Input value={location} maxLength={200} onChange={(_, d) => setLocation(d.value)} />
                  </Field>
                </div>
                {candidates.isPending ? (
                  <Spinner size="small" label="Loading interviewed students…" />
                ) : items.length === 0 ? (
                  <Body1>No interviewed students without an offer.</Body1>
                ) : (
                  <fieldset className={c.stack} style={{ border: 0, padding: 0, margin: 0, maxHeight: 280, overflowY: "auto" }}>
                    <legend>
                      <Text weight="semibold">
                        Students ({chosen.size} of {items.length} selected)
                      </Text>
                    </legend>
                    {items.map((r) => (
                      <Checkbox
                        key={r.id}
                        label={`${r.candidate_name ?? "Student"}${r.institution_name ? ` · ${r.institution_name}` : ""}`}
                        checked={chosen.has(r.id)}
                        onChange={(_, d) => toggle(r.id, Boolean(d.checked))}
                      />
                    ))}
                  </fieldset>
                )}
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
              <Button appearance="primary" disabled={busy || chosen.size === 0} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={() => void submit()}>
                Create {chosen.size} offers
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function RenegeDialog({ drive, row, onClose }: { drive: DriveOut; row: JoiningRow; onClose: () => void }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const invalidate = useInvalidateDrive(drive.id);
  const reasons = useQuery({ queryKey: campusKeys.withdrawalReasons, queryFn: ({ signal }) => campusApi.withdrawalReasons(signal), staleTime: Infinity });
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = [reason, note.trim()].filter(Boolean).join(": ");
  const submit = async () => {
    if (text.length < 2) return setError("Choose a reason or write a note.");
    setBusy(true);
    setError(null);
    try {
      await campusApi.renege(row.registration_id, text.slice(0, 900));
      await invalidate();
      toast.success("Marked as reneged");
      onClose();
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
          <DialogTitle>Mark {row.candidate_name ?? "student"} as reneged</DialogTitle>
          <DialogContent className={c.stack}>
            <Body1>The student accepted but will not join. This records a dropout and closes the registration.</Body1>
            <Field label="Reason">
              <Dropdown placeholder="Choose a reason" value={reason} selectedOptions={[reason]} onOptionSelect={(_, d) => setReason(d.optionValue ?? "")}>
                {(reasons.data ?? []).map((r) => (
                  <Option key={r} value={r}>
                    {r}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Note">
              <Textarea value={note} maxLength={800} resize="vertical" onChange={(_, d) => setNote(d.value)} />
            </Field>
            {error && (
              <MessageBar intent="error" role="alert">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={() => void submit()}>
              Mark reneged
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
