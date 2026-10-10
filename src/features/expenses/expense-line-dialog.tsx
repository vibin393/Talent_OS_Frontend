"use client";

import {
  Badge,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Link as FluentLink,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Switch,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Camera20Regular, DocumentArrowUp20Regular, Sparkle20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { usePortalStyles } from "@/features/portal/ui";
import { errorMessage } from "@/lib/api/errors";
import { useDebounced } from "@/lib/use-debounced";
import {
  applySuggestion,
  buildLineIn,
  CATEGORY_LABELS,
  codeLabel,
  convertedAmount,
  displayAmount,
  expenseErrorMessage,
  flagLabel,
  isoDate,
  justificationError,
  needsJustification,
  suggestionHint,
  type SuggestedField,
} from "./format";
import { isValidAmountInput } from "./money";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type LineIn,
  type LinePreviewOut,
  type ReceiptReadOut,
  type ReceiptUploadOut,
  type WorkerLine,
} from "./types";

const useStyles = makeStyles({
  surface: {
    width: "min(560px, 100%)",
    "@media (max-width: 600px)": {
      width: "100vw",
      maxWidth: "100vw",
      height: "100dvh",
      maxHeight: "100dvh",
      borderRadius: 0,
      paddingLeft: tokens.spacingHorizontalL,
      paddingRight: tokens.spacingHorizontalL,
    },
  },
  receipt: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} dashed ${tokens.colorNeutralStroke1}`,
  },
  hidden: { display: "none" },
  row: { display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: tokens.spacingHorizontalS },
  readonly: { fontVariantNumeric: "tabular-nums" },
  suggested: { "& .fui-Field__hint": { color: tokens.colorPaletteMarigoldForeground2 } },
});

export type LineDialogProps = {
  title: string;
  claimId: string;
  claimCurrency: string;
  minDate?: string | null;
  maxDate?: string | null;
  initial?: WorkerLine | null;
  onClose: () => void;
  preview: (body: LineIn) => Promise<LinePreviewOut>;
  save: (body: LineIn) => Promise<unknown>;
  /** Receipt upload (Worker portal). Omit to hide the receipt section. */
  upload?: (file: File) => Promise<ReceiptUploadOut>;
  /** AI receipt read — pass only when `ai_receipt_read_enabled`. */
  readReceipt?: (fileId: string) => Promise<ReceiptReadOut>;
  receiptUrl?: (fileId: string) => string;
  maxReceiptMb?: number;
  allowedTypes?: string[];
};

type Form = {
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  currency: string;
  km: string;
  receipt_file_id: string | null;
  billable: boolean | null;
  justification: string;
};

/** "Add / edit expense" dialog (full screen on phones): receipt, AI suggestions, server preview, flags + justification. */
export function ExpenseLineDialog(p: LineDialogProps) {
  const styles = useStyles();
  const portal = usePortalStyles();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Form>(() => ({
    expense_date: p.initial?.expense_date ?? isoDate(0),
    category: p.initial?.category ?? "travel",
    description: p.initial?.description ?? "",
    amount: p.initial && p.initial.category !== "mileage" ? p.initial.amount : "",
    currency: p.initial?.currency ?? p.claimCurrency,
    km: p.initial?.km ?? "",
    receipt_file_id: p.initial?.receipt_file_id ?? null,
    billable: p.initial ? p.initial.billable : null,
    justification: p.initial?.justification ?? "",
  }));
  const [receiptName, setReceiptName] = useState<string | null>(p.initial?.receipt_name ?? null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<SuggestedField[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    // editing a suggested field means the Worker checked it
    setSuggested((s) => s.filter((x) => x !== k));
  };

  const mileage = form.category === "mileage";
  const body = buildLineIn(form);
  const amountOk = mileage ? isValidAmountInput(form.km) : isValidAmountInput(form.amount);
  const currencyOk = mileage || /^[A-Za-z]{3}$/.test(form.currency.trim());
  const canPreview = /^\d{4}-\d{2}-\d{2}$/.test(form.expense_date) && amountOk && currencyOk;
  const debounced = useDebounced(JSON.stringify({ ...body, justification: null }), 400);
  const preview = useQuery({
    queryKey: ["expenses", "line-preview", p.claimId, debounced],
    queryFn: () => p.preview(JSON.parse(debounced) as LineIn),
    enabled: canPreview,
    retry: false,
    staleTime: 30_000,
  });
  const pv = canPreview ? preview.data : undefined;
  const flagged = pv ? needsJustification(pv) : !!p.initial && p.initial.flags.length > 0;
  const justErr = justificationError(flagged, form.justification);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setReadNote(null);
    if (p.maxReceiptMb && file.size > p.maxReceiptMb * 1024 * 1024) {
      setUploadError(`The file is larger than ${p.maxReceiptMb} MB.`);
      return;
    }
    if (p.allowedTypes?.length && file.type && !p.allowedTypes.includes(file.type)) {
      setUploadError(codeLabel("receipt_type_unsupported"));
      return;
    }
    if (!p.upload) return;
    setUploading(true);
    try {
      const out = await p.upload(file);
      setForm((f) => ({ ...f, receipt_file_id: out.file_id }));
      setReceiptName(out.original_name);
      setScanStatus(out.scan_status);
    } catch (e) {
      setUploadError(expenseErrorMessage(e, errorMessage));
    } finally {
      setUploading(false);
    }
  };

  const onRead = async () => {
    if (!p.readReceipt || !form.receipt_file_id) return;
    setReading(true);
    setReadNote(null);
    try {
      const out = await p.readReceipt(form.receipt_file_id);
      const applied = out.ok ? applySuggestion(out.suggestion) : { values: {}, suggested: [] };
      if (!applied.suggested.length) {
        setReadNote("We couldn't read this receipt. Please enter the details yourself.");
      } else {
        setForm((f) => ({ ...f, ...applied.values, category: (applied.values.category as ExpenseCategory | undefined) ?? f.category }));
        setSuggested(applied.suggested);
        setReadNote("We filled in what we could read. Please check every suggested field before saving.");
      }
    } catch {
      setReadNote("We couldn't read this receipt. Please enter the details yourself.");
    } finally {
      setReading(false);
    }
  };

  const onSave = async () => {
    setTouched(true);
    if (!canPreview || justErr) return;
    setSaving(true);
    setSaveError(null);
    try {
      await p.save(body);
      p.onClose();
    } catch (e) {
      setSaveError(expenseErrorMessage(e, errorMessage));
    } finally {
      setSaving(false);
    }
  };

  const fieldProps = (f: SuggestedField) => {
    const hint = suggestionHint(f, suggested);
    return { hint, className: hint ? styles.suggested : undefined };
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !saving && p.onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>{p.title}</DialogTitle>
          <DialogContent className={portal.form}>
            {p.upload && (
              <div className={styles.receipt}>
                <Text weight="semibold">Receipt</Text>
                <input
                  ref={cameraRef}
                  className={styles.hidden}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    void onFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={fileRef}
                  className={styles.hidden}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    void onFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <div className={portal.actions}>
                  <Button className={portal.button} icon={<Camera20Regular />} disabled={uploading} onClick={() => cameraRef.current?.click()}>
                    Take photo
                  </Button>
                  <Button
                    className={portal.button}
                    icon={<DocumentArrowUp20Regular />}
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {form.receipt_file_id ? "Replace file" : "Choose file"}
                  </Button>
                  {p.readReceipt && form.receipt_file_id && (
                    <Button
                      className={portal.button}
                      appearance="subtle"
                      icon={reading ? <Spinner size="tiny" /> : <Sparkle20Regular />}
                      disabled={reading || uploading}
                      onClick={() => void onRead()}
                    >
                      Read receipt
                    </Button>
                  )}
                </div>
                {uploading && <Spinner size="tiny" labelPosition="after" label="Uploading and scanning…" />}
                {form.receipt_file_id && !uploading && (
                  <div className={portal.actions}>
                    {p.receiptUrl ? (
                      <FluentLink href={p.receiptUrl(form.receipt_file_id)} target="_blank" rel="noopener noreferrer">
                        {receiptName ?? "View receipt"}
                      </FluentLink>
                    ) : (
                      <Caption1>{receiptName ?? "Receipt attached"}</Caption1>
                    )}
                    {scanStatus && (
                      <Badge appearance="tint" color={scanStatus === "clean" || scanStatus === "skipped_dev" ? "success" : "warning"}>
                        {scanStatus === "clean" ? "Scanned" : scanStatus.replace(/_/g, " ")}
                      </Badge>
                    )}
                    <Button appearance="subtle" size="small" onClick={() => set("receipt_file_id", null)}>
                      Remove
                    </Button>
                  </div>
                )}
                {readNote && (
                  <MessageBar intent="info" layout="multiline">
                    <MessageBarBody>{readNote}</MessageBarBody>
                  </MessageBar>
                )}
                {uploadError && (
                  <MessageBar intent="error" layout="multiline" role="alert">
                    <MessageBarBody>{uploadError}</MessageBarBody>
                  </MessageBar>
                )}
              </div>
            )}

            <Field label="Date" required {...fieldProps("expense_date")}>
              <Input
                type="date"
                className={portal.input}
                value={form.expense_date}
                min={p.minDate ?? undefined}
                max={p.maxDate ?? undefined}
                onChange={(_, d) => set("expense_date", d.value)}
              />
            </Field>
            <Field label="Category" required {...fieldProps("category")}>
              <Dropdown
                className={portal.input}
                value={CATEGORY_LABELS[form.category]}
                selectedOptions={[form.category]}
                onOptionSelect={(_, d) => d.optionValue && set("category", d.optionValue as ExpenseCategory)}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <Option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Description" {...fieldProps("description")}>
              <Input className={portal.input} value={form.description} maxLength={500} onChange={(_, d) => set("description", d.value)} />
            </Field>

            {mileage ? (
              <>
                <Field
                  label="Distance (km)"
                  required
                  validationMessage={touched && !amountOk ? "Enter the distance, e.g. 37.5" : undefined}
                >
                  <Input className={portal.input} inputMode="decimal" value={form.km} onChange={(_, d) => set("km", d.value)} />
                </Field>
                <Field label="Amount" hint="Calculated from the policy rate per km">
                  <Text className={styles.readonly} weight="semibold" aria-live="polite">
                    {preview.isFetching && !pv ? "Calculating…" : displayAmount("mileage", "", "", pv)}
                  </Text>
                </Field>
              </>
            ) : (
              <div className={styles.row}>
                <Field
                  label="Amount"
                  required
                  validationMessage={touched && !amountOk ? "Enter an amount, e.g. 450.00" : undefined}
                  {...fieldProps("amount")}
                >
                  <Input className={portal.input} inputMode="decimal" value={form.amount} onChange={(_, d) => set("amount", d.value)} />
                </Field>
                <Field
                  label="Currency"
                  required
                  validationMessage={touched && !currencyOk ? "3 letters" : undefined}
                  {...fieldProps("currency")}
                >
                  <Input
                    className={portal.input}
                    value={form.currency}
                    maxLength={3}
                    onChange={(_, d) => set("currency", d.value.toUpperCase())}
                  />
                </Field>
              </div>
            )}
            {convertedAmount(pv) && <Caption1>Converted: {convertedAmount(pv)}</Caption1>}
            {preview.isError && canPreview && (
              <MessageBar intent="error" layout="multiline">
                <MessageBarBody>{expenseErrorMessage(preview.error, errorMessage)}</MessageBarBody>
              </MessageBar>
            )}

            <Switch
              label="Billable to the client"
              checked={form.billable ?? pv?.billable ?? false}
              onChange={(_, d) => set("billable", d.checked)}
            />

            {flagged && (
              <MessageBar intent="warning" layout="multiline">
                <MessageBarBody>
                  {(pv?.flags ?? p.initial?.flags ?? []).map(flagLabel).join(" · ") || "This expense needs a justification."}
                  {pv?.receipt_required && !form.receipt_file_id ? " · A receipt is required for this amount." : ""}
                </MessageBarBody>
              </MessageBar>
            )}
            {flagged && (
              <Field label="Justification" required validationMessage={touched ? justErr : undefined}>
                <Textarea value={form.justification} maxLength={2000} onChange={(_, d) => set("justification", d.value)} />
              </Field>
            )}
            {saveError && (
              <MessageBar intent="error" layout="multiline" role="alert">
                <MessageBarBody>{saveError}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button className={portal.button} disabled={saving} onClick={p.onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              className={portal.button}
              disabled={saving || uploading}
              icon={saving ? <Spinner size="tiny" /> : undefined}
              onClick={() => void onSave()}
            >
              Save expense
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
