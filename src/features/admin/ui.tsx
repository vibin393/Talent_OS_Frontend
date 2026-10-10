"use client";

import {
  Body1,
  Button,
  Card,
  CardHeader,
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
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  OverlayDrawer,
  Skeleton,
  SkeletonItem,
  Spinner,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ChevronLeft20Regular, ChevronRight20Regular, Dismiss24Regular, LockClosed24Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { pageRange } from "./query";

export const useAdminStyles = makeStyles({
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
  },
  grow: { flex: 1 },
  filter: { minWidth: "160px" },
  search: { minWidth: "220px", flex: "1 1 220px", maxWidth: "360px" },
  surface: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    overflowX: "auto",
  },
  grid: { minWidth: "720px" },
  cellStack: { display: "flex", flexDirection: "column", minWidth: 0, paddingBlock: tokens.spacingVerticalXS },
  muted: { color: tokens.colorNeutralForeground3 },
  truncate: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  badges: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  empty: { padding: tokens.spacingHorizontalXXL, textAlign: "center", color: tokens.colorNeutralForeground3 },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  sectionTitle: { marginTop: tokens.spacingVerticalL, marginBottom: tokens.spacingVerticalS },
  footer: { display: "flex", gap: tokens.spacingHorizontalS, justifyContent: "flex-end" },
  detailList: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0, minWidth: 0, overflowWrap: "anywhere" },
  },
});

/** Inline error from a failed request (the admin area's server-error surface). */
export function ErrorBar({ message, title }: { message: string | null | undefined; title?: string }) {
  if (!message) return null;
  return (
    <MessageBar intent="error" layout="multiline" role="alert">
      <MessageBarBody>
        {title && <strong>{title} </strong>}
        {message}
      </MessageBarBody>
    </MessageBar>
  );
}

/** Card shown when the user lacks the permission for a page. */
export function NoAccess({ what }: { what: string }) {
  return (
    <Card style={{ maxWidth: 560 }}>
      <CardHeader
        image={<LockClosed24Regular aria-hidden />}
        header={<Subtitle2 as="h2">No access</Subtitle2>}
        description={<Body1>You do not have permission to view {what}. Ask a tenant admin for access.</Body1>}
      />
    </Card>
  );
}

export function GridSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Skeleton aria-label="Loading" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonItem key={i} size={24} />
      ))}
    </Skeleton>
  );
}

/** "1-20 of 45" with previous/next buttons. */
export function PagingBar({
  page,
  pageSize,
  total,
  onPageChange,
  busy,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  busy?: boolean;
}) {
  const { from, to, pageCount } = pageRange(page, pageSize, total);
  return (
    <div
      style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "8px 12px" }}
      aria-label="Pagination"
      role="navigation"
    >
      {busy && <Spinner size="extra-tiny" aria-label="Loading" />}
      <Text size={200} aria-live="polite">
        {total === 0 ? "No items" : `${from}–${to} of ${total}`}
      </Text>
      <Button
        appearance="subtle"
        icon={<ChevronLeft20Regular />}
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      />
      <Button
        appearance="subtle"
        icon={<ChevronRight20Regular />}
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      />
    </div>
  );
}

export type IdOption = { id: string; label: string };

const NONE = "__none__";

/** Single-select `Dropdown` over ids with an optional "None"/"All" entry mapped to `null`. */
export function IdSelect({
  label,
  options,
  value,
  onChange,
  noneLabel,
  disabled,
  hint,
  className,
}: {
  label: string;
  options: readonly IdOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  noneLabel?: string;
  disabled?: boolean;
  hint?: string;
  className?: string;
}) {
  const selected = options.find((o) => o.id === value);
  const text = selected?.label ?? (value === null ? (noneLabel ?? "") : "");
  return (
    <Field label={label} hint={hint} className={className}>
      <Dropdown
        value={text}
        selectedOptions={[value ?? NONE]}
        disabled={disabled}
        onOptionSelect={(_, data) => onChange(data.optionValue === NONE || !data.optionValue ? null : data.optionValue)}
      >
        {noneLabel !== undefined && <Option value={NONE}>{noneLabel}</Option>}
        {options.map((o) => (
          <Option key={o.id} value={o.id}>
            {o.label}
          </Option>
        ))}
      </Dropdown>
    </Field>
  );
}

/** Multi-select `Dropdown` over ids. */
export function IdMultiSelect({
  label,
  options,
  value,
  onChange,
  disabled,
  hint,
  required,
  validationMessage,
  placeholder,
}: {
  label: string;
  options: readonly IdOption[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  hint?: string;
  required?: boolean;
  validationMessage?: string;
  placeholder?: string;
}) {
  const text = options
    .filter((o) => value.includes(o.id))
    .map((o) => o.label)
    .join(", ");
  return (
    <Field
      label={label}
      hint={hint}
      required={required}
      validationState={validationMessage ? "error" : "none"}
      validationMessage={validationMessage}
    >
      <Dropdown
        multiselect
        value={text}
        placeholder={placeholder}
        selectedOptions={[...value]}
        disabled={disabled}
        onOptionSelect={(_, data) => onChange(data.selectedOptions)}
      >
        {options.map((o) => (
          <Option key={o.id} value={o.id}>
            {o.label}
          </Option>
        ))}
      </Dropdown>
    </Field>
  );
}

/** Confirmation `Dialog`; `onConfirm` may be async (the dialog stays open and busy until it settles). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && !busy && onClose()} modalType="alert">
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>{children}</DialogContent>
          <DialogActions>
            <Button appearance="secondary" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={busy}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  onClose();
                } catch {
                  // The caller reports the error (toast); keep the dialog open to retry or cancel.
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Right-side details panel in the style of the Microsoft 365 admin center. */
export function DetailsDrawer({
  open,
  title,
  onClose,
  children,
  footer,
  size = "medium",
}: {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "small" | "medium" | "large";
}) {
  return (
    <OverlayDrawer position="end" size={size} open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle
          action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}
        >
          {title}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>{children}</DrawerBody>
      {footer && <DrawerFooter>{footer}</DrawerFooter>}
    </OverlayDrawer>
  );
}

/** Format an ISO timestamp for display in the user's locale. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
