"use client";

import {
  Badge,
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
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  SpinButton,
  Tab,
  TabList,
  type TableColumnDefinition,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { bgvApi, bgvKeys } from "./api";
import { CHECK_TYPE_LABELS, needsLawfulAttestation } from "./logic";
import type { BgvPackage, BgvProvider, CheckType, PackageCheck, Questionnaire } from "./types";

const useStyles = makeStyles({
  tabs: { marginBottom: tokens.spacingVerticalM },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  docs: { flex: "1 1 220px" },
});

const TYPES = Object.keys(CHECK_TYPE_LABELS) as CheckType[];
const DEFAULT_DOCS: Partial<Record<CheckType, string>> = {
  identity: "aadhaar",
  employment: "employment_history, relieving_letter",
  education: "education_history, degree_certificate",
  address: "address_history, address_proof",
  professional_licence: "professional_licence",
  criminal_record: "police_clearance",
};

/** `/admin/bgv`: BGV packages (check editor + lawful attestation), providers and reference questionnaires. */
export function BgvAdmin() {
  const styles = useStyles();
  const canConfigure = usePermission("bgv:configure");
  const [tab, setTab] = useState("packages");
  if (!canConfigure) return <NoAccess what="BGV configuration" />;
  return (
    <>
      <PageHeader title="Background verification" subtitle="Packages, providers and reference questionnaires" />
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))}>
        <Tab value="packages">Packages</Tab>
        <Tab value="providers">Providers</Tab>
        <Tab value="questionnaires">Reference questionnaires</Tab>
      </TabList>
      {tab === "packages" && <Packages />}
      {tab === "providers" && <Providers />}
      {tab === "questionnaires" && <Questionnaires />}
    </>
  );
}

function Packages() {
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: bgvKeys.packages, queryFn: ({ signal }) => bgvApi.packages(true, signal) });
  const archive = useMutation({ mutationFn: (id: string) => bgvApi.archivePackage(id), onSuccess: () => void qc.invalidateQueries({ queryKey: bgvKeys.packages }) });
  const columns: TableColumnDefinition<BgvPackage>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Package", renderCell: (p) => p.name }),
    createTableColumn({
      columnId: "checks",
      renderHeaderCell: () => "Checks",
      renderCell: (p) => p.checks.map((c) => `${CHECK_TYPE_LABELS[c.type]}${c.count > 1 ? ` ×${c.count}` : ""}`).join(", "),
    }),
    createTableColumn({ columnId: "lawful", renderHeaderCell: () => "Lawful basis", renderCell: (p) => (p.lawful_confirmed_at ? "Attested" : "—") }),
    createTableColumn({
      columnId: "state",
      renderHeaderCell: () => "State",
      renderCell: (p) =>
        p.archived_at ? (
          <Badge appearance="tint">Archived</Badge>
        ) : (
          <Button size="small" onClick={() => archive.mutate(p.id)}>
            Archive
          </Button>
        ),
    }),
  ];
  return (
    <>
      <div className={admin.toolbar}>
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setOpen(true)}>
          New package
        </Button>
      </div>
      <AdminGrid items={q.data} columns={columns} getRowId={(p) => p.id} loading={q.isPending} error={q.error} emptyText="No packages yet." label="BGV packages" />
      {open && <PackageDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function PackageDialog({ onClose }: { onClose: () => void }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [checks, setChecks] = useState<(Omit<PackageCheck, "required_documents"> & { docs: string })[]>([
    { type: "identity", count: 1, turnaround_days: 2, docs: DEFAULT_DOCS.identity ?? "" },
  ]);
  const [lawful, setLawful] = useState(false);
  const lawfulNeeded = needsLawfulAttestation(checks.map((c) => c.type));
  const save = useMutation({
    mutationFn: () =>
      bgvApi.createPackage({
        name: name.trim(),
        lawful_confirmed: lawful,
        checks: checks.map(({ docs, ...c }) => ({
          ...c,
          required_documents: docs
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean),
        })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: bgvKeys.packages });
      onClose();
    },
  });
  const update = (i: number, patch: Partial<(typeof checks)[number]>) => setChecks((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>New BGV package</DialogTitle>
          <DialogContent>
            <div className={admin.form}>
              <Field label="Name" required>
                <Input value={name} onChange={(_, d) => setName(d.value)} />
              </Field>
              {checks.map((c, i) => (
                <div key={i} className={styles.row}>
                  <Field label="Check">
                    <Dropdown
                      value={CHECK_TYPE_LABELS[c.type]}
                      selectedOptions={[c.type]}
                      onOptionSelect={(_, d) => {
                        const t = d.optionValue as CheckType;
                        update(i, { type: t, docs: DEFAULT_DOCS[t] ?? "" });
                      }}
                    >
                      {TYPES.map((t) => (
                        <Option key={t} value={t}>
                          {CHECK_TYPE_LABELS[t]}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                  <Field label="Count">
                    <SpinButton min={1} max={10} value={c.count} onChange={(_, d) => update(i, { count: Number(d.value ?? d.displayValue ?? 1) || 1 })} />
                  </Field>
                  <Field label="Turnaround (working days)">
                    <SpinButton min={1} max={90} value={c.turnaround_days} onChange={(_, d) => update(i, { turnaround_days: Number(d.value ?? d.displayValue ?? 5) || 5 })} />
                  </Field>
                  <Field label="Required documents (keys, comma separated)" className={styles.docs}>
                    <Input value={c.docs} onChange={(_, d) => update(i, { docs: d.value })} />
                  </Field>
                  <Button aria-label="Remove check" icon={<Delete20Regular />} disabled={checks.length === 1} onClick={() => setChecks((cs) => cs.filter((_, j) => j !== i))} />
                </div>
              ))}
              <Button icon={<Add20Regular />} onClick={() => setChecks((cs) => [...cs, { type: "employment", count: 1, turnaround_days: 5, docs: DEFAULT_DOCS.employment ?? "" }])}>
                Add check
              </Button>
              {lawfulNeeded && (
                <MessageBar intent="warning">
                  <MessageBarBody>
                    Criminal record and drug test checks are allowed only where lawful for the role and location.
                    <Checkbox label="I confirm there is a lawful basis for these checks" checked={lawful} onChange={(_, d) => setLawful(Boolean(d.checked))} />
                  </MessageBarBody>
                </MessageBar>
              )}
              <ErrorBar message={save.isError ? errorMessage(save.error) : null} />
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={!name.trim() || save.isPending || (lawfulNeeded && !lawful)} onClick={() => save.mutate()}>
              Create
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function Providers() {
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const q = useQuery({ queryKey: bgvKeys.providers, queryFn: ({ signal }) => bgvApi.providers(signal) });
  const create = useMutation({
    mutationFn: () => bgvApi.createProvider({ name: name.trim(), contact_email: email.trim() || null }),
    onSuccess: () => {
      setName("");
      setEmail("");
      void qc.invalidateQueries({ queryKey: bgvKeys.providers });
    },
  });
  const toggle = useMutation({
    mutationFn: (p: BgvProvider) => bgvApi.updateProvider(p.id, { active: !p.active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: bgvKeys.providers }),
  });
  const columns: TableColumnDefinition<BgvProvider>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Provider", renderCell: (p) => p.name }),
    createTableColumn({ columnId: "email", renderHeaderCell: () => "Contact email", renderCell: (p) => p.contact_email ?? "— (download packets)" }),
    createTableColumn({
      columnId: "types",
      renderHeaderCell: () => "Check types",
      renderCell: (p) => (p.supported_types.length ? p.supported_types.map((t) => CHECK_TYPE_LABELS[t]).join(", ") : "All"),
    }),
    createTableColumn({
      columnId: "active",
      renderHeaderCell: () => "Active",
      renderCell: (p) => <Checkbox checked={p.active} aria-label={`${p.name} active`} onChange={() => toggle.mutate(p)} />,
    }),
  ];
  return (
    <>
      <div className={admin.toolbar}>
        <Field label="Name">
          <Input value={name} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Contact email (receives secure links)">
          <Input type="email" value={email} onChange={(_, d) => setEmail(d.value)} />
        </Field>
        <Button appearance="primary" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
          Add provider
        </Button>
      </div>
      <ErrorBar message={create.isError ? errorMessage(create.error) : null} />
      <AdminGrid items={q.data} columns={columns} getRowId={(p) => p.id} loading={q.isPending} error={q.error} emptyText="No providers yet." label="BGV providers" />
    </>
  );
}

function Questionnaires() {
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [lines, setLines] = useState("");
  const q = useQuery({ queryKey: bgvKeys.questionnaires, queryFn: ({ signal }) => bgvApi.questionnaires(signal) });
  const create = useMutation({
    mutationFn: () =>
      bgvApi.createQuestionnaire({
        name: name.trim(),
        is_default: (q.data ?? []).length === 0,
        questions: lines
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length >= 3)
          .map((text, i) => ({ key: `q${i + 1}`, text, kind: "text" as const, required: true })),
      }),
    onSuccess: () => {
      setName("");
      setLines("");
      void qc.invalidateQueries({ queryKey: bgvKeys.questionnaires });
    },
  });
  const columns: TableColumnDefinition<Questionnaire>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Questionnaire", renderCell: (x) => x.name }),
    createTableColumn({ columnId: "count", renderHeaderCell: () => "Questions", renderCell: (x) => String(x.questions.length) }),
    createTableColumn({ columnId: "default", renderHeaderCell: () => "Default", renderCell: (x) => (x.is_default ? "Yes" : "") }),
  ];
  return (
    <>
      <div className={admin.form}>
        <Field label="Name">
          <Input value={name} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Questions (one per line)">
          <Textarea rows={4} value={lines} onChange={(_, d) => setLines(d.value)} />
        </Field>
        <div>
          <Button appearance="primary" disabled={!name.trim() || !lines.trim() || create.isPending} onClick={() => create.mutate()}>
            Add questionnaire
          </Button>
        </div>
        <ErrorBar message={create.isError ? errorMessage(create.error) : null} />
      </div>
      <AdminGrid items={q.data} columns={columns} getRowId={(x) => x.id} loading={q.isPending} error={q.error} emptyText="The standard questionnaire is used until you add one." label="Reference questionnaires" />
    </>
  );
}
