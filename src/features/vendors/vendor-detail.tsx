"use client";

import {
  Badge,
  Button,
  Card,
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
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Subtitle2,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { ArrowUpload20Regular, ChevronDown20Regular, Eye20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { VendorUsersAdminPanel } from "@/features/vendor-access/vendor-users-admin-panel";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { vendorsApi } from "./api";
import {
  blockerLabel,
  formatDate,
  formatDateTime,
  pct,
  REASON_REQUIRED,
  VENDOR_STATUS_LABELS,
  VENDOR_TRANSITIONS,
} from "./format";
import { VendorStatementsPanel } from "./statements-view";
import type { DocCategory, ReleaseOut, VendorDetailOut, VendorDocumentOut, VendorStatus } from "./types";
import { DocStatusBadge, SimpleGrid, SubmissionStatusBadge, TierBadge, VendorStatusBadge } from "./ui";
import {
  useReviewQueue,
  useVendor,
  useVendorDocuments,
  useVendorMutations,
  useVendorPerformance,
  useVendorReleases,
} from "./use-vendors";

const useStyles = makeStyles({
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  tabs: { marginBottom: tokens.spacingVerticalL },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: tokens.spacingHorizontalM },
  kpi: { padding: tokens.spacingHorizontalL, minHeight: "44px" },
  kpiValue: { fontSize: tokens.fontSizeHero700, fontWeight: tokens.fontWeightSemibold },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
});

type TabKey = "overview" | "gstins" | "documents" | "users" | "releases" | "submissions" | "performance" | "statements";

/** `/vendors/[id]`: header with status + transition menu, and the vendor tabs. */
export function VendorDetail({ id }: { id: string }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const canRead = usePermission("vendor:read");
  const canWrite = usePermission("vendor:write");
  const canPerf = usePermission("vendor:performance");
  const canStatements = usePermission("payroll:read");
  const vendor = useVendor(id);
  const [tab, setTab] = useState<TabKey>("overview");
  const [target, setTarget] = useState<VendorStatus | null>(null);

  if (!canRead) return <NoAccess what="vendors" />;
  if (vendor.isLoading) return <GridSkeleton />;
  if (vendor.error || !vendor.data) return <ErrorBar message={errorMessage(vendor.error)} />;
  const v = vendor.data;
  const next = VENDOR_TRANSITIONS[v.status];

  return (
    <>
      <PageHeader title={v.legal_name} subtitle={`${v.human_id} · Vendor`} />
      <div className={styles.header}>
        <VendorStatusBadge status={v.status} />
        <TierBadge tier={v.tier} />
        {canWrite && next.length > 0 && (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button icon={<ChevronDown20Regular />} iconPosition="after">
                Change status
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {next.map((s) => (
                  <MenuItem key={s} onClick={() => setTarget(s)}>
                    {VENDOR_STATUS_LABELS[s]}
                  </MenuItem>
                ))}
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
      </div>
      {v.status === "onboarding" && v.activation_blockers.length > 0 && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Activation blocked</MessageBarTitle>
            {v.activation_blockers.map(blockerLabel).join(" · ")}
          </MessageBarBody>
        </MessageBar>
      )}
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabKey)} aria-label="Vendor sections">
        <Tab value="overview">Overview</Tab>
        <Tab value="gstins">GSTINs</Tab>
        <Tab value="documents">Documents</Tab>
        <Tab value="users">Users</Tab>
        <Tab value="releases">Releases</Tab>
        <Tab value="submissions">Submissions</Tab>
        {canPerf && <Tab value="performance">Performance</Tab>}
        {canStatements && <Tab value="statements">Statements</Tab>}
      </TabList>
      <div className={admin.form}>
        {tab === "overview" && <Overview v={v} />}
        {tab === "gstins" && <Gstins v={v} canWrite={canWrite} />}
        {tab === "documents" && <Documents vendorId={v.id} canWrite={canWrite} />}
        {tab === "users" && <VendorUsersAdminPanel vendorId={v.id} readOnly={v.status === "inactive"} />}
        {tab === "releases" && <Releases vendorId={v.id} />}
        {tab === "submissions" && <Submissions vendorId={v.id} />}
        {tab === "performance" && canPerf && <Performance vendorId={v.id} />}
        {tab === "statements" && canStatements && <VendorStatementsPanel vendorId={v.id} />}
      </div>
      <TransitionDialog vendor={v} to={target} onClose={() => setTarget(null)} />
    </>
  );
}

function TransitionDialog({ vendor, to, onClose }: { vendor: VendorDetailOut; to: VendorStatus | null; onClose: () => void }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const { transition } = useVendorMutations();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const needsReason = to !== null && REASON_REQUIRED.includes(to);
  const close = () => {
    setReason("");
    setError(null);
    setMissing([]);
    onClose();
  };
  const confirm = async () => {
    if (!to) return;
    setError(null);
    try {
      await transition.mutateAsync({ id: vendor.id, to, reason: reason.trim() || null });
      toast.success(`${vendor.legal_name} is now ${VENDOR_STATUS_LABELS[to].toLowerCase()}`);
      close();
    } catch (e) {
      if (isApiError(e) && e.code === "vendor_activation_blocked") setMissing((e.details.missing as string[]) ?? []);
      setError(errorMessage(e));
    }
  };
  return (
    <Dialog open={to !== null} onOpenChange={(_, d) => !d.open && close()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Move to {to ? VENDOR_STATUS_LABELS[to] : ""}</DialogTitle>
          <DialogContent className={admin.form}>
            <ErrorBar message={error} />
            {missing.length > 0 && (
              <MessageBar intent="warning" layout="multiline">
                <MessageBarBody>{missing.map(blockerLabel).join(" · ")}</MessageBarBody>
              </MessageBar>
            )}
            {to === "suspended" && <Text>Suspension pauses active releases and signs out the vendor&apos;s users.</Text>}
            <Field label="Reason" required={needsReason}>
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} maxLength={2000} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={close}>Cancel</Button>
            <Button appearance="primary" disabled={(needsReason && !reason.trim()) || transition.isPending} onClick={confirm}>
              Confirm
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function Overview({ v }: { v: VendorDetailOut }) {
  const admin = useAdminStyles();
  const canUnmask = usePermission("identity:view");
  const toast = useAppToast();
  const [shown, setShown] = useState<Record<string, string>>({});
  const reveal = async (key: string, field: "pan" | "bank_account", bankId?: string) => {
    try {
      const out = await vendorsApi.reveal(v.id, field, bankId);
      setShown((s) => ({ ...s, [key]: out.value }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Card>
      <dl className={admin.detailList}>
        <dt>PAN</dt>
        <dd>
          {shown.pan ?? (v.pan_last4 ? `******${v.pan_last4}` : "—")}{" "}
          {canUnmask && v.pan_last4 && !shown.pan && (
            <Button size="small" appearance="subtle" icon={<Eye20Regular />} onClick={() => reveal("pan", "pan")}>
              Reveal
            </Button>
          )}
        </dd>
        <dt>Primary contact</dt>
        <dd>{[v.primary_contact?.name, v.primary_contact?.email, v.primary_contact?.phone].filter(Boolean).join(" · ") || "—"}</dd>
        <dt>Services</dt>
        <dd>{v.services.join(", ") || "—"}</dd>
        <dt>Regions</dt>
        <dd>{v.regions.join(", ") || "—"}</dd>
        <dt>Agreement</dt>
        <dd>{v.agreement_active ? <Badge color="success">Active</Badge> : <Badge color="warning">Missing</Badge>}</dd>
        {v.bank_accounts.map((b) => (
          <div key={b.id} style={{ display: "contents" }}>
            <dt>Bank account</dt>
            <dd>
              {b.account_name} · {shown[b.id] ?? `****${b.account_no_last4}`} · {b.ifsc} · <Badge appearance="outline">{b.status}</Badge>{" "}
              {canUnmask && !shown[b.id] && (
                <Button size="small" appearance="subtle" icon={<Eye20Regular />} onClick={() => reveal(b.id, "bank_account", b.id)}>
                  Reveal
                </Button>
              )}
            </dd>
          </div>
        ))}
        {v.suspended_reason && (
          <>
            <dt>Suspension reason</dt>
            <dd>{v.suspended_reason}</dd>
          </>
        )}
      </dl>
    </Card>
  );
}

function Gstins({ v, canWrite }: { v: VendorDetailOut; canWrite: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const { addGstin } = useVendorMutations();
  const [gstin, setGstin] = useState("");
  const [state, setState] = useState("");
  const add = async () => {
    try {
      await addGstin.mutateAsync({ id: v.id, gstin: gstin.trim().toUpperCase(), stateCode: state.trim() });
      setGstin("");
      setState("");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      {v.gstins.length === 0 ? <Text>No GSTINs recorded.</Text> : v.gstins.map((g) => <Text key={g.id}>{`${g.gstin} (state ${g.state_code})`}</Text>)}
      {canWrite && (
        <div className={styles.row}>
          <Field label="GSTIN">
            <Input value={gstin} onChange={(_, d) => setGstin(d.value)} maxLength={15} />
          </Field>
          <Field label="State code">
            <Input value={state} onChange={(_, d) => setState(d.value)} maxLength={2} />
          </Field>
          <Button disabled={gstin.trim().length !== 15 || state.trim().length !== 2} onClick={add}>
            Add GSTIN
          </Button>
        </div>
      )}
    </>
  );
}

const CATEGORIES: DocCategory[] = ["agreement", "registration", "insurance", "other"];

function Documents({ vendorId, canWrite }: { vendorId: string; canWrite: boolean }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const toast = useAppToast();
  const docs = useVendorDocuments(vendorId);
  const { uploadDocument, markReviewed } = useVendorMutations();
  const [category, setCategory] = useState<DocCategory>("agreement");
  const [expires, setExpires] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const columns: TableColumnDefinition<VendorDocumentOut>[] = [
    createTableColumn({ columnId: "cat", renderHeaderCell: () => "Category", renderCell: (d) => d.category }),
    createTableColumn({ columnId: "title", renderHeaderCell: () => "Title", renderCell: (d) => d.title }),
    createTableColumn({ columnId: "exp", renderHeaderCell: () => "Expires", renderCell: (d) => formatDate(d.expires_on) }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (d) => (
        <span className={admin.badges}>
          <DocStatusBadge status={d.status} />
          {d.pending_review && (
            <Button size="small" appearance="subtle" onClick={() => markReviewed.mutate({ id: vendorId, documentId: d.id })}>
              Mark reviewed
            </Button>
          )}
        </span>
      ),
    }),
  ];
  const upload = async () => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("category", category);
    if (expires) form.set("expires_on", expires);
    try {
      await uploadDocument.mutateAsync({ id: vendorId, form });
      setFile(null);
      setExpires("");
      toast.success("Document uploaded");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      {canWrite && (
        <div className={styles.row}>
          <Field label="Category">
            <Dropdown value={category} selectedOptions={[category]} onOptionSelect={(_, d) => setCategory(d.optionValue as DocCategory)}>
              {CATEGORIES.map((c) => (
                <Option key={c} value={c}>
                  {c}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Expires on">
            <Input type="date" value={expires} onChange={(_, d) => setExpires(d.value)} />
          </Field>
          <Field label="File">
            <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Document file" />
          </Field>
          <Button icon={<ArrowUpload20Regular />} disabled={!file || uploadDocument.isPending} onClick={upload}>
            Upload
          </Button>
        </div>
      )}
      <div className={admin.surface}>
        {docs.isLoading ? (
          <GridSkeleton rows={3} />
        ) : (docs.data ?? []).length === 0 ? (
          <div className={admin.empty}>No documents.</div>
        ) : (
          <SimpleGrid items={docs.data ?? []} columns={columns} />
        )}
      </div>
    </>
  );
}

function Releases({ vendorId }: { vendorId: string }) {
  const admin = useAdminStyles();
  const rel = useVendorReleases(vendorId);
  const columns: TableColumnDefinition<ReleaseOut>[] = [
    createTableColumn({ columnId: "id", renderHeaderCell: () => "Release", renderCell: (r) => r.human_id }),
    createTableColumn({ columnId: "title", renderHeaderCell: () => "Demand", renderCell: (r) => r.title }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (r) => r.status }),
    createTableColumn({
      columnId: "used",
      renderHeaderCell: () => "Submissions",
      renderCell: (r) => `${r.submissions_count}${r.submission_limit ? ` / ${r.submission_limit}` : ""}`,
    }),
    createTableColumn({ columnId: "deadline", renderHeaderCell: () => "Deadline", renderCell: (r) => formatDateTime(r.deadline_at) }),
  ];
  if (rel.isLoading) return <GridSkeleton rows={3} />;
  if (!rel.data?.length) return <div className={admin.empty}>No releases yet.</div>;
  return (
    <div className={admin.surface}>
      <SimpleGrid items={rel.data} columns={columns} />
    </div>
  );
}

function Submissions({ vendorId }: { vendorId: string }) {
  const admin = useAdminStyles();
  const q = useReviewQueue(null, vendorId);
  if (q.isLoading) return <GridSkeleton rows={3} />;
  if (!q.data?.length) return <div className={admin.empty}>No submissions yet.</div>;
  return (
    <div className={admin.form}>
      {q.data.map((s) => (
        <Text key={s.id}>
          {s.human_id} · {s.full_name ?? "—"} · {s.demand_title} · <SubmissionStatusBadge status={s.status} />
        </Text>
      ))}
    </div>
  );
}

function Performance({ vendorId }: { vendorId: string }) {
  const styles = useStyles();
  const perf = useVendorPerformance(vendorId);
  if (perf.isLoading) return <GridSkeleton rows={2} />;
  if (!perf.data) return <ErrorBar message={errorMessage(perf.error)} />;
  const p = perf.data;
  const tiles: [string, string][] = [
    ["Releases received", String(p.releases_received)],
    ["Submissions", String(p.submissions)],
    ["Acceptance", pct(p.acceptance_pct)],
    ["Duplicates", pct(p.duplicate_pct)],
    ["Submission → interview", pct(p.submission_to_interview_pct)],
    ["Interview → offer", pct(p.interview_to_offer_pct)],
    ["Placements", String(p.placements)],
    ["Median hours to first submission", p.median_hours_to_first_submission ?? "—"],
    ["SLA breaches", String(p.sla_breaches)],
    ["Ended within 30 days", String(p.early_exits)],
  ];
  return (
    <>
      <Subtitle2>
        {formatDate(p.period_from)} – {formatDate(p.period_to)}
      </Subtitle2>
      <div className={styles.kpis}>
        {tiles.map(([label, value]) => (
          <Card key={label} className={mergeClasses(styles.kpi)}>
            <Text size={200}>{label}</Text>
            <span className={styles.kpiValue}>{value}</span>
          </Card>
        ))}
      </div>
    </>
  );
}
