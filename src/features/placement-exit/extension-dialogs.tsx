"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
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
  Radio,
  RadioGroup,
  Spinner,
  Switch,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Copy20Regular, Dismiss24Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { formatDate } from "@/features/placements/format";
import { useDebounced } from "@/lib/use-debounced";
import { exitApi, exitKeys } from "./api";
import { CHECK_COLORS, exitErrorMessage, humanize, marginText, overridableFails, wizardBlockReason } from "./logic";
import type { CheckResult, ExtensionIn, ExtensionOut, LinkOut, RateUnit } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: tokens.spacingHorizontalM },
  checks: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  check: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
    padding: tokens.spacingVerticalXS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  grow: { flex: 1, minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
  margin: { fontWeight: tokens.fontWeightSemibold },
  url: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  footer: { display: "flex", gap: tokens.spacingHorizontalS, justifyContent: "flex-end" },
});

function detailText(details: Record<string, unknown>): string {
  const msg = details.message;
  if (typeof msg === "string") return msg;
  const parts = Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .map(([k, v]) => `${humanize(k)}: ${String(v)}`);
  return parts.join(" · ");
}

/** pass / warn / fail list; `onRequestException` shows the action on overridable fails. */
export function ChecksPanel({ checks, onRequestException }: { checks: CheckResult[]; onRequestException?: () => void }) {
  const styles = useStyles();
  if (checks.length === 0) return <Caption1 className={styles.muted}>No checks yet.</Caption1>;
  return (
    <ul className={styles.checks} aria-label="Extension checks">
      {checks.map((c) => (
        <li key={c.name} className={styles.check}>
          <Badge appearance="filled" color={CHECK_COLORS[c.status]}>
            {c.status.toUpperCase()}
          </Badge>
          <div className={styles.grow}>
            <Body1>{humanize(c.name)}</Body1>
            {detailText(c.details) && (
              <Caption1 block className={styles.muted}>
                {detailText(c.details)}
              </Caption1>
            )}
          </div>
          {c.status === "fail" && !c.overridable && <Caption1>Not overridable</Caption1>}
          {c.status === "fail" && c.overridable && onRequestException && (
            <Button size="small" onClick={onRequestException}>
              Request exception
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function clean(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

/** Propose-extension wizard (`OverlayDrawer`) with live checks and margin from the preview endpoint. */
export function ProposeExtensionDrawer({
  placementId,
  currentEndDate,
  defaultPoId,
  onClose,
}: {
  placementId: string;
  currentEndDate: string;
  defaultPoId?: string | null;
  onClose: () => void;
}) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [newEndDate, setNewEndDate] = useState("");
  const [rateUnit, setRateUnit] = useState<RateUnit>("hour");
  const [payRate, setPayRate] = useState("");
  const [billRate, setBillRate] = useState("");
  const [vendorRate, setVendorRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [poId, setPoId] = useState(defaultPoId ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ratesEntered = [payRate, billRate, vendorRate].some((v) => v.trim() !== "");
  const body: ExtensionIn = {
    new_end_date: newEndDate,
    segment_effective_from: ratesEntered ? clean(effectiveFrom) : null,
    rate_unit: ratesEntered ? rateUnit : null,
    pay_rate: clean(payRate),
    bill_rate: clean(billRate),
    vendor_rate: clean(vendorRate),
    po_id: clean(poId),
    note: clean(note),
  };
  const debounced = useDebounced(body, 400);
  const form = { currentEndDate, newEndDate, payRate, billRate, vendorRate };
  const formOk = wizardBlockReason(form, { checks: [], margin_amount: null, margin_pct: null, blocking: false }, false) === null;
  const preview = useQuery({
    queryKey: ["placement-exit", "extension-preview", placementId, debounced],
    queryFn: ({ signal }) => exitApi.previewExtension(placementId, debounced, signal),
    enabled: formOk && !!debounced.new_end_date,
    retry: false,
  });
  const stale = JSON.stringify(debounced) !== JSON.stringify(body);
  const blockReason = wizardBlockReason(form, preview.data, preview.isFetching || stale);
  const exceptionNeeded = preview.data ? overridableFails(preview.data.checks).length > 0 : false;

  const submit = useMutation({
    mutationFn: () => exitApi.proposeExtension(placementId, body),
    onSuccess: (ext) => {
      void qc.invalidateQueries({ queryKey: exitKeys.all });
      toast.success(`Extension ${ext.human_id} proposed`);
      onClose();
    },
    onError: (e) => setError(exitErrorMessage(e)),
  });

  return (
    <OverlayDrawer open position="end" size="medium" onOpenChange={(_, d) => !d.open && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle
          action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}
        >
          Propose extension
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <div className={styles.form}>
          <Text>Current end date: {formatDate(currentEndDate)}</Text>
          <Field label="New end date" required>
            <Input type="date" value={newEndDate} min={currentEndDate} onChange={(_, d) => setNewEndDate(d.value)} />
          </Field>
          <Text weight="semibold">New rates (optional)</Text>
          <div className={styles.row}>
            <Field label="Rate unit">
              <Dropdown
                value={humanize(rateUnit)}
                selectedOptions={[rateUnit]}
                onOptionSelect={(_, d) => setRateUnit((d.optionValue as RateUnit) ?? "hour")}
              >
                {(["hour", "day", "month", "fixed"] as const).map((u) => (
                  <Option key={u} value={u}>
                    {humanize(u)}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Effective from">
              <Input type="date" value={effectiveFrom} onChange={(_, d) => setEffectiveFrom(d.value)} />
            </Field>
          </div>
          <div className={styles.row}>
            <Field label="Pay rate">
              <Input inputMode="decimal" value={payRate} onChange={(_, d) => setPayRate(d.value)} />
            </Field>
            <Field label="Bill rate">
              <Input inputMode="decimal" value={billRate} onChange={(_, d) => setBillRate(d.value)} />
            </Field>
            <Field label="Vendor rate">
              <Input inputMode="decimal" value={vendorRate} onChange={(_, d) => setVendorRate(d.value)} />
            </Field>
          </div>
          <Text>
            Margin: <span className={styles.margin}>{marginText(preview.data, ratesEntered)}</span>
          </Text>
          <Field label="Purchase order id" hint="Leave empty to keep the placement's PO.">
            <Input value={poId} onChange={(_, d) => setPoId(d.value)} />
          </Field>
          <Field label="Note">
            <Textarea value={note} onChange={(_, d) => setNote(d.value)} resize="vertical" />
          </Field>
          <Text weight="semibold">Checks</Text>
          {preview.isFetching && <Spinner size="tiny" label="Running checks" />}
          {preview.isError && (
            <MessageBar intent="error">
              <MessageBarBody>{exitErrorMessage(preview.error)}</MessageBarBody>
            </MessageBar>
          )}
          {preview.data && <ChecksPanel checks={preview.data.checks} />}
          {exceptionNeeded && (
            <MessageBar intent="warning">
              <MessageBarBody>
                An overridable check failed. Propose the extension, then use “Request exception” on it before confirming.
              </MessageBarBody>
            </MessageBar>
          )}
          {error && (
            <MessageBar intent="error" role="alert">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}
        </div>
      </DrawerBody>
      <DrawerFooter>
        {blockReason && <Caption1 className={styles.muted}>{blockReason}</Caption1>}
        <Button onClick={onClose}>Cancel</Button>
        <Button
          appearance="primary"
          disabled={blockReason !== null || submit.isPending}
          icon={submit.isPending ? <Spinner size="tiny" /> : undefined}
          onClick={() => {
            setError(null);
            submit.mutate();
          }}
        >
          Propose
        </Button>
      </DrawerFooter>
    </OverlayDrawer>
  );
}

function useExtensionMutation<T>(fn: (v: T) => Promise<unknown>, success: string, onDone: () => void) {
  const qc = useQueryClient();
  const toast = useAppToast();
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: exitKeys.all });
      toast.success(success);
      onDone();
    },
    onError: (e) => setError(exitErrorMessage(e)),
  });
  return { m, error, setError };
}

function SimpleDialog({
  title,
  children,
  primary,
  disabled,
  busy,
  error,
  onPrimary,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  primary: string;
  disabled?: boolean;
  busy?: boolean;
  error: string | null;
  onPrimary: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent className={styles.form}>
            {children}
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
            <Button appearance="primary" disabled={disabled || busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={onPrimary}>
              {primary}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Reason dialog shared by Request exception and Withdraw. */
export function ReasonDialog({
  title,
  primary,
  success,
  run,
  onClose,
  intro,
}: {
  title: string;
  primary: string;
  success: string;
  run: (reason: string) => Promise<unknown>;
  onClose: () => void;
  intro?: string;
}) {
  const [reason, setReason] = useState("");
  const { m, error } = useExtensionMutation((r: string) => run(r), success, onClose);
  return (
    <SimpleDialog
      title={title}
      primary={primary}
      disabled={!reason.trim()}
      busy={m.isPending}
      error={error}
      onPrimary={() => m.mutate(reason.trim())}
      onClose={onClose}
    >
      {intro && <Body1>{intro}</Body1>}
      <Field label="Reason" required>
        <Textarea value={reason} onChange={(_, d) => setReason(d.value)} resize="vertical" />
      </Field>
    </SimpleDialog>
  );
}

/** ★ Confirm (human-only): applies the new end date and rate segment. */
export function ConfirmExtensionDialog({ ext, onClose }: { ext: ExtensionOut; onClose: () => void }) {
  const [letter, setLetter] = useState(ext.send_extension_letter);
  const { m, error } = useExtensionMutation(() => exitApi.confirm(ext.id, letter), `Extension ${ext.human_id} confirmed`, onClose);
  return (
    <SimpleDialog title="Confirm extension" primary="Confirm" busy={m.isPending} error={error} onPrimary={() => m.mutate(undefined)} onClose={onClose}>
      <Body1>
        The placement end date moves from {formatDate(ext.current_end_date)} to <strong>{formatDate(ext.new_end_date)}</strong>
        {ext.rate_segment_id === null && (ext.bill_rate || ext.pay_rate) ? " and a new rate segment is created." : "."} Checks are
        re-run before confirming.
      </Body1>
      <Switch checked={letter} onChange={(_, d) => setLetter(d.checked)} label="Send the extension letter to the worker" />
    </SimpleDialog>
  );
}

/** Record a client response received outside the portal (evidence file required). */
export function RecordResponseDialog({ ext, onClose }: { ext: ExtensionOut; onClose: () => void }) {
  const [decision, setDecision] = useState<"confirm" | "decline">("confirm");
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [letter, setLetter] = useState(false);
  const { m, error } = useExtensionMutation(
    async () => {
      if (!file) throw new Error("no file");
      const uploaded = await exitApi.uploadEvidence(ext.id, file);
      return exitApi.recordResponse(ext.id, {
        decision,
        evidence_file_id: uploaded.file.id,
        comment: comment.trim() || null,
        send_extension_letter: decision === "confirm" ? letter : false,
      });
    },
    "Client response recorded",
    onClose,
  );
  return (
    <SimpleDialog
      title="Record client response"
      primary="Record"
      disabled={!file}
      busy={m.isPending}
      error={error}
      onPrimary={() => m.mutate(undefined)}
      onClose={onClose}
    >
      <RadioGroup value={decision} onChange={(_, d) => setDecision(d.value as "confirm" | "decline")} layout="horizontal">
        <Radio value="confirm" label="Client confirmed" />
        <Radio value="decline" label="Client declined" />
      </RadioGroup>
      <Field label="Evidence (email, signed letter…)" required>
        <input type="file" aria-label="Evidence file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      <Field label="Comment">
        <Textarea value={comment} onChange={(_, d) => setComment(d.value)} resize="vertical" />
      </Field>
      {decision === "confirm" && (
        <Switch checked={letter} onChange={(_, d) => setLetter(d.checked)} label="Send the extension letter to the worker" />
      )}
    </SimpleDialog>
  );
}

/** Issue a Secure Link for the client and show it for copying. */
export function SecureLinkDialog({ title, issue, onClose }: { title: string; issue: () => Promise<LinkOut>; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({ mutationFn: issue, onError: (e) => setError(exitErrorMessage(e)) });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent className={styles.form}>
            {!m.data && <Body1>Create a single-use secure link the client can open without signing in.</Body1>}
            {m.data && (
              <>
                <div className={styles.url}>
                  <Field label="Secure link" className={styles.grow}>
                    <Input readOnly value={m.data.url} />
                  </Field>
                  <Button
                    icon={<Copy20Regular />}
                    onClick={() => {
                      void navigator.clipboard?.writeText(m.data!.url).then(() => toast.success("Link copied"));
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <Caption1>Expires {formatDate(m.data.expires_at)}</Caption1>
              </>
            )}
            {error && (
              <MessageBar intent="error" role="alert">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
            {!m.data && (
              <Button appearance="primary" disabled={m.isPending} onClick={() => m.mutate()}>
                Create link
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export { SimpleDialog, useExtensionMutation };
