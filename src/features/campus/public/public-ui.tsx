"use client";

import {
  Body1,
  Caption1,
  Card,
  Checkbox,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Select,
  Text,
  tokens,
  typographyStyles,
} from "@fluentui/react-components";
import { CheckmarkCircle48Regular, ErrorCircle48Regular, LockClosed20Regular } from "@fluentui/react-icons";
import { useEffect, useId, useRef } from "react";
import { FileDrop } from "@/features/candidates/file-drop";
import { MarkdownView } from "@/features/privacy/markdown-view";
import type { AnswerValue } from "../logic";
import type { PublicFormField, PublicNotice } from "../types";

export const usePublicStyles = makeStyles({
  page: { minHeight: "100svh", display: "flex", flexDirection: "column", backgroundColor: tokens.colorNeutralBackground3 },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    minHeight: "48px",
    paddingInline: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  brand: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase400, overflowWrap: "anywhere" },
  main: {
    flex: 1,
    width: "100%",
    maxWidth: "680px",
    marginInline: "auto",
    boxSizing: "border-box",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalL}`,
    "@media (max-width: 480px)": { padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalM}` },
  },
  card: {
    padding: tokens.spacingHorizontalXL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    boxSizing: "border-box",
    "@media (max-width: 480px)": { padding: tokens.spacingHorizontalL },
  },
  heading: {
    ...typographyStyles.title2,
    margin: 0,
    overflowWrap: "anywhere",
    ":focus": { outlineStyle: "none" },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}` },
  },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  input: { minHeight: "44px", width: "100%" },
  checkbox: { minHeight: "44px", alignItems: "center" },
  notice: {
    maxHeight: "320px",
    overflowY: "auto",
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  muted: { color: tokens.colorNeutralForeground3 },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    "& button": { minHeight: "44px", minWidth: "160px" },
    "@media (max-width: 480px)": { "& button": { width: "100%" } },
  },
  state: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.spacingVerticalM },
  success: { color: tokens.colorPaletteGreenForeground1 },
  danger: { color: tokens.colorPaletteRedForeground1 },
  qr: {
    alignSelf: "center",
    width: "min(280px, 100%)",
    padding: tokens.spacingHorizontalM,
    backgroundColor: "#ffffff",
    borderRadius: tokens.borderRadiusMedium,
    "& svg": { width: "100%", height: "auto", display: "block" },
  },
  footer: { textAlign: "center", padding: tokens.spacingVerticalL, color: tokens.colorNeutralForeground3 },
  facts: { margin: 0, display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: tokens.spacingHorizontalM, rowGap: tokens.spacingVerticalXS, "& dd": { margin: 0, overflowWrap: "anywhere" }, "& dt": { color: tokens.colorNeutralForeground3 } },
});

/** Page chrome of the public campus pages (outside the app shell). */
export function PublicShell({ tenant, children }: { tenant: string | null | undefined; children: React.ReactNode }) {
  const styles = usePublicStyles();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <LockClosed20Regular aria-hidden />
        <span className={styles.brand}>{tenant || "Talent OS"}</span>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <Caption1>Secure registration page</Caption1>
      </footer>
    </div>
  );
}

/** `<h1>` that takes focus when the screen changes, so screen readers announce it. */
export function Heading({ children, focusKey }: { children: React.ReactNode; focusKey: string }) {
  const styles = usePublicStyles();
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [focusKey]);
  return (
    <h1 ref={ref} tabIndex={-1} className={styles.heading}>
      {children}
    </h1>
  );
}

export function ErrorLive({ message }: { message: string | null }) {
  return (
    <div aria-live="assertive" role="alert">
      {message && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>{message}</MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}

export function StateCard({ title, body, tone, children }: { title: string; body: string; tone: "success" | "error"; children?: React.ReactNode }) {
  const styles = usePublicStyles();
  return (
    <Card className={styles.card}>
      <div className={styles.state} role={tone === "error" ? "alert" : "status"}>
        {tone === "success" ? <CheckmarkCircle48Regular aria-hidden className={styles.success} /> : <ErrorCircle48Regular aria-hidden className={styles.danger} />}
        <Heading focusKey={title}>{title}</Heading>
        <Body1>{body}</Body1>
      </div>
      {children}
    </Card>
  );
}

export function NoticeBox({ notice }: { notice: PublicNotice }) {
  const styles = usePublicStyles();
  const id = useId();
  return (
    <section className={styles.notice} aria-labelledby={id} tabIndex={0}>
      <Text id={id} weight="semibold" block>
        {notice.title}
        {notice.version != null ? ` (version ${notice.version})` : ""}
      </Text>
      <MarkdownView source={notice.body_md} />
    </section>
  );
}

/** One field of the drive's registration form, typed by `field.type`. */
export function DynamicField({
  field,
  value,
  file,
  options,
  error,
  disabled,
  onChange,
  onFile,
}: {
  field: PublicFormField;
  value: AnswerValue;
  file?: File | null;
  options: string[];
  error?: string;
  disabled?: boolean;
  onChange: (v: AnswerValue) => void;
  onFile: (f: File | null) => void;
}) {
  const styles = usePublicStyles();
  const common = {
    label: field.label,
    required: field.required,
    hint: field.help ?? undefined,
    validationState: error ? ("error" as const) : ("none" as const),
    validationMessage: error,
  };
  switch (field.type) {
    case "bool":
      return (
        <Field validationState={common.validationState} validationMessage={error} hint={common.hint}>
          <Checkbox
            className={styles.checkbox}
            label={field.label + (field.required ? " *" : "")}
            checked={value === true}
            disabled={disabled}
            onChange={(_, d) => onChange(Boolean(d.checked))}
          />
        </Field>
      );
    case "select":
      return (
        <Field {...common}>
          <Select className={styles.input} value={typeof value === "string" ? value : ""} disabled={disabled || options.length === 0} onChange={(_, d) => onChange(d.value)}>
            <option value="">{options.length === 0 && field.key === "branch" ? "Choose a program first" : "Choose…"}</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "multiselect": {
      const list = Array.isArray(value) ? value : [];
      return (
        <Field {...common}>
          <div role="group" aria-label={field.label}>
            {options.map((o) => (
              <Checkbox
                key={o}
                className={styles.checkbox}
                label={o}
                checked={list.includes(o)}
                disabled={disabled}
                onChange={(_, d) => onChange(d.checked ? [...list, o] : list.filter((x) => x !== o))}
              />
            ))}
          </div>
        </Field>
      );
    }
    case "file":
      return (
        <Field {...common}>
          <FileDrop
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            title={file ? `Selected: ${file.name}` : "Drop a file here"}
            hint="PDF, Word or image, up to 5 MB."
            buttonLabel={file ? "Choose another file" : "Choose file"}
            disabled={disabled}
            onFiles={([f]) => onFile(f ?? null)}
          />
        </Field>
      );
    case "date":
      return (
        <Field {...common}>
          <Input className={styles.input} type="date" value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(_, d) => onChange(d.value)} />
        </Field>
      );
    case "number":
    case "decimal":
      return (
        <Field {...common}>
          <Input
            className={styles.input}
            inputMode={field.type === "number" ? "numeric" : "decimal"}
            value={typeof value === "string" ? value : value == null ? "" : String(value)}
            disabled={disabled}
            onChange={(_, d) => onChange(d.value)}
          />
        </Field>
      );
    default:
      return (
        <Field {...common}>
          <Input className={styles.input} value={typeof value === "string" ? value : ""} maxLength={2000} disabled={disabled} onChange={(_, d) => onChange(d.value)} />
        </Field>
      );
  }
}
