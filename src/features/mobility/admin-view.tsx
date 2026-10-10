"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Switch,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { ArrowUpload20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { mobilityApi } from "./api";
import type { MobilitySettingsOut, ProfileImportOut, ProfileImportRow, ProfileOut, SubjectKind } from "./types";
import { mobilityKeys, useMobilityPermissions, useMobilitySettings, useProfiles } from "./use-mobility";

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXL },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "860px" },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: tokens.spacingHorizontalM },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  muted: { color: tokens.colorNeutralForeground3 },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
});

/** `/admin/mobility`: internal mobility settings, employee grades and CSV import. */
export function MobilityAdmin() {
  const styles = useStyles();
  const { canManage } = useMobilityPermissions();
  if (!canManage) return <NoAccess what="internal mobility settings" />;
  return (
    <div className={styles.page}>
      <PageHeader title="Internal mobility" subtitle="Internal job board, manager approval, eligibility defaults and employee grades." />
      <SettingsCard />
      <ProfilesSection />
      <ImportCard />
    </div>
  );
}

// ---------------------------------------------------------------- settings
function SettingsCard() {
  const styles = useStyles();
  const q = useMobilitySettings(true);
  return (
    <Card className={styles.card}>
      <Subtitle2 as="h2">Settings</Subtitle2>
      {q.isPending ? (
        <GridSkeleton rows={4} />
      ) : q.isError ? (
        <ErrorBar title="Could not load settings." message={errorMessage(q.error)} />
      ) : (
        <SettingsForm key={q.dataUpdatedAt} initial={q.data} />
      )}
    </Card>
  );
}

type SettingsDraft = Omit<MobilitySettingsOut, "min_tenure_default_months"> & { min_tenure: string };

function SettingsForm({ initial }: { initial: MobilitySettingsOut }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [f, setF] = useState<SettingsDraft>({ ...initial, min_tenure: initial.min_tenure_default_months == null ? "" : String(initial.min_tenure_default_months) });
  const tenureNum = Number(f.min_tenure);
  const errors: Record<string, string> = {};
  if (f.min_tenure.trim() && (!Number.isInteger(tenureNum) || tenureNum < 0 || tenureNum > 600)) errors.min_tenure = "Enter whole months between 0 and 600.";
  if (f.disclosure_text.trim().length < 10) errors.disclosure_text = "Write at least 10 characters.";
  if (!f.fallback_approver_role_key.trim()) errors.fallback_approver_role_key = "Enter a role key.";
  const save = useMutation({
    mutationFn: () =>
      mobilityApi.patchSettings({
        board_enabled: f.board_enabled,
        worker_board_enabled: f.worker_board_enabled,
        screen_before_manager: f.screen_before_manager,
        fallback_approver_role_key: f.fallback_approver_role_key.trim(),
        min_tenure_default_months: f.min_tenure.trim() ? tenureNum : null,
        disclosure_text: f.disclosure_text.trim(),
      }),
    onSuccess: (out) => {
      qc.setQueryData(mobilityKeys.settings, out);
      toast.success("Settings saved.");
    },
    onError: (e) => toast.error(errorMessage(e, "Could not save the settings.")),
  });
  const server = fieldErrors(save.error);
  const msg = (k: string, sk = k) => errors[k] ?? server[sk];

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (Object.keys(errors).length === 0) save.mutate();
      }}
    >
      <Switch label="Internal job board for employees" checked={f.board_enabled} onChange={(_, d) => setF((s) => ({ ...s, board_enabled: d.checked }))} />
      <Switch
        label="Show the board to Workers in the worker portal"
        checked={f.worker_board_enabled}
        onChange={(_, d) => setF((s) => ({ ...s, worker_board_enabled: d.checked }))}
      />
      <Switch
        label="Recruiter screens before the manager approves"
        checked={f.screen_before_manager}
        onChange={(_, d) => setF((s) => ({ ...s, screen_before_manager: d.checked }))}
      />
      <div className={styles.grid}>
        <Field
          label="Fallback approver role key"
          hint="Used when no manager can be found."
          required
          validationState={msg("fallback_approver_role_key") ? "error" : "none"}
          validationMessage={msg("fallback_approver_role_key")}
        >
          <Input value={f.fallback_approver_role_key} maxLength={60} onChange={(_, d) => setF((s) => ({ ...s, fallback_approver_role_key: d.value }))} />
        </Field>
        <Field
          label="Default minimum tenure (months)"
          hint="Leave empty for no default."
          validationState={msg("min_tenure", "min_tenure_default_months") ? "error" : "none"}
          validationMessage={msg("min_tenure", "min_tenure_default_months")}
        >
          <Input type="number" min={0} max={600} value={f.min_tenure} onChange={(_, d) => setF((s) => ({ ...s, min_tenure: d.value }))} />
        </Field>
      </div>
      <Field
        label="Disclosure text"
        hint="Shown to employees before they apply; they must confirm it."
        required
        validationState={msg("disclosure_text") ? "error" : "none"}
        validationMessage={msg("disclosure_text")}
      >
        <Textarea value={f.disclosure_text} maxLength={2000} rows={4} resize="vertical" onChange={(_, d) => setF((s) => ({ ...s, disclosure_text: d.value }))} />
      </Field>
      <div>
        <Button type="submit" appearance="primary" disabled={save.isPending || Object.keys(errors).length > 0}>
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- profiles
function ProfilesSection() {
  const styles = useStyles();
  const [kind, setKind] = useState<SubjectKind>("user");
  const q = useProfiles(kind, true);
  const [editing, setEditing] = useState<ProfileOut | null>(null);
  const columns: TableColumnDefinition<ProfileOut>[] = [
    createTableColumn({
      columnId: "name",
      compare: (a, b) => (a.subject_name ?? "").localeCompare(b.subject_name ?? ""),
      renderHeaderCell: () => "Name",
      renderCell: (p) => <Text weight="semibold">{p.subject_name ?? "—"}</Text>,
    }),
    createTableColumn({ columnId: "email", renderHeaderCell: () => "Email", renderCell: (p) => p.subject_email ?? "—" }),
    createTableColumn({
      columnId: "grade",
      compare: (a, b) => (a.grade ?? "").localeCompare(b.grade ?? ""),
      renderHeaderCell: () => "Grade",
      renderCell: (p) => p.grade ?? "—",
    }),
    createTableColumn({ columnId: "location", renderHeaderCell: () => "Location", renderCell: (p) => p.location ?? "—" }),
    createTableColumn({ columnId: "updated", renderHeaderCell: () => "Updated", renderCell: (p) => formatDateTime(p.updated_at) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (p) => (
        <Button appearance="subtle" icon={<Edit20Regular />} aria-label={`Edit grade and location for ${p.subject_name ?? p.subject_email ?? "employee"}`} onClick={() => setEditing(p)} />
      ),
    }),
  ];
  return (
    <section className={styles.section} aria-labelledby="mobility-grades">
      <Subtitle2 as="h2" id="mobility-grades">
        Employee grades
      </Subtitle2>
      <TabList selectedValue={kind} onTabSelect={(_, d) => setKind(d.value as SubjectKind)} aria-label="Employee type">
        <Tab value="user">Users</Tab>
        <Tab value="worker">Workers</Tab>
      </TabList>
      <AdminGrid
        items={q.data}
        columns={columns}
        getRowId={(p) => p.id}
        loading={q.isPending}
        error={q.error}
        emptyText="No grades recorded yet. Import a CSV below."
        label={kind === "user" ? "User grades" : "Worker grades"}
        sortable
      />
      {editing && <ProfileDialog profile={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function ProfileDialog({ profile, onClose }: { profile: ProfileOut; onClose: () => void }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [grade, setGrade] = useState(profile.grade ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const save = useMutation({
    mutationFn: () =>
      mobilityApi.putProfile({
        subject_kind: profile.subject_kind,
        subject_id: profile.subject_id,
        grade: grade.trim() || null,
        location: location.trim() || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: mobilityKeys.profiles(profile.subject_kind) });
      toast.success("Saved.");
      onClose();
    },
  });
  const server = fieldErrors(save.error);
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{`Edit ${profile.subject_name ?? profile.subject_email ?? "employee"}`}</DialogTitle>
          <DialogContent>
            <form
              id="mobility-profile"
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              {save.isError && !Object.keys(server).length && <ErrorBar message={errorMessage(save.error)} />}
              <Field label="Grade" validationState={server.grade ? "error" : "none"} validationMessage={server.grade}>
                <Input value={grade} maxLength={40} onChange={(_, d) => setGrade(d.value)} />
              </Field>
              <Field label="Location" validationState={server.location ? "error" : "none"} validationMessage={server.location}>
                <Input value={location} maxLength={200} onChange={(_, d) => setLocation(d.value)} />
              </Field>
            </form>
          </DialogContent>
          <DialogActions>
            <Button disabled={save.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="mobility-profile" appearance="primary" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ---------------------------------------------------------------- import
function ImportCard() {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProfileImportOut | null>(null);
  const run = useMutation({
    mutationFn: ({ validateOnly }: { validateOnly: boolean }) => mobilityApi.importProfiles(file as File, validateOnly),
    onSuccess: (out) => {
      if (out.validate_only) {
        setPreview(out);
      } else {
        setPreview(null);
        setFile(null);
        void qc.invalidateQueries({ queryKey: ["mobility", "profiles"] });
        toast.success(`Imported ${out.applied} row${out.applied === 1 ? "" : "s"}.`);
      }
    },
    onError: (e) => toast.error(errorMessage(e, "Could not import the file.")),
  });
  const columns: TableColumnDefinition<ProfileImportRow>[] = [
    createTableColumn({ columnId: "line", renderHeaderCell: () => "Line", renderCell: (r) => r.line }),
    createTableColumn({ columnId: "email", renderHeaderCell: () => "Email", renderCell: (r) => r.email }),
    createTableColumn({
      columnId: "kind",
      renderHeaderCell: () => "Type",
      renderCell: (r) => (r.subject_kind === "worker" ? "Worker" : r.subject_kind === "user" ? "User" : "—"),
    }),
    createTableColumn({ columnId: "grade", renderHeaderCell: () => "Grade", renderCell: (r) => r.grade ?? "—" }),
    createTableColumn({ columnId: "location", renderHeaderCell: () => "Location", renderCell: (r) => r.location ?? "—" }),
    createTableColumn({
      columnId: "result",
      renderHeaderCell: () => "Result",
      renderCell: (r) =>
        r.error ? (
          <Badge appearance="tint" color="danger">
            {r.error}
          </Badge>
        ) : (
          <Badge appearance="tint" color="success">
            OK
          </Badge>
        ),
    }),
  ];
  const valid = preview ? preview.rows.length - preview.errors : 0;

  return (
    <Card className={styles.card}>
      <Subtitle2 as="h2">Import grades from CSV</Subtitle2>
      <Body1 className={styles.muted}>Columns: email, grade, location. Validate first to preview the rows, then apply.</Body1>
      <div className={styles.row}>
        <div className={styles.section}>
          <label htmlFor={inputId}>CSV file</label>
          <input
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
        </div>
        <Button icon={run.isPending ? <Spinner size="tiny" /> : <ArrowUpload20Regular />} disabled={!file || run.isPending} onClick={() => run.mutate({ validateOnly: true })}>
          Validate
        </Button>
        <Button appearance="primary" disabled={!file || !preview || valid === 0 || run.isPending} onClick={() => run.mutate({ validateOnly: false })}>
          {preview ? `Apply ${valid} row${valid === 1 ? "" : "s"}` : "Apply"}
        </Button>
      </div>
      {preview && (
        <>
          <MessageBar intent={preview.errors ? "warning" : "success"} layout="multiline">
            <MessageBarBody>
              {preview.errors
                ? `${preview.errors} row${preview.errors === 1 ? "" : "s"} with errors will be skipped.`
                : "All rows are valid."}
            </MessageBarBody>
          </MessageBar>
          <AdminGrid
            items={preview.rows}
            columns={columns}
            getRowId={(r) => String(r.line)}
            loading={false}
            error={null}
            emptyText="The file has no rows."
            label="Import preview"
          />
        </>
      )}
    </Card>
  );
}
