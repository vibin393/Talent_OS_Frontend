"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
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
  mergeClasses,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Spinner,
  Subtitle2,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, ArrowUpload20Regular, Checkmark20Regular, Play20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { downloadApiFile } from "@/lib/api/download";
import { goLiveApi, goLiveErrorMessage, goLiveKeys, goLiveUrls } from "./api";
import {
  APPLY_CONFIRM_WORD,
  availableAfterText,
  canApply,
  GO_LIVE_STEPS,
  goLiveStep,
  isCsvFile,
  isValidating,
  newIdempotencyKey,
  orderedKinds,
  resultCounts,
  rowDetail,
  rowsOf,
} from "./format";
import { dependencyHint } from "./p3/kind-order";
import { AI_AGENTS_STEP, AI_AGENTS_STEP_LABEL, AiAgentsGoLiveStep } from "./p4/ai-agents-step";
import { INTEGRATIONS_STEP, INTEGRATIONS_STEP_LABEL, IntegrationsGoLiveStep } from "./p5/integrations-step";
import type { GoLiveImport, GoLiveKindOut, GoLiveRow, GoLiveRowError } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1080px" },
  tabs: { marginBottom: tokens.spacingVerticalS },
  tabText: { display: "flex", flexDirection: "column", alignItems: "flex-start" },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  steps: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, margin: 0, padding: 0, listStyle: "none" },
  step: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, color: tokens.colorNeutralForeground3 },
  stepCurrent: { color: tokens.colorNeutralForeground1, fontWeight: tokens.fontWeightSemibold },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  counts: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  word: { fontFamily: tokens.fontFamilyMonospace, fontWeight: tokens.fontWeightSemibold },
});

/** `/admin/go-live` (`golive:import`): load existing data from CSV, kind by kind (Epic 35 B6). */
export function GoLivePage() {
  const styles = useStyles();
  const canImport = usePermission("golive:import");
  const canConfigureAgents = usePermission("ai:agent_configure");
  const canViewIntegrations = usePermission("integration:view") || usePermission("integration:manage");
  const kinds = useQuery({ queryKey: goLiveKeys.kinds, queryFn: ({ signal }) => goLiveApi.kinds(signal), enabled: canImport });
  const [selected, setSelected] = useState<string | null>(null);
  if (!canImport) return <NoAccess what="go-live data import" />;
  const list = kinds.data ? orderedKinds(kinds.data) : [];
  const showAgents = canConfigureAgents && selected === AI_AGENTS_STEP;
  const showIntegrations = canViewIntegrations && selected === INTEGRATIONS_STEP;
  const current = list.find((k) => k.kind === selected && k.available) ?? list.find((k) => k.available) ?? null;
  return (
    <>
      <PageHeader
        title="Go-live import"
        subtitle="Bring your existing data into Talent OS from CSV files, kind by kind. Import each kind after the kinds it depends on."
      />
      <div className={styles.root}>
        {kinds.isPending ? (
          <GridSkeleton rows={3} />
        ) : kinds.isError ? (
          <ErrorBar message={goLiveErrorMessage(kinds.error)} />
        ) : (
          <>
            <TabList
              className={styles.tabs}
              selectedValue={showAgents ? AI_AGENTS_STEP : showIntegrations ? INTEGRATIONS_STEP : current?.kind}
              onTabSelect={(_, d) => setSelected(String(d.value))}
              aria-label="Import kinds"
            >
              {list.map((k) => (
                <Tab key={k.kind} value={k.kind} disabled={!k.available}>
                  <span className={styles.tabText}>
                    {k.label}
                    {!k.available ? (
                      <Caption1>{availableAfterText(k.owner_epic)}</Caption1>
                    ) : (
                      dependencyHint(k, list) && <Caption1>{dependencyHint(k, list)}</Caption1>
                    )}
                  </span>
                </Tab>
              ))}
              {canConfigureAgents && <Tab value={AI_AGENTS_STEP}>{AI_AGENTS_STEP_LABEL}</Tab>}
              {canViewIntegrations && <Tab value={INTEGRATIONS_STEP}>{INTEGRATIONS_STEP_LABEL}</Tab>}
            </TabList>
            {showAgents ? (
              <AiAgentsGoLiveStep />
            ) : showIntegrations ? (
              <IntegrationsGoLiveStep />
            ) : current ? (
              <KindPanel key={current.kind} kind={current} kinds={list} />
            ) : (
              <MessageBar intent="info">
                <MessageBarBody>No import kinds are available yet.</MessageBarBody>
              </MessageBar>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Stepper({ imp }: { imp: GoLiveImport | null }) {
  const styles = useStyles();
  const at = goLiveStep(imp);
  const idx = GO_LIVE_STEPS.indexOf(at);
  return (
    <ol className={styles.steps} aria-label="Import progress">
      {GO_LIVE_STEPS.map((s, i) => (
        <li key={s} className={mergeClasses(styles.step, i === idx && styles.stepCurrent)} aria-current={i === idx ? "step" : undefined}>
          <Badge
            shape="circular"
            size="small"
            appearance={i <= idx ? "filled" : "outline"}
            color={i < idx ? "success" : i === idx ? "brand" : "informative"}
            icon={i < idx ? <Checkmark20Regular /> : undefined}
          >
            {i < idx ? undefined : i + 1}
          </Badge>
          {s}
        </li>
      ))}
    </ol>
  );
}

const errorColumns: TableColumnDefinition<GoLiveRowError & { key: string }>[] = [
  createTableColumn({ columnId: "row", compare: (a, b) => a.row - b.row, renderHeaderCell: () => "Row", renderCell: (e) => e.row }),
  createTableColumn({ columnId: "column", renderHeaderCell: () => "Column", renderCell: (e) => e.column ?? "—" }),
  createTableColumn({ columnId: "message", renderHeaderCell: () => "Message", renderCell: (e) => e.message }),
];

function KindPanel({ kind, kinds }: { kind: GoLiveKindOut; kinds: readonly GoLiveKindOut[] }) {
  const styles = useStyles();
  const toast = useAppToast();
  const inputId = useId();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [busy, setBusy] = useState<"template" | "errors" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const imp = useQuery({
    queryKey: goLiveKeys.import(importId ?? ""),
    queryFn: ({ signal }) => goLiveApi.import(importId!, signal),
    enabled: !!importId,
    refetchInterval: (q) => (isValidating(q.state.data) ? 2000 : false),
  });
  const data = imp.data ?? null;

  const upload = useMutation({
    mutationFn: (f: File) => goLiveApi.upload(kind.kind, f),
    onSuccess: (out) => {
      queryClient.setQueryData(goLiveKeys.import(out.id), out);
      setImportId(out.id);
    },
    onError: (e) => setError(goLiveErrorMessage(e)),
  });

  const download = async (what: "template" | "errors") => {
    setBusy(what);
    setError(null);
    try {
      if (what === "template") await downloadApiFile(goLiveUrls.template(kind.kind), `${kind.kind}-template.csv`);
      else if (data) await downloadApiFile(goLiveUrls.errorReport(data.id), `${kind.kind}-errors.csv`);
    } catch (e) {
      setError(goLiveErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    setImportId(null);
    setFile(null);
    setError(null);
  };

  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">{kind.label}</Subtitle2>}
        description={
          <Caption1>
            {dependencyHint(kind, kinds) ? `${dependencyHint(kind, kinds)}. ` : ""}Download the template, fill it in, then upload it.
            Nothing is saved until you apply.
          </Caption1>
        }
        action={
          <Button
            icon={busy === "template" ? <Spinner size="tiny" /> : <ArrowDownload20Regular />}
            disabled={busy !== null}
            onClick={() => void download("template")}
          >
            Download template
          </Button>
        }
      />
      <Stepper imp={data} />
      <ErrorBar message={error} />

      {!data && (
        <form
          noValidate
          className={styles.content}
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) return setFileError("Choose a CSV file.");
            setError(null);
            upload.mutate(file);
          }}
        >
          <Field
            label="CSV file"
            required
            hint="Comma-separated values exported from the template."
            validationState={fileError ? "error" : "none"}
            validationMessage={fileError ?? undefined}
          >
            <input
              id={inputId}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && !isCsvFile(f)) {
                  setFile(null);
                  setFileError("Only CSV files can be imported.");
                  return;
                }
                setFileError(null);
                setFile(f);
              }}
            />
          </Field>
          <div className={styles.actions}>
            <Button
              appearance="primary"
              type="submit"
              icon={upload.isPending ? <Spinner size="tiny" /> : <ArrowUpload20Regular />}
              disabled={!file || upload.isPending}
            >
              Upload and validate
            </Button>
          </div>
        </form>
      )}

      {data && isValidating(data) && (
        <Field label="Validating rows…" validationState="none">
          <ProgressBar />
        </Field>
      )}

      {data && data.status !== "validating" && (
        <>
          <div className={styles.counts} aria-label="Row counts">
            <Badge appearance="tint" color="informative">
              {data.row_count.toLocaleString()} rows
            </Badge>
            <Badge appearance="tint" color="success">
              {data.valid_count.toLocaleString()} valid
            </Badge>
            <Badge appearance="tint" color={data.error_count > 0 ? "danger" : "subtle"}>
              {data.error_count.toLocaleString()} with errors
            </Badge>
          </div>
          {data.status === "previewed" && data.error_count > 0 && (
            <>
              <AdminGrid
                items={data.errors.map((e, i) => ({ ...e, key: `${e.row}-${e.column ?? ""}-${i}` }))}
                columns={errorColumns}
                getRowId={(e) => e.key}
                loading={false}
                error={null}
                emptyText="No errors."
                label="Row errors"
                sortable
              />
              <div className={styles.actions}>
                <Button
                  icon={busy === "errors" ? <Spinner size="tiny" /> : <ArrowDownload20Regular />}
                  disabled={busy !== null}
                  onClick={() => void download("errors")}
                >
                  Download error report
                </Button>
              </div>
            </>
          )}
          {data.status === "previewed" && (
            <div className={styles.actions}>
              <Button appearance="primary" icon={<Play20Regular />} disabled={data.valid_count === 0} onClick={() => setApplying(true)}>
                Apply
              </Button>
              <Button onClick={reset}>Upload a corrected file</Button>
            </div>
          )}
          {(data.status === "applied" || data.status === "failed") && <Results imp={data} onDone={reset} />}
          {data.status === "discarded" && (
            <div className={styles.actions}>
              <Body1>This import was discarded.</Body1>
              <Button onClick={reset}>Start again</Button>
            </div>
          )}
        </>
      )}

      {data && (
        <ApplyDialog
          open={applying}
          imp={data}
          kinds={kinds}
          onClose={() => setApplying(false)}
          onApplied={(out) => {
            queryClient.setQueryData(goLiveKeys.import(out.id), out);
            toast.success(`${kind.label}: ${out.applied_count.toLocaleString()} row(s) applied`);
          }}
        />
      )}
    </Card>
  );
}

function ApplyDialog({
  open,
  imp,
  kinds,
  onClose,
  onApplied,
}: {
  open: boolean;
  imp: GoLiveImport;
  kinds: readonly GoLiveKindOut[];
  onClose: () => void;
  onApplied: (out: GoLiveImport) => void;
}) {
  const styles = useStyles();
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  // One key per dialog session: a retried click replays the same apply instead of applying twice.
  const [key, setKey] = useState(newIdempotencyKey);
  const reset = () => {
    setTyped("");
    setSkipInvalid(false);
    setError(null);
    setKey(newIdempotencyKey());
    onClose();
  };
  const apply = useMutation({
    mutationFn: () => goLiveApi.apply(imp.id, { skip_invalid: skipInvalid, confirm: APPLY_CONFIRM_WORD }, key),
    onSuccess: (out) => {
      onApplied(out);
      reset();
    },
    onError: (e) => setError(goLiveErrorMessage(e, kinds)),
  });
  const close = () => {
    if (!apply.isPending) reset();
  };
  const ok = canApply(imp, skipInvalid, typed);
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && close()} modalType="alert">
      <DialogSurface>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!ok) return;
            setError(null);
            apply.mutate();
          }}
        >
          <DialogBody>
            <DialogTitle>Apply {imp.valid_count.toLocaleString()} row(s)?</DialogTitle>
            <DialogContent className={styles.content}>
              <ErrorBar message={error} />
              <Body1>
                Valid rows are created with the same checks as records entered by hand. Applied rows cannot be undone from
                this page.
              </Body1>
              {imp.error_count > 0 && (
                <Checkbox
                  checked={skipInvalid}
                  onChange={(_, d) => setSkipInvalid(d.checked === true)}
                  label={`Skip the ${imp.error_count.toLocaleString()} row(s) with errors`}
                />
              )}
              <Field
                label={
                  <>
                    Type <span className={styles.word}>{APPLY_CONFIRM_WORD}</span> to confirm
                  </>
                }
                required
              >
                <Input value={typed} onChange={(_, d) => setTyped(d.value)} autoComplete="off" spellCheck={false} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" disabled={apply.isPending} onClick={() => close()}>
                Cancel
              </Button>
              <Button appearance="primary" type="submit" disabled={!ok || apply.isPending} icon={apply.isPending ? <Spinner size="tiny" /> : undefined}>
                Apply
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

function Results({ imp, onDone }: { imp: GoLiveImport; onDone: () => void }) {
  const styles = useStyles();
  const [status, setStatus] = useState<string>("applied");
  const rows = useQuery({
    queryKey: goLiveKeys.rows(imp.id, status),
    queryFn: ({ signal }) => goLiveApi.rows(imp.id, status, signal),
  });
  const columns: TableColumnDefinition<GoLiveRow>[] = [
    createTableColumn({ columnId: "row", renderHeaderCell: () => "Row", renderCell: (r) => r.row_no }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (r) => r.status }),
    createTableColumn({ columnId: "detail", renderHeaderCell: () => "Detail", renderCell: (r) => rowDetail(r) }),
  ];
  return (
    <div className={styles.content}>
      <Text>
        {imp.status === "failed" ? "The import failed." : "Import applied"}
        {imp.applied_at ? ` · ${formatDateTime(imp.applied_at)}` : ""}
      </Text>
      <TabList selectedValue={status} onTabSelect={(_, d) => setStatus(String(d.value))} aria-label="Rows by status" size="small">
        {resultCounts(imp).map((c) => (
          <Tab key={c.status} value={c.status}>
            {c.label}{" "}
            <Badge appearance="tint" color={c.color} size="small">
              {c.count.toLocaleString()}
            </Badge>
          </Tab>
        ))}
      </TabList>
      <AdminGrid
        items={rowsOf(rows.data)}
        columns={columns}
        getRowId={(r) => `${r.row_no}-${r.status}`}
        loading={rows.isPending}
        error={rows.error}
        emptyText="No rows with this status."
        label="Import rows"
      />
      <div className={styles.actions}>
        <Button onClick={onDone}>Import another file</Button>
      </div>
    </div>
  );
}
