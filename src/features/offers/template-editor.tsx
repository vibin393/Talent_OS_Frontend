"use client";

import {
  Button,
  Caption1,
  Field,
  Input,
  makeStyles,
  Menu,
  MenuGroup,
  MenuGroupHeader,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Spinner,
  Switch,
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { BracesVariable20Regular, DocumentPdf20Regular } from "@fluentui/react-icons";
import { useRef, useState } from "react";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { offersApi } from "./api";
import { EMPLOYMENT_TYPES, employmentLabel } from "./format";
import { insertAt, mergeToken, templateFieldError, unknownFields } from "./template";
import type { EmploymentType, MergeFieldOut, OfferTemplateOut } from "./types";
import { useBlobUrl } from "./use-letter-preview";
import { useMergeFields, useSaveOfferTemplate } from "./use-offer-templates";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  body: { fontFamily: tokens.fontFamilyMonospace, minHeight: "360px" },
  bar: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  frame: { width: "100%", height: "60vh", border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium },
  muted: { color: tokens.colorNeutralForeground3 },
});

function groupFields(fields: readonly MergeFieldOut[]): [string, MergeFieldOut[]][] {
  const groups = new Map<string, MergeFieldOut[]>();
  for (const f of fields) {
    const g = f.key.includes(".") ? f.key.split(".")[0] : "general";
    groups.set(g, [...(groups.get(g) ?? []), f]);
  }
  return [...groups.entries()];
}

/**
 * Offer letter template editor: Markdown body with an "Insert field" menu of whitelisted merge fields, employment
 * types, a sample-data PDF preview, and the server's 422 `unknown_merge_field` shown inline.
 */
export function TemplateEditor({ template, onClose }: { template: OfferTemplateOut | null; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const fields = useMergeFields();
  const save = useSaveOfferTemplate();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState(template?.name ?? "");
  const [types, setTypes] = useState<EmploymentType[]>((template?.employment_types ?? []) as EmploymentType[]);
  const [body, setBody] = useState(template?.body_md ?? "# Offer of employment\n\nDear {{ candidate.first_name }},\n\n");
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<Blob | undefined>(undefined);
  const [previewing, setPreviewing] = useState(false);
  const previewUrl = useBlobUrl(pdf);
  const allowed = (fields.data ?? []).map((f) => f.key);
  const unknown = fields.data ? unknownFields(body, allowed) : [];

  const insert = (key: string) => {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const r = insertAt(body, start, end, mergeToken(key));
    setBody(r.text);
    setFieldError(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(r.caret, r.caret);
    });
  };

  const handleError = (e: unknown) => {
    const f = templateFieldError(e);
    if (f) setFieldError(f);
    else setError(errorMessage(e));
  };

  const preview = async () => {
    setError(null);
    setFieldError(null);
    setPreviewing(true);
    try {
      setPdf(await offersApi.templatePreview(body));
    } catch (e) {
      handleError(e);
    } finally {
      setPreviewing(false);
    }
  };

  const submit = async () => {
    setError(null);
    setFieldError(null);
    if (!name.trim()) return setError("Name the template.");
    if (!body.trim()) return setFieldError("Write the letter body.");
    try {
      await save.mutateAsync({ id: template?.id ?? null, body: { name: name.trim(), employment_types: types, body_md: body, is_default: isDefault } });
      toast.success(template ? "Template saved" : "Template created");
      onClose();
    } catch (e) {
      handleError(e);
    }
  };

  return (
    <DetailsDrawer
      open
      size="large"
      title={template ? `Edit template · ${template.name}` : "New offer letter template"}
      onClose={onClose}
      footer={
        <>
          <Button appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
            Save template
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </>
      }
    >
      <div className={styles.form}>
        {error && (
          <MessageBar intent="error" role="alert">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
        <Field label="Name" required>
          <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Employment types" hint="Leave empty to offer it for every employment type.">
          <TagPicker
            selectedOptions={types}
            onOptionSelect={(_, d) => {
              const v = d.value as EmploymentType;
              setTypes((t) => (t.includes(v) ? t.filter((x) => x !== v) : [...t, v]));
            }}
          >
            <TagPickerControl>
              <TagPickerGroup aria-label="Selected employment types">
                {types.map((t) => (
                  <Tag key={t} value={t} shape="rounded">
                    {employmentLabel(t)}
                  </Tag>
                ))}
              </TagPickerGroup>
              <TagPickerInput aria-label="Employment types" />
            </TagPickerControl>
            <TagPickerList>
              {EMPLOYMENT_TYPES.filter((t) => !types.includes(t.value)).map((t) => (
                <TagPickerOption key={t.value} value={t.value} text={t.label}>
                  {t.label}
                </TagPickerOption>
              ))}
            </TagPickerList>
          </TagPicker>
        </Field>
        <Switch label="Default template for these employment types" checked={isDefault} onChange={(_, d) => setIsDefault(d.checked)} />
        <div className={styles.bar}>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button icon={<BracesVariable20Regular />} disabled={!fields.data}>
                Insert field
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {groupFields(fields.data ?? []).map(([group, list]) => (
                  <MenuGroup key={group}>
                    <MenuGroupHeader>{group}</MenuGroupHeader>
                    {list.map((f) => (
                      <MenuItem key={f.key} secondaryContent={f.example} onClick={() => insert(f.key)}>
                        {f.label}
                      </MenuItem>
                    ))}
                  </MenuGroup>
                ))}
              </MenuList>
            </MenuPopover>
          </Menu>
          <Button icon={previewing ? <Spinner size="tiny" /> : <DocumentPdf20Regular />} disabled={previewing} onClick={preview}>
            Preview PDF
          </Button>
        </div>
        <Field
          label="Letter body (Markdown)"
          required
          validationState={fieldError || unknown.length ? "error" : "none"}
          validationMessage={fieldError ?? (unknown.length ? `Not allowed: ${unknown.join(", ")}` : undefined)}
          hint="Headings (#), **bold**, *italic* and bullet lists. Bill rate, margin and burden are never available."
        >
          <Textarea
            ref={bodyRef}
            className={styles.body}
            value={body}
            resize="vertical"
            maxLength={50000}
            onChange={(_, d) => {
              setBody(d.value);
              setFieldError(null);
            }}
          />
        </Field>
        {previewUrl && <iframe className={styles.frame} src={previewUrl} title="Template preview with sample data" />}
        {!previewUrl && <Caption1 className={styles.muted}>Preview renders the letter with sample data.</Caption1>}
      </div>
    </DetailsDrawer>
  );
}
