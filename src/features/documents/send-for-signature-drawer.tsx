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
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  OverlayDrawer,
  Radio,
  RadioGroup,
  Spinner,
  SpinButton,
  Subtitle2,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDown20Regular, ArrowUp20Regular, Delete20Regular, Dismiss24Regular, Eye20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime } from "@/features/admin/ui";
import { UserPicker } from "@/features/admin/user-picker";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { documentsApi, useDocuments, useInvalidateDocuments, useSignatureRequest, useTemplates } from "./api";
import {
  canCancelRequest,
  eventLabel,
  hasSigner,
  isEmail,
  moveItem,
  ownerMergeRefs,
  removeAt,
  requestErrorMessage,
  requestStatus,
  SIGNER_STATUS_LABELS,
  type SignerDraft,
  templateKindLabel,
  toSignerIns,
} from "./logic";
import type { SignatureRequestOut } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  signers: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  signerRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  signerMain: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  muted: { color: tokens.colorNeutralForeground3 },
  inline: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  grow: { flex: "1 1 180px" },
  preview: { width: "100%", height: "420px", border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium },
  timeline: {
    listStyleType: "none",
    margin: 0,
    padding: 0,
    borderLeft: `${tokens.strokeWidthThick} solid ${tokens.colorNeutralStroke2}`,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  event: { paddingInlineStart: tokens.spacingHorizontalM, display: "flex", flexDirection: "column" },
  footer: { display: "flex", gap: tokens.spacingHorizontalS, justifyContent: "flex-end", flexWrap: "wrap" },
});

let seq = 0;
const nextKey = () => `s${++seq}`;

export type SendForSignatureDrawerProps = {
  open: boolean;
  onClose: () => void;
  ownerKind: string;
  ownerId: string;
  /** Owner display name (e.g. the candidate) for the "This candidate" signer shortcut. */
  ownerName?: string;
  /** Show an existing request (status timeline, Send, Cancel) instead of the create form. */
  requestId?: string | null;
  /** Preselect an existing document version as the source. */
  documentVersionId?: string | null;
};

/** Send a template or an existing document for signature, or follow an existing request. */
export function SendForSignatureDrawer({ open, onClose, ownerKind, ownerId, ownerName, requestId, documentVersionId }: SendForSignatureDrawerProps) {
  const [created, setCreated] = useState<string | null>(null);
  const viewing = requestId ?? created;
  return (
    <OverlayDrawer position="end" size="medium" open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>
          {viewing ? "Signature request" : "Send for signature"}
        </DrawerHeaderTitle>
      </DrawerHeader>
      {viewing ? (
        <RequestView id={viewing} onClose={onClose} />
      ) : (
        <CreateForm
          ownerKind={ownerKind}
          ownerId={ownerId}
          ownerName={ownerName}
          documentVersionId={documentVersionId ?? null}
          onCancel={onClose}
          onCreated={(r) => setCreated(r.id)}
        />
      )}
    </OverlayDrawer>
  );
}

function CreateForm({
  ownerKind,
  ownerId,
  ownerName,
  documentVersionId,
  onCancel,
  onCreated,
}: {
  ownerKind: string;
  ownerId: string;
  ownerName?: string;
  documentVersionId: string | null;
  onCancel: () => void;
  onCreated: (r: SignatureRequestOut) => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const invalidate = useInvalidateDocuments();
  const canSearchUsers = usePermission("user:read");
  const [source, setSource] = useState<"template" | "document">(documentVersionId ? "document" : "template");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(documentVersionId);
  const [title, setTitle] = useState("");
  const [signers, setSigners] = useState<SignerDraft[]>([]);
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [adding, setAdding] = useState<"user" | "email" | null>(null);
  const [extName, setExtName] = useState("");
  const [extEmail, setExtEmail] = useState("");
  const [extError, setExtError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewUrl = useRef<string | null>(null);

  const templates = useTemplates(null, false, source === "template");
  const docs = useDocuments(ownerKind, ownerId, false);
  const usable = (templates.data ?? []).filter((t) => t.current_version_id && !t.archived_at);
  const docOptions = (docs.data ?? []).filter((d) => d.current_version && !d.archived_at);
  const template = usable.find((t) => t.id === templateId) ?? null;
  const doc = docOptions.find((d) => d.current_version?.id === versionId) ?? null;

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );
  const setPreviewBlob = (blob: Blob | null) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = blob ? URL.createObjectURL(blob) : null;
    setPreview(previewUrl.current);
  };

  const previewMut = useMutation({
    mutationFn: (vid: string) => documentsApi.previewVersion(vid),
    onSuccess: (blob) => setPreviewBlob(blob),
  });

  const create = useMutation({
    mutationFn: (send: boolean) =>
      documentsApi.createRequest({
        ...(source === "template" ? { template_id: templateId, merge_refs: ownerMergeRefs(ownerKind, ownerId) } : { document_version_id: versionId }),
        owner: { kind: ownerKind, id: ownerId },
        title: title.trim() || null,
        signers: toSignerIns(signers),
        expires_in_days: expiresInDays,
        send,
      }),
  });

  const addSigner = (s: Omit<SignerDraft, "key">) => {
    if (hasSigner(signers, s)) {
      toast.info(`${s.name || s.email} is already a signer`);
      return false;
    }
    if (signers.length >= 10) {
      toast.error("A request can have at most 10 signers");
      return false;
    }
    setSigners((list) => [...list, { ...s, key: nextKey() }]);
    return true;
  };

  const addExternal = () => {
    if (!extName.trim()) return setExtError("Enter the signer's name.");
    if (!isEmail(extEmail)) return setExtError("Enter a valid email address.");
    if (addSigner({ kind: "contact", name: extName.trim(), email: extEmail.trim() })) {
      setExtName("");
      setExtEmail("");
      setExtError(null);
      setAdding(null);
    }
  };

  const submit = async (send: boolean) => {
    setFormError(null);
    if (source === "template" && !templateId) return setFormError("Choose a template.");
    if (source === "document" && !versionId) return setFormError("Choose a document.");
    if (!signers.length) return setFormError("Add at least one signer.");
    try {
      const r = await create.mutateAsync(send);
      void invalidate();
      toast.success(send ? `Sent ${r.human_id} for signature` : `Saved ${r.human_id} as a draft`);
      onCreated(r);
    } catch (e) {
      setFormError(requestErrorMessage(e, errorMessage(e)));
    }
  };

  return (
    <>
      <DrawerBody>
        <div className={styles.form}>
          <ErrorBar message={formError} />
          <Field label="What to sign">
            <RadioGroup layout="horizontal" value={source} onChange={(_, d) => setSource(d.value as "template" | "document")}>
              <Radio value="template" label="From a template" />
              <Radio value="document" label="An existing document" />
            </RadioGroup>
          </Field>
          {source === "template" ? (
            <Field label="Template" required hint={templates.isError ? "Templates could not be loaded." : "Only templates with a published version are listed."}>
              <Dropdown
                placeholder={templates.isPending ? "Loading…" : "Choose a template"}
                selectedOptions={templateId ? [templateId] : []}
                value={template ? template.name : ""}
                onOptionSelect={(_, d) => {
                  setTemplateId(d.optionValue ?? null);
                  setPreviewBlob(null);
                }}
              >
                {usable.map((t) => (
                  <Option key={t.id} value={t.id} text={t.name}>
                    {t.name} · {templateKindLabel(t.kind)} · v{t.current_version_no}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          ) : (
            <Field label="Document" required>
              <Dropdown
                placeholder={docs.isPending ? "Loading…" : "Choose a document"}
                selectedOptions={versionId ? [versionId] : []}
                value={doc ? doc.title : ""}
                onOptionSelect={(_, d) => setVersionId(d.optionValue ?? null)}
              >
                {docOptions.map((d) => (
                  <Option key={d.id} value={d.current_version?.id ?? d.id} text={d.title} disabled={d.signed}>
                    {d.title} · v{d.current_version?.version_no}
                    {d.signed ? " (already signed)" : ""}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          )}
          {source === "template" && template?.current_version_id && (
            <div className={styles.section}>
              <div>
                <Button
                  icon={previewMut.isPending ? <Spinner size="tiny" /> : <Eye20Regular />}
                  disabled={previewMut.isPending}
                  onClick={() => template.current_version_id && previewMut.mutate(template.current_version_id)}
                >
                  Preview
                </Button>
              </div>
              {previewMut.isError && <ErrorBar title="Could not render the preview." message={errorMessage(previewMut.error)} />}
              {preview && <iframe className={styles.preview} src={preview} title={`Preview of ${template.name}`} />}
              <Caption1 className={styles.muted}>The preview uses sample data; the sent document is filled from this record.</Caption1>
            </div>
          )}
          {source === "document" && doc?.current_version && (
            <iframe className={styles.preview} src={doc.current_version.download_url} title={`Preview of ${doc.title}`} />
          )}
          <Field label="Title (optional)" hint="Shown to signers. Defaults to the template or document title.">
            <Input value={title} maxLength={300} onChange={(_, d) => setTitle(d.value)} />
          </Field>

          <div className={styles.section}>
            <Subtitle2 as="h3">Signers (in signing order)</Subtitle2>
            {signers.length === 0 ? (
              <Body1 className={styles.muted}>No signers yet.</Body1>
            ) : (
              <ol className={styles.signers} aria-label="Signers">
                {signers.map((s, i) => (
                  <li key={s.key} className={styles.signerRow}>
                    <Text weight="semibold">{i + 1}.</Text>
                    <div className={styles.signerMain}>
                      <Text truncate wrap={false}>
                        {s.name || s.email}
                      </Text>
                      <Caption1 className={styles.muted}>
                        {s.kind === "candidate" ? "Candidate" : s.kind === "user" ? "Internal user" : "External"}
                        {s.email ? ` · ${s.email}` : ""}
                      </Caption1>
                    </div>
                    <Button
                      appearance="subtle"
                      icon={<ArrowUp20Regular />}
                      aria-label={`Move ${s.name || s.email} up`}
                      disabled={i === 0}
                      onClick={() => setSigners((l) => moveItem(l, i, -1))}
                    />
                    <Button
                      appearance="subtle"
                      icon={<ArrowDown20Regular />}
                      aria-label={`Move ${s.name || s.email} down`}
                      disabled={i === signers.length - 1}
                      onClick={() => setSigners((l) => moveItem(l, i, 1))}
                    />
                    <Button appearance="subtle" icon={<Delete20Regular />} aria-label={`Remove ${s.name || s.email}`} onClick={() => setSigners((l) => removeAt(l, i))} />
                  </li>
                ))}
              </ol>
            )}
            <div>
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button icon={<Add20Regular />}>Add signer</Button>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    {ownerKind === "candidate" && (
                      <MenuItem onClick={() => addSigner({ kind: "candidate", principal_id: ownerId, name: ownerName ?? "", email: "" })}>
                        {ownerName ? `${ownerName} (this candidate)` : "This candidate"}
                      </MenuItem>
                    )}
                    {canSearchUsers && <MenuItem onClick={() => setAdding("user")}>Someone in your company…</MenuItem>}
                    <MenuItem onClick={() => setAdding("email")}>Someone else by email…</MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
            </div>
            {adding === "user" && (
              <div className={styles.inline}>
                <UserPicker
                  className={styles.grow}
                  label="Internal signer"
                  value={null}
                  excludeIds={signers.filter((s) => s.kind === "user").map((s) => s.principal_id ?? "")}
                  onChange={(id, user) => {
                    if (id && user && addSigner({ kind: "user", principal_id: id, name: user.name ?? "", email: user.email })) setAdding(null);
                  }}
                />
                <Button appearance="subtle" onClick={() => setAdding(null)}>
                  Done
                </Button>
              </div>
            )}
            {adding === "email" && (
              <div className={styles.section}>
                <div className={styles.inline}>
                  <Field className={styles.grow} label="Name" required>
                    <Input value={extName} maxLength={300} onChange={(_, d) => setExtName(d.value)} />
                  </Field>
                  <Field className={styles.grow} label="Email" required>
                    <Input type="email" value={extEmail} maxLength={320} onChange={(_, d) => setExtEmail(d.value)} />
                  </Field>
                </div>
                {extError && (
                  <Caption1 role="alert" style={{ color: tokens.colorPaletteRedForeground1 }}>
                    {extError}
                  </Caption1>
                )}
                <div className={styles.inline}>
                  <Button appearance="primary" onClick={addExternal}>
                    Add
                  </Button>
                  <Button onClick={() => setAdding(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          <Field label="Signers have this many days to sign" hint="1 to 90 days">
            <SpinButton
              value={expiresInDays}
              min={1}
              max={90}
              onChange={(_, d) => {
                const n = d.value ?? Number(d.displayValue);
                if (Number.isFinite(n)) setExpiresInDays(Math.max(1, Math.min(90, Math.round(Number(n)))));
              }}
            />
          </Field>
        </div>
      </DrawerBody>
      <DrawerFooter>
        <div className={styles.footer}>
          <Button appearance="primary" disabled={create.isPending} icon={create.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => submit(true)}>
            Send
          </Button>
          <Button disabled={create.isPending} onClick={() => submit(false)}>
            Save as draft
          </Button>
          <Button appearance="subtle" disabled={create.isPending} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </DrawerFooter>
    </>
  );
}

function RequestView({ id, onClose }: { id: string; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const invalidate = useInvalidateDocuments();
  const q = useSignatureRequest(id);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const send = useMutation({ mutationFn: () => documentsApi.sendRequest(id), onSuccess: () => invalidate() });
  const cancel = useMutation({ mutationFn: () => documentsApi.cancelRequest(id, reason.trim()), onSuccess: () => invalidate() });

  if (q.isPending)
    return (
      <DrawerBody>
        <Spinner label="Loading…" />
      </DrawerBody>
    );
  if (q.isError)
    return (
      <DrawerBody>
        <ErrorBar title="Could not load the request." message={errorMessage(q.error)} />
      </DrawerBody>
    );
  const r = q.data;
  const st = requestStatus(r.status);
  const signerName = (sid: string | null) => r.signers.find((s) => s.id === sid)?.name;

  return (
    <>
      <DrawerBody>
        <div className={styles.form}>
          <div>
            <Text weight="semibold" block>
              {r.title}
            </Text>
            <Caption1 className={styles.muted}>
              {r.human_id} · created {formatDateTime(r.created_at)} · expires {formatDateTime(r.expires_at)}
            </Caption1>
          </div>
          <div>
            <Badge appearance="filled" color={st.color}>
              {st.label}
            </Badge>
            {r.require_otp && (
              <Badge appearance="outline" style={{ marginInlineStart: tokens.spacingHorizontalS }}>
                Email code required
              </Badge>
            )}
          </div>
          {r.cancel_reason && <Body1>Cancelled: {r.cancel_reason}</Body1>}
          <ErrorBar message={send.isError ? errorMessage(send.error) : null} />

          <div className={styles.section}>
            <Subtitle2 as="h3">Signers</Subtitle2>
            <ol className={styles.signers}>
              {[...r.signers]
                .sort((a, b) => a.order - b.order)
                .map((s) => (
                  <li key={s.id} className={styles.signerRow}>
                    <Text weight="semibold">{s.order}.</Text>
                    <div className={styles.signerMain}>
                      <Text truncate wrap={false}>
                        {s.name}
                      </Text>
                      <Caption1 className={styles.muted}>
                        {s.email}
                        {s.signed_at ? ` · signed ${formatDateTime(s.signed_at)}` : ""}
                      </Caption1>
                    </div>
                    <Badge appearance="tint" color={s.status === "signed" ? "success" : s.status === "declined" ? "danger" : "informative"}>
                      {SIGNER_STATUS_LABELS[s.status] ?? s.status}
                    </Badge>
                  </li>
                ))}
            </ol>
          </div>

          <div className={styles.section}>
            <Subtitle2 as="h3">Timeline</Subtitle2>
            {r.events.length === 0 ? (
              <Body1 className={styles.muted}>No events yet.</Body1>
            ) : (
              <ol className={styles.timeline}>
                {[...r.events]
                  .sort((a, b) => a.at.localeCompare(b.at))
                  .map((e, i) => (
                    <li key={`${e.kind}-${e.at}-${i}`} className={styles.event}>
                      <Text>
                        {eventLabel(e.kind)}
                        {signerName(e.signer_id) ? ` · ${signerName(e.signer_id)}` : ""}
                      </Text>
                      <Caption1 className={styles.muted}>{formatDateTime(e.at)}</Caption1>
                    </li>
                  ))}
              </ol>
            )}
          </div>
          {r.status === "completed" && (
            <Caption1 className={styles.muted}>
              Certificate ID: {r.certificate_id}. Anyone can check it at /verify?c={r.certificate_id}
            </Caption1>
          )}
        </div>
      </DrawerBody>
      <DrawerFooter>
        <div className={styles.footer}>
          {r.status === "draft" && (
            <Button
              appearance="primary"
              disabled={send.isPending}
              icon={send.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => send.mutate(undefined, { onSuccess: () => toast.success(`Sent ${r.human_id}`) })}
            >
              Send
            </Button>
          )}
          {canCancelRequest(r.status) && <Button onClick={() => setCancelling(true)}>Cancel request</Button>}
          <Button appearance="subtle" onClick={onClose}>
            Close
          </Button>
        </div>
      </DrawerFooter>
      <Dialog open={cancelling} modalType="alert" onOpenChange={(_, d) => !d.open && !cancel.isPending && setCancelling(false)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Cancel {r.human_id}?</DialogTitle>
            <DialogContent className={styles.form}>
              <Body1>Signers can no longer sign, and anyone already notified is told the request was cancelled.</Body1>
              <ErrorBar message={cancel.isError ? errorMessage(cancel.error) : null} />
              <Field label="Reason" required hint="At least 3 characters; recorded in the audit trail.">
                <Textarea value={reason} maxLength={2000} resize="vertical" onChange={(_, d) => setReason(d.value)} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="primary"
                disabled={reason.trim().length < 3 || cancel.isPending}
                icon={cancel.isPending ? <Spinner size="tiny" /> : undefined}
                onClick={() =>
                  cancel.mutate(undefined, {
                    onSuccess: () => {
                      setCancelling(false);
                      setReason("");
                      toast.success(`Cancelled ${r.human_id}`);
                    },
                  })
                }
              >
                Cancel request
              </Button>
              <Button disabled={cancel.isPending} onClick={() => setCancelling(false)}>
                Keep it
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
