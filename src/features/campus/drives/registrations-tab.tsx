"use client";

import { Badge, Caption1, createTableColumn, Dropdown, Option, SearchBox, type TableColumnDefinition, Text } from "@fluentui/react-components";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions, type RowAction } from "@/features/admin/admin-grid";
import { PagingBar, useAdminStyles } from "@/features/admin/ui";
import { useDebounced } from "@/lib/use-debounced";
import { campusApi } from "../api";
import { canOverride, eligibilityReason, REGISTRATION_STATUS_LABELS, REGISTRATION_STATUSES, SOURCE_LABELS } from "../logic";
import type { DriveOut, RegistrationOut, RegistrationStatus } from "../types";
import { HumanOnly, ReasonDialog, RegistrationStatusBadge, useCampusStyles } from "../ui";
import { useCampusPermissions, useInvalidateDrive, useRegistrations } from "../use-campus";

const PAGE = 50;

/** The eligibility column: status text plus the first failing rule (or the override reason). */
export function EligibilityCell({ registration }: { registration: Pick<RegistrationOut, "eligibility" | "overridden" | "override_reason" | "status"> }) {
  const c = useCampusStyles();
  const e = eligibilityReason(registration);
  return (
    <span style={{ display: "flex", flexDirection: "column" }}>
      <Badge appearance="tint" color={e.tone === "subtle" ? "subtle" : e.tone === "brand" ? "brand" : e.tone} size="small" style={{ alignSelf: "flex-start" }}>
        {e.text}
      </Badge>
      {e.detail && <Caption1 className={c.muted}>{e.detail}</Caption1>}
    </span>
  );
}

export function RegistrationsTab({ drive }: { drive: DriveOut }) {
  const admin = useAdminStyles();
  const c = useCampusStyles();
  const toast = useAppToast();
  const { canManage, canOverride: mayOverride } = useCampusPermissions();
  const invalidate = useInvalidateDrive(drive.id);
  const [statuses, setStatuses] = useState<RegistrationStatus[]>([]);
  const [institution, setInstitution] = useState<string>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q, 300);
  const filters = { status: statuses, institution_id: institution || null, q: dq.trim() || undefined };
  const list = useRegistrations(drive.id, filters, PAGE, (page - 1) * PAGE);
  const [overriding, setOverriding] = useState<RegistrationOut | null>(null);
  const [withdrawing, setWithdrawing] = useState<RegistrationOut | null>(null);

  const columns: TableColumnDefinition<RegistrationOut>[] = [
    createTableColumn({
      columnId: "candidate",
      renderHeaderCell: () => "Student",
      renderCell: (r) => (
        <span className={admin.cellStack}>
          <Text weight="semibold">{r.candidate_name ?? "—"}</Text>
          <Caption1 className={c.muted}>{r.candidate_email ?? ""}</Caption1>
        </span>
      ),
    }),
    createTableColumn({ columnId: "institution", renderHeaderCell: () => "Institution", renderCell: (r) => r.institution_name ?? "—" }),
    createTableColumn({
      columnId: "program",
      renderHeaderCell: () => "Program / branch",
      renderCell: (r) => [r.program, r.branch].filter(Boolean).join(" · ") || "—",
    }),
    createTableColumn({ columnId: "cgpa", renderHeaderCell: () => "CGPA", renderCell: (r) => <Text className={c.num}>{r.cgpa ?? "—"}</Text> }),
    createTableColumn({ columnId: "backlogs", renderHeaderCell: () => "Backlogs", renderCell: (r) => <Text className={c.num}>{r.backlogs ?? "—"}</Text> }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (r) => <RegistrationStatusBadge status={r.status} /> }),
    createTableColumn({ columnId: "eligibility", renderHeaderCell: () => "Eligibility", renderCell: (r) => <EligibilityCell registration={r} /> }),
    createTableColumn({ columnId: "source", renderHeaderCell: () => "Source", renderCell: (r) => SOURCE_LABELS[r.source] }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => <span aria-label="Actions" />,
      renderCell: (r) => {
        const actions: RowAction[] = [];
        if (mayOverride && canOverride(r)) actions.push({ label: "Override eligibility ★", onClick: () => setOverriding(r) });
        if (canManage && !["withdrawn", "joined", "reneged"].includes(r.status)) actions.push({ label: "Withdraw", onClick: () => setWithdrawing(r) });
        return <RowActions label={r.candidate_name ?? "registration"} actions={actions} />;
      },
    }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        <SearchBox className={admin.search} placeholder="Search name or email" aria-label="Search registrations" value={q} onChange={(_, d) => { setQ(d.value); setPage(1); }} />
        <Dropdown
          className={admin.filter}
          aria-label="Status"
          multiselect
          placeholder="All statuses"
          value={statuses.map((s) => REGISTRATION_STATUS_LABELS[s]).join(", ")}
          selectedOptions={statuses}
          onOptionSelect={(_, d) => {
            setStatuses(d.selectedOptions as RegistrationStatus[]);
            setPage(1);
          }}
        >
          {REGISTRATION_STATUSES.map((s) => (
            <Option key={s} value={s}>
              {REGISTRATION_STATUS_LABELS[s]}
            </Option>
          ))}
        </Dropdown>
        <Dropdown
          className={admin.filter}
          aria-label="Institution"
          value={drive.institutions.find((i) => i.institution_id === institution)?.institution_name ?? "All institutions"}
          selectedOptions={[institution]}
          onOptionSelect={(_, d) => {
            setInstitution(d.optionValue ?? "");
            setPage(1);
          }}
        >
          <Option value="">All institutions</Option>
          {drive.institutions.map((i) => (
            <Option key={i.institution_id} value={i.institution_id}>
              {i.institution_name}
            </Option>
          ))}
        </Dropdown>
      </div>
      <AdminGrid
        items={list.data?.items}
        columns={columns}
        getRowId={(r) => r.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No registrations match these filters."
        label="Registrations"
        footer={
          list.data && (
            <PagingBar page={page} pageSize={PAGE} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />
          )
        }
      />
      {overriding && (
        <ReasonDialog
          title={
            <>
              Override eligibility <HumanOnly />
            </>
          }
          intro={
            <Text>
              Mark <strong>{overriding.candidate_name ?? "this student"}</strong> Eligible although they fail
              {overriding.eligibility?.failing_rule ? ` “${overriding.eligibility.failing_rule.label}”` : " the rules"}. Only a
              person can do this; the reason is recorded in the audit log.
            </Text>
          }
          confirmLabel="Override"
          max={1000}
          onClose={() => setOverriding(null)}
          onSubmit={async (reason) => {
            await campusApi.overrideEligibility(overriding.id, reason);
            await invalidate();
            toast.success("Eligibility overridden");
          }}
        />
      )}
      {withdrawing && (
        <ReasonDialog
          title="Withdraw registration"
          intro={<Text>Withdraw {withdrawing.candidate_name ?? "this student"} from the drive. Their Candidate record is kept.</Text>}
          label="Note"
          min={0}
          max={1000}
          confirmLabel="Withdraw"
          onClose={() => setWithdrawing(null)}
          onSubmit={async (note) => {
            await campusApi.withdraw(withdrawing.id, note || null);
            await invalidate();
            toast.success("Registration withdrawn");
          }}
        />
      )}
    </>
  );
}
