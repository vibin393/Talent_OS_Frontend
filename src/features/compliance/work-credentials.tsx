"use client";

import { Badge, Body1, Button, Caption1, Card, Dropdown, Field, Input, MessageBar, MessageBarBody, Option, Subtitle2, tokens, makeStyles } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { errorMessage } from "@/lib/api/errors";
import { AadhaarCapture } from "./aadhaar-capture";
import { workCredentialsApi, workCredentialsKeys } from "./api";
import { credentialBadge, formatDate, maskedNumber, numberError } from "./logic";
import type { CredentialForm, PortalCredential, PortalCredentialType } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: tokens.spacingHorizontalS },
});

function CredentialFields({
  type,
  renewOf,
  onDone,
}: {
  type: PortalCredentialType;
  renewOf?: PortalCredential;
  onDone: () => void;
}) {
  const s = useStyles();
  const qc = useQueryClient();
  const [number, setNumber] = useState("");
  const [issued, setIssued] = useState("");
  const [expires, setExpires] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  const m = useMutation({
    mutationFn: (input: CredentialForm) =>
      renewOf ? workCredentialsApi.renew(renewOf.id, input) : workCredentialsApi.record(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: workCredentialsKeys.list });
      onDone();
    },
  });

  if (type.number_kind === "aadhaar_last4") {
    return (
      <>
        <AadhaarCapture
          busy={m.isPending}
          imageOptional={!type.requires_document}
          onSubmit={({ last4, image }) =>
            m.mutateAsync({ type_key: type.key, number: last4, file: image, filename: "aadhaar-redacted.jpg" }).catch(() => undefined)
          }
        />
        <InlineError message={m.isError ? errorMessage(m.error) : null} />
      </>
    );
  }
  const numErr = renewOf && !number ? null : numberError(type.number_kind, type.key, number);
  const expErr = type.has_expiry && !expires ? "Enter the expiry date." : null;
  const fileErr = type.requires_document && !file ? "Add a photo or scan of the document." : null;
  return (
    <div className={s.form}>
      {type.number_kind !== "none" && (
        <Field label="Document number" required={!renewOf} validationMessage={touched ? numErr ?? undefined : undefined} hint={renewOf ? "Leave empty to keep the same number." : undefined}>
          <Input value={number} autoComplete="off" onChange={(_, d) => setNumber(d.value)} />
        </Field>
      )}
      <div className={s.grid}>
        <Field label="Issued on">
          <Input type="date" value={issued} onChange={(_, d) => setIssued(d.value)} />
        </Field>
        {type.has_expiry && (
          <Field label="Expires on" required validationMessage={touched ? expErr ?? undefined : undefined}>
            <Input type="date" value={expires} onChange={(_, d) => setExpires(d.value)} />
          </Field>
        )}
      </div>
      <Field label="Photo or scan" required={type.requires_document} validationMessage={touched ? fileErr ?? undefined : undefined}>
        <input type="file" accept="image/*,application/pdf" capture="environment" aria-label="Take or choose a photo" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      <InlineError message={m.isError ? errorMessage(m.error) : null} />
      <div>
        <Button
          appearance="primary"
          disabled={m.isPending}
          onClick={() => {
            setTouched(true);
            if (numErr || expErr || fileErr) return;
            m.mutate({ type_key: type.key, number: number || undefined, issued_on: issued || undefined, expires_on: expires || undefined, file });
          }}
        >
          {renewOf ? "Upload renewal" : "Save credential"}
        </Button>
      </div>
    </div>
  );
}

/** `/portal/work/credentials`: the Worker's credentials (last 4 digits only), what current placements still need,
 * an expiring banner, add and renew forms (camera upload; Aadhaar through the redaction tool). From 360 px. */
export function WorkCredentials() {
  const portal = usePortalStyles();
  const q = useQuery({ queryKey: workCredentialsKeys.list, queryFn: ({ signal }) => workCredentialsApi.list(signal), retry: false });
  const [adding, setAdding] = useState<string | null>(null);
  const [renewing, setRenewing] = useState<PortalCredential | null>(null);
  if (q.isPending) return <LoadingBlock label="Loading your credentials" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const typeOf = (key: string) => d.types.find((t) => t.key === key);
  const addType = adding ? typeOf(adding) : undefined;
  const renewType = renewing ? typeOf(renewing.type_key) : undefined;
  return (
    <div className={portal.page}>
      <PortalPageHeader title="My credentials" subtitle="Passports, visas, licences and other documents your placements need." />
      {d.expiring_soon > 0 && (
        <MessageBar intent="warning">
          <MessageBarBody>
            {d.expiring_soon === 1 ? "One credential expires soon or has expired." : `${d.expiring_soon} credentials expire soon or have expired.`} Upload the renewed document.
          </MessageBarBody>
        </MessageBar>
      )}
      {d.needed.length > 0 && (
        <Card className={portal.card}>
          <Subtitle2>Needed for your placements</Subtitle2>
          <ul className={portal.list}>
            {d.needed.map((n) => (
              <li key={`${n.kind}:${n.label}`} className={portal.row}>
                <Body1>{n.label}</Body1>
                {n.type_key && typeOf(n.type_key) && (
                  <Button size="small" onClick={() => setAdding(n.type_key)}>
                    Add
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className={portal.card}>
        <Subtitle2>Your credentials</Subtitle2>
        {d.credentials.length === 0 ? (
          <Body1 className={portal.empty}>You have not added any credentials yet.</Body1>
        ) : (
          <ul className={portal.list}>
            {d.credentials.map((c) => {
              const b = credentialBadge(c.status);
              return (
                <li key={c.id} className={portal.row}>
                  <div className={portal.rowMain}>
                    <Body1>{c.type_label}</Body1>
                    <Caption1>
                      {maskedNumber(c.number_last4)} · expires {formatDate(c.expires_on)}
                    </Caption1>
                    {c.needs_reupload && <Caption1>Please upload the image again with the first 8 digits covered.</Caption1>}
                  </div>
                  <Badge appearance="tint" color={b.color}>
                    {b.label}
                  </Badge>
                  {(c.status === "valid" || c.status === "expiring_soon" || c.status === "expired" || c.needs_reupload) && (
                    <Button size="small" onClick={() => setRenewing(c)}>
                      {c.needs_reupload ? "Upload again" : "Renew"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card className={portal.card}>
        <Subtitle2>{renewing ? `Renew ${renewing.type_label}` : "Add a credential"}</Subtitle2>
        {!renewing && (
          <Field label="Type">
            <Dropdown placeholder="Choose a type" value={addType?.label ?? ""} onOptionSelect={(_, o) => setAdding(o.optionValue ?? null)}>
              {d.types.map((t) => (
                <Option key={t.key} value={t.key}>
                  {t.label}
                </Option>
              ))}
            </Dropdown>
          </Field>
        )}
        {renewing && renewType && <CredentialFields key={renewing.id} type={renewType} renewOf={renewing} onDone={() => setRenewing(null)} />}
        {!renewing && addType && <CredentialFields key={addType.key} type={addType} onDone={() => setAdding(null)} />}
        {renewing && (
          <div>
            <Button appearance="subtle" onClick={() => setRenewing(null)}>
              Cancel renewal
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
