"use client";

import {
  Button,
  Caption1,
  Field,
  Input,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { BracesVariable20Regular, Link20Regular } from "@fluentui/react-icons";
import { useRef } from "react";
import { insertAt, jobLinkToken, MERGE_FIELDS } from "./logic";
import { OptionCombobox } from "./option-combobox";
import type { PickerOption } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  toolbar: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "flex-end" },
  body: { fontFamily: tokens.fontFamilyMonospace, minHeight: "220px" },
  muted: { color: tokens.colorNeutralForeground3 },
  picker: { minWidth: "240px", flex: "1 1 240px", maxWidth: "420px" },
});

export type EmailContent = { subject: string; body_html: string; job_links: { posting_id: string; label: string }[] };

/** Subject + HTML body with a merge-field insert menu and a "Job link" picker (live postings). */
export function EmailContentEditor({
  value,
  onChange,
  postings,
  disabled,
  subjectLabel = "Subject",
  errors,
}: {
  value: EmailContent;
  onChange: (next: EmailContent) => void;
  postings: readonly PickerOption[];
  disabled?: boolean;
  subjectLabel?: string;
  errors?: { subject?: string; body?: string };
}) {
  const styles = useStyles();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insert = (text: string, links = value.job_links) => {
    const el = bodyRef.current;
    const r = insertAt(value.body_html, text, el?.selectionStart ?? null, el?.selectionEnd ?? null);
    onChange({ ...value, body_html: r.value, job_links: links });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(r.caret, r.caret);
    });
  };

  const addJobLink = (o: PickerOption | null) => {
    if (!o) return;
    const existing = value.job_links.findIndex((l) => l.posting_id === o.id);
    if (existing >= 0) return insert(jobLinkToken(existing + 1));
    if (value.job_links.length >= 10) return;
    const links = [...value.job_links, { posting_id: o.id, label: o.name }];
    insert(`<a href="${jobLinkToken(links.length)}">${o.name}</a>`, links);
  };

  return (
    <div className={styles.root}>
      <Field label={subjectLabel} required validationState={errors?.subject ? "error" : "none"} validationMessage={errors?.subject}>
        <Input value={value.subject} maxLength={500} disabled={disabled} onChange={(_, d) => onChange({ ...value, subject: d.value })} />
      </Field>
      <div className={styles.toolbar}>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button icon={<BracesVariable20Regular />} disabled={disabled}>
              Insert merge field
            </Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {MERGE_FIELDS.map((f) => (
                <MenuItem key={f.token} onClick={() => insert(f.token)} secondaryContent={f.token}>
                  {f.label}
                </MenuItem>
              ))}
            </MenuList>
          </MenuPopover>
        </Menu>
        <OptionCombobox
          className={styles.picker}
          label="Job link"
          placeholder="Search live postings"
          options={postings}
          disabled={disabled || value.job_links.length >= 10}
          onChange={addJobLink}
        />
      </div>
      <Field
        label="Body (HTML)"
        required
        validationState={errors?.body ? "error" : "none"}
        validationMessage={errors?.body}
        hint="An unsubscribe link and your footer are added automatically."
      >
        <Textarea
          ref={bodyRef}
          className={styles.body}
          resize="vertical"
          value={value.body_html}
          disabled={disabled}
          onChange={(_, d) => onChange({ ...value, body_html: d.value })}
        />
      </Field>
      {value.job_links.length > 0 && (
        <Caption1 className={styles.muted}>
          <Link20Regular aria-hidden style={{ verticalAlign: "middle" }} /> Job links:{" "}
          {value.job_links.map((l, i) => `${i + 1}. ${l.label}`).join(", ")}. Clicks are tracked and applications are attributed.
        </Caption1>
      )}
    </div>
  );
}
