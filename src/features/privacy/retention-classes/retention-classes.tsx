"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  OverlayDrawer,
  SpinButton,
  Spinner,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Archive20Regular, Dismiss24Regular, Edit20Regular, Eye20Regular, Play20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, formatDateTime } from "@/features/admin/ui";
import { privacyKeys } from "../api";
import { TypedConfirmDialog } from "../dialogs";
import { retentionClassErrorMessage, retentionClassesApi, retentionClassKeys } from "./api";
import {
  activeClasses,
  ANCHOR_LABELS,
  bindingBadge,
  canStartExpiry,
  classKeyError,
  EXPIRY_ACTION_LABELS,
  EXPIRY_CONFIRM_WORD,
  formatPeriod,
  isReportOnlyClass,
  MAX_PERIOD_MONTHS,
  minPeriod,
  periodError,
  REPORT_ONLY_EXPLANATION,
} from "./format";
import type { ClassExpiryPreview, ExpiryAction, RetentionAnchor, RetentionBinding, RetentionClass } from "./types";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  name: { display: "flex", flexDirection: "column", paddingBlock: tokens.spacingVerticalXS, minWidth: 0 },
  nameRow: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
  disabled: { opacity: 0.6 },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  drawerBody: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  total: { fontSize: tokens.fontSizeHero700, fontWeight: tokens.fontWeightSemibold, lineHeight: tokens.lineHeightHero700 },
});

/** Epic 35 B1: retention classes grid, bindings panel and class expiry preview (below the P1 policy card). */
export function RetentionClassesSection() {
  return (
    <>
      <ClassesCard />
      <BindingsCard />
    </>
  );
}

function ClassesCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const classes = useQuery({ queryKey: retentionClassKeys.classes, queryFn: ({ signal }) => retentionClassesApi.classes(signal) });
  const [editing, setEditing] = useState<RetentionClass | "new" | null>(null);
  const [archiving, setArchiving] = useState<RetentionClass | null>(null);
  const [previewing, setPreviewing] = useState<RetentionClass | null>(null);

  const columns: TableColumnDefinition<RetentionClass>[] = [
    createTableColumn({
      columnId: "class",
      compare: (a, b) => a.label.localeCompare(b.label),
      renderHeaderCell: () => "Class",
      renderCell: (c) => (
        <div className={styles.name}>
          <span className={styles.nameRow}>
            <Text weight="semibold">{c.label}</Text>
            {c.is_system && (
              <Badge appearance="outline" color="informative" size="small">
                System
              </Badge>
            )}
          </span>
          <Caption1 className={styles.muted}>{isReportOnlyClass(c) ? REPORT_ONLY_EXPLANATION : c.key}</Caption1>
        </div>
      ),
    }),
    createTableColumn({
      columnId: "period",
      compare: (a, b) => a.period_months - b.period_months,
      renderHeaderCell: () => "Period",
      renderCell: (c) => formatPeriod(c.period_months),
    }),
    createTableColumn({ columnId: "anchor", renderHeaderCell: () => "Counted from", renderCell: (c) => ANCHOR_LABELS[c.anchor] ?? c.anchor }),
    createTableColumn({
      columnId: "action",
      renderHeaderCell: () => "On expiry",
      renderCell: (c) => (isReportOnlyClass(c) ? EXPIRY_ACTION_LABELS.report_only : (EXPIRY_ACTION_LABELS[c.expiry_action] ?? c.expiry_action)),
    }),
    createTableColumn({
      columnId: "floor",
      renderHeaderCell: () => "Statutory minimum",
      renderCell: (c) =>
        c.floor_months ? (
          <Badge appearance="tint" color="warning">
            {`Floor ${formatPeriod(c.floor_months)}`}
          </Badge>
        ) : (
          <span className={styles.muted}>None</span>
        ),
    }),
    createTableColumn({ columnId: "auto", renderHeaderCell: () => "Automatic", renderCell: (c) => (c.auto_execute && !isReportOnlyClass(c) ? "Yes" : "No") }),
    createTableColumn({
      columnId: "open",
      renderHeaderCell: () => "",
      renderCell: (c) => {
        const reportOnly = isReportOnlyClass(c);
        return (
          <div className={styles.actions}>
            <Button
              size="small"
              appearance="subtle"
              icon={<Edit20Regular />}
              disabled={reportOnly}
              title={reportOnly ? REPORT_ONLY_EXPLANATION : undefined}
              aria-label={`Edit ${c.label}`}
              onClick={() => setEditing(c)}
            />
            <Button size="small" appearance="subtle" icon={<Eye20Regular />} onClick={() => setPreviewing(c)}>
              Expiry preview
            </Button>
            {!c.is_system && (
              <Button size="small" appearance="subtle" icon={<Archive20Regular />} aria-label={`Archive ${c.label}`} onClick={() => setArchiving(c)} />
            )}
          </div>
        );
      },
    }),
  ];

  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Retention classes</Subtitle2>}
        description={
          <Caption1>
            How long each kind of record is kept and what happens when the period ends. Periods can never be shorter than
            the statutory minimum.
          </Caption1>
        }
        action={
          <Button icon={<Add20Regular />} onClick={() => setEditing("new")}>
            Add class
          </Button>
        }
      />
      <AdminGrid
        items={classes.data ? activeClasses(classes.data) : undefined}
        columns={columns}
        getRowId={(c) => c.id}
        loading={classes.isPending}
        error={classes.error}
        emptyText="No retention classes."
        label="Retention classes"
        sortable
      />
      {editing && <ClassDialog cls={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!archiving}
        title={`Archive ${archiving?.label ?? ""}?`}
        confirmLabel="Archive"
        onClose={() => setArchiving(null)}
        onConfirm={async () => {
          if (!archiving) return;
          try {
            await retentionClassesApi.archive(archiving.id);
            toast.success("Retention class archived");
            await queryClient.invalidateQueries({ queryKey: retentionClassKeys.classes });
          } catch (e) {
            toast.error(retentionClassErrorMessage(e));
            throw e;
          }
        }}
      >
        Records already bound to this class keep their current period. New records cannot use it.
      </ConfirmDialog>
      <ExpiryDrawer cls={previewing} onClose={() => setPreviewing(null)} />
    </Card>
  );
}

const ANCHORS = Object.keys(ANCHOR_LABELS) as RetentionAnchor[];
const ACTIONS: ExpiryAction[] = ["anonymize", "delete", "report_only"];

/** Create (cls = null) or edit a class. The period SpinButton never goes below the statutory floor. */
function ClassDialog({ cls, onClose }: { cls: RetentionClass | null; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [key, setKey] = useState("");
  const [label, setLabel] = useState(cls?.label ?? "");
  const [months, setMonths] = useState<number | null>(cls?.period_months ?? 12);
  const [anchor, setAnchor] = useState<RetentionAnchor>(cls?.anchor ?? "document_date");
  const [action, setAction] = useState<ExpiryAction>(cls?.expiry_action ?? "anonymize");
  const [auto, setAuto] = useState(cls?.auto_execute ?? false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const floor = cls?.floor_months ?? null;
  const pErr = periodError(months, floor);
  const kErr = cls ? null : classKeyError(key);
  const lErr = label.trim() ? null : "Enter a name.";

  const save = useMutation({
    mutationFn: () =>
      cls
        ? retentionClassesApi.update(cls.id, { label: label.trim(), period_months: months!, expiry_action: action, auto_execute: auto })
        : retentionClassesApi.create({ key: key.trim(), label: label.trim(), period_months: months!, anchor, expiry_action: action, auto_execute: auto }),
    onSuccess: async () => {
      toast.success(cls ? "Retention class saved" : "Retention class added");
      await queryClient.invalidateQueries({ queryKey: retentionClassKeys.classes });
      onClose();
    },
    onError: (e) => setError(retentionClassErrorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (pErr || kErr || lErr) return;
            setError(null);
            save.mutate();
          }}
        >
          <DialogBody>
            <DialogTitle>{cls ? `Edit ${cls.label}` : "Add retention class"}</DialogTitle>
            <DialogContent className={styles.form}>
              <ErrorBar message={error} />
              {floor ? (
                <MessageBar intent={months !== null && months < floor ? "error" : "info"} layout="multiline">
                  <MessageBarBody>
                    The statutory minimum for this class is {formatPeriod(floor)}. The period cannot be set below it.
                  </MessageBarBody>
                </MessageBar>
              ) : null}
              {!cls && (
                <Field label="Key" required validationState={touched && kErr ? "error" : "none"} validationMessage={touched ? (kErr ?? undefined) : undefined}>
                  <Input value={key} onChange={(_, d) => setKey(d.value)} maxLength={40} placeholder="e.g. client_contracts" />
                </Field>
              )}
              <Field label="Name" required validationState={touched && lErr ? "error" : "none"} validationMessage={touched ? (lErr ?? undefined) : undefined}>
                <Input value={label} onChange={(_, d) => setLabel(d.value)} maxLength={120} />
              </Field>
              <Field
                label="Keep for (months)"
                required
                hint={floor ? `At least ${floor} months` : undefined}
                validationState={pErr ? "error" : "none"}
                validationMessage={pErr ?? undefined}
              >
                <SpinButton
                  value={months}
                  min={cls ? minPeriod(cls) : 1}
                  max={MAX_PERIOD_MONTHS}
                  onChange={(_, d) => {
                    const v = d.value ?? (d.displayValue !== undefined ? Number(d.displayValue) : null);
                    setMonths(v === null || Number.isNaN(v) ? null : v);
                  }}
                />
              </Field>
              <Field label="Counted from">
                <Dropdown
                  value={ANCHOR_LABELS[anchor]}
                  selectedOptions={[anchor]}
                  disabled={!!cls}
                  onOptionSelect={(_, d) => d.optionValue && setAnchor(d.optionValue as RetentionAnchor)}
                >
                  {ANCHORS.map((a) => (
                    <Option key={a} value={a}>
                      {ANCHOR_LABELS[a]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="When the period ends">
                <Dropdown
                  value={EXPIRY_ACTION_LABELS[action]}
                  selectedOptions={[action]}
                  onOptionSelect={(_, d) => d.optionValue && setAction(d.optionValue as ExpiryAction)}
                >
                  {ACTIONS.map((a) => (
                    <Option key={a} value={a}>
                      {EXPIRY_ACTION_LABELS[a]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Switch
                label="Expire automatically (otherwise an admin reviews the preview and executes it)"
                checked={auto && action !== "report_only"}
                disabled={action === "report_only"}
                onChange={(_, d) => setAuto(d.checked)}
              />
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" disabled={save.isPending} onClick={onClose}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                type="submit"
                disabled={save.isPending || !!pErr}
                icon={save.isPending ? <Spinner size="tiny" /> : undefined}
              >
                Save
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

/** "Expiry preview" drawer: counts by table; Execute needs the typed EXPIRE (report-only classes cannot execute). */
function ExpiryDrawer({ cls, onClose }: { cls: RetentionClass | null; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const preview = useQuery({
    queryKey: ["privacy", "retention", "expiry-preview", cls?.key ?? ""],
    queryFn: () => retentionClassesApi.preview(cls!.key),
    enabled: !!cls,
    gcTime: 0,
    staleTime: Infinity,
  });
  const p: ClassExpiryPreview | undefined = preview.data;
  return (
    <OverlayDrawer position="end" size="medium" open={!!cls} onOpenChange={(_, d) => !d.open && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" icon={<Dismiss24Regular />} aria-label="Close" onClick={onClose} />}>
          Expiry preview{cls ? `: ${cls.label}` : ""}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody className={styles.drawerBody}>
        {preview.isPending ? (
          <Spinner size="small" label="Counting records past their retention period" />
        ) : preview.isError ? (
          <ErrorBar message={retentionClassErrorMessage(preview.error)} />
        ) : p ? (
          <>
            {(p.report_only || (cls && isReportOnlyClass(cls))) && (
              <MessageBar intent="warning" layout="multiline">
                <MessageBarBody>{p.reason || REPORT_ONLY_EXPLANATION}</MessageBarBody>
              </MessageBar>
            )}
            <div>
              <Text className={styles.total}>{p.total.toLocaleString()}</Text>
              <Body1> record(s) are past their retention period.</Body1>
            </div>
            <Table size="small" aria-label="Records by table">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Table</TableHeaderCell>
                  <TableHeaderCell>To expire</TableHeaderCell>
                  <TableHeaderCell>Legal hold</TableHeaderCell>
                  <TableHeaderCell>Override</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.by_table.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>Nothing to expire.</TableCell>
                  </TableRow>
                ) : (
                  p.by_table.map((t) => (
                    <TableRow key={t.table}>
                      <TableCell>{t.table}</TableCell>
                      <TableCell>{t.count.toLocaleString()}</TableCell>
                      <TableCell>{t.skipped_legal_hold.toLocaleString()}</TableCell>
                      <TableCell>{t.skipped_override.toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {p.valid_until && <Caption1 className={styles.muted}>This preview can be executed until {formatDateTime(p.valid_until)}.</Caption1>}
          </>
        ) : null}
      </DrawerBody>
      <DrawerFooter>
        <Button
          appearance="primary"
          icon={<Play20Regular />}
          disabled={!canStartExpiry(p)}
          title={p?.report_only ? REPORT_ONLY_EXPLANATION : undefined}
          onClick={() => setConfirming(true)}
        >
          Execute
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DrawerFooter>
      <TypedConfirmDialog
        open={confirming}
        title={`Expire ${p?.total.toLocaleString() ?? ""} record(s)?`}
        word={EXPIRY_CONFIRM_WORD}
        confirmLabel="Expire"
        errorMessage={retentionClassErrorMessage}
        onClose={() => setConfirming(false)}
        onConfirm={async (typed) => {
          if (!p?.run_id) return;
          await retentionClassesApi.execute(p.run_id, typed);
          toast.success("Expiry run started");
          await queryClient.invalidateQueries({ queryKey: privacyKeys.retentionRuns });
          onClose();
        }}
      >
        <Body1>
          Records under a legal hold or an override are skipped. The rest are{" "}
          {cls?.expiry_action === "delete" ? "deleted" : "anonymized"} permanently. This cannot be undone.
        </Body1>
      </TypedConfirmDialog>
    </OverlayDrawer>
  );
}

function BindingsCard() {
  const styles = useStyles();
  const bindings = useQuery({ queryKey: retentionClassKeys.bindings, queryFn: ({ signal }) => retentionClassesApi.bindings(signal) });
  const columns: TableColumnDefinition<RetentionBinding>[] = [
    createTableColumn({ columnId: "table", compare: (a, b) => a.table.localeCompare(b.table), renderHeaderCell: () => "Table", renderCell: (b) => b.table }),
    createTableColumn({ columnId: "class", compare: (a, b) => a.class_key.localeCompare(b.class_key), renderHeaderCell: () => "Class", renderCell: (b) => b.class_key }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (b) => {
        const badge = bindingBadge(b);
        return (
          <Badge appearance="tint" color={badge.color}>
            {badge.label}
          </Badge>
        );
      },
    }),
  ];
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Bindings</Subtitle2>}
        description={<Caption1>Which retention class governs each kind of stored record. Pending bindings activate when their module ships.</Caption1>}
      />
      <AdminGrid
        items={bindings.data}
        columns={columns}
        getRowId={(b) => `${b.table}:${b.class_key}`}
        loading={bindings.isPending}
        error={bindings.error}
        emptyText="No bindings registered."
        label="Retention bindings"
        sortable
      />
    </Card>
  );
}
