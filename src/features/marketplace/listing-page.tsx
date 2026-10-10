"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
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
  Subtitle2,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TabList,
  Textarea,
  Title3,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { UserPicker } from "@/features/admin/user-picker";
import { IdMultiSelect } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useMediaQuery } from "@/lib/use-media-query";
import { type DataFlowLine, type Installation, type Listing, marketplaceApi, marketplaceKeys, type ScopeLine } from "./api";
import {
  categoryLabel,
  configureComplete,
  countryName,
  directionLabel,
  type FormField,
  listingAction,
  publisherBadge,
  reviewAccessComplete,
  schemaFields,
  type WizardStep,
  wizardSteps,
} from "./labels";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1000px" },
  header: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "center", flexWrap: "wrap" },
  headerText: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, flexGrow: 1 },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingHorizontalM },
  markdown: { whiteSpace: "pre-wrap" },
  shots: { display: "flex", gap: tokens.spacingHorizontalS, overflowX: "auto" },
  shot: { maxHeight: "200px", borderRadius: tokens.borderRadiusMedium },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  tableWrap: { overflowX: "auto" },
  full: { width: "100vw", maxWidth: "100vw", height: "100svh", maxHeight: "100svh", borderRadius: 0 },
});

export function AccessTable({ scopes }: { scopes: ScopeLine[] }) {
  if (!scopes.length) return <Body1>No access to your Talent OS data beyond the data flows below.</Body1>;
  return (
    <Table size="small" aria-label="Access it needs">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Access</TableHeaderCell>
          <TableHeaderCell>Why</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {scopes.map((s) => (
          <TableRow key={s.key}>
            <TableCell>
              {s.key}{" "}
              {s.sensitive ? (
                <Badge appearance="tint" color="warning">
                  Sensitive
                </Badge>
              ) : null}
            </TableCell>
            <TableCell>{s.reason || "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function FlowsTable({ flows, name }: { flows: DataFlowLine[]; name: string }) {
  if (!flows.length) return <Body1>No data leaves Talent OS.</Body1>;
  return (
    <Table size="small" aria-label="Data it sends and receives">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Direction</TableHeaderCell>
          <TableHeaderCell>Data</TableHeaderCell>
          <TableHeaderCell>Purpose</TableHeaderCell>
          <TableHeaderCell>Stored in</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {flows.map((f, i) => (
          <TableRow key={`${f.entity}-${i}`}>
            <TableCell>{directionLabel(f.direction, name)}</TableCell>
            <TableCell>
              {f.entity}
              {f.fields.length ? `: ${f.fields.join(", ")}` : ""}
            </TableCell>
            <TableCell>{f.purpose}</TableCell>
            <TableCell>{countryName(f.destination_country)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** `/settings/integrations/marketplace/[slug]`: listing details with the install wizard. */
export function ListingPage({ slug }: { slug: string }) {
  const styles = useStyles();
  const router = useRouter();
  const canManage = usePermission("integration:manage");
  const q = useQuery({ queryKey: marketplaceKeys.listing(slug), queryFn: ({ signal }) => marketplaceApi.listing(slug, signal) });
  const [installing, setInstalling] = useState(false);
  if (q.isPending) return <Spinner label="Loading" />;
  if (q.error || !q.data)
    return (
      <MessageBar intent="error">
        <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
      </MessageBar>
    );
  const l = q.data;
  const pub = publisherBadge(l.publisher_kind, l.publisher_badge);
  const action = listingAction(l, canManage);
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        {l.logo_url ? <img src={l.logo_url} alt="" width={48} height={48} /> : null}
        <div className={styles.headerText}>
          <Title3 as="h1">{l.name}</Title3>
          <div>
            <Badge appearance="tint" color={pub.color}>
              {pub.label}
            </Badge>{" "}
            <Caption1>{categoryLabel(l.category)}</Caption1>
            {l.publisher_kind === "partner" && l.last_reviewed_at ? (
              <Caption1> · Last reviewed {new Date(l.last_reviewed_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</Caption1>
            ) : null}
          </div>
        </div>
        {action.kind === "open" ? (
          <Link href={action.href}>
            <Button appearance="primary">{l.kind === "calendar" ? "Manage" : "Open settings"}</Button>
          </Link>
        ) : action.kind === "manage" ? (
          <Button appearance="primary" onClick={() => router.push(`/settings/integrations/installed/${l.installation_id}`)}>
            Manage
          </Button>
        ) : action.disabledReason ? (
          <Tooltip content={action.disabledReason} relationship="description">
            <Button appearance="primary" disabledFocusable>
              Install
            </Button>
          </Tooltip>
        ) : (
          <Button appearance="primary" onClick={() => setInstalling(true)}>
            Install
          </Button>
        )}
      </div>
      <Card>
        <div className={styles.section}>
          <Subtitle2 as="h2">Overview</Subtitle2>
          <Body1 className={styles.markdown}>{l.description_md || l.tagline}</Body1>
          {l.screenshots.length ? (
            <div className={styles.shots}>
              {l.screenshots.map((s) => (
                <img key={s} src={s} alt="Screenshot" className={styles.shot} />
              ))}
            </div>
          ) : null}
        </div>
      </Card>
      <Card>
        <div className={styles.section}>
          <Subtitle2 as="h2">Access it needs</Subtitle2>
          <div className={styles.tableWrap}>
            <AccessTable scopes={l.scopes} />
          </div>
        </div>
      </Card>
      <Card>
        <div className={styles.section}>
          <Subtitle2 as="h2">Data it sends and receives</Subtitle2>
          <div className={styles.tableWrap}>
            <FlowsTable flows={l.data_flows} name={l.name} />
          </div>
        </div>
      </Card>
      <Card>
        <div className={styles.section}>
          <Subtitle2 as="h2">Supported countries</Subtitle2>
          <Body1>{l.supported_countries.map(countryName).join(", ") || "India"}</Body1>
          <Subtitle2 as="h2">Pricing</Subtitle2>
          <Body1>{l.pricing_note || "—"}</Body1>
          <Caption1>Pricing is set by the publisher. Talent OS doesn&apos;t bill for it.</Caption1>
          <Subtitle2 as="h2">Support</Subtitle2>
          <Body1>
            {l.support_email ? <FluentLink href={`mailto:${l.support_email}`}>{l.support_email}</FluentLink> : null}
            {l.support_email && l.support_url ? " · " : null}
            {l.support_url && /^https:\/\//i.test(l.support_url) ? (
              <FluentLink href={l.support_url} target="_blank" rel="noopener noreferrer">
                {l.support_url}
              </FluentLink>
            ) : null}
            {!l.support_email && !l.support_url ? "—" : null}
          </Body1>
        </div>
      </Card>
      {l.versions.length ? (
        <Card>
          <div className={styles.section}>
            <Subtitle2 as="h2">Version history</Subtitle2>
            <Accordion collapsible>
              {l.versions.map((v) => (
                <AccordionItem key={v.version_no} value={v.version_no}>
                  <AccordionHeader>
                    Version {v.version_no} · {v.published_at ? new Date(v.published_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"}
                  </AccordionHeader>
                  <AccordionPanel>
                    <Body1>{v.changelog || "No changelog."}</Body1>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Card>
      ) : null}
      {installing ? <InstallWizard listing={l} onClose={() => setInstalling(false)} /> : null}
    </div>
  );
}

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function ConfigFields({ fields, values, onChange }: { fields: FormField[]; values: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  return (
    <>
      {fields.map((f) =>
        f.kind === "boolean" ? (
          <Switch key={f.name} label={f.label} checked={Boolean(values[f.name])} onChange={(_, d) => onChange({ ...values, [f.name]: d.checked })} />
        ) : f.kind === "select" ? (
          <Field key={f.name} label={f.label} hint={f.help ?? undefined} required={f.required}>
            <Dropdown value={String(values[f.name] ?? "")} selectedOptions={[String(values[f.name] ?? "")]} onOptionSelect={(_, d) => onChange({ ...values, [f.name]: d.optionValue })}>
              {f.options.map((o) => (
                <Option key={o} value={o}>
                  {o}
                </Option>
              ))}
            </Dropdown>
          </Field>
        ) : (
          <Field key={f.name} label={f.label} hint={f.help ?? undefined} required={f.required}>
            <Input
              type={f.kind === "number" ? "number" : "text"}
              value={String(values[f.name] ?? "")}
              onChange={(_, d) => onChange({ ...values, [f.name]: f.kind === "number" && d.value !== "" ? Number(d.value) : d.value })}
            />
          </Field>
        ),
      )}
    </>
  );
}

function InstallWizard({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const styles = useStyles();
  const narrow = useMediaQuery("(max-width: 639px)");
  const router = useRouter();
  const qc = useQueryClient();
  const steps = wizardSteps(listing.kind);
  const [step, setStep] = useState<WizardStep>(steps[0]);
  const [consent, setConsent] = useState(false);
  const [purposes, setPurposes] = useState<Record<string, string>>({});
  const fields = useMemo(() => schemaFields(listing.config_schema), [listing.config_schema]);
  const [config, setConfig] = useState<Record<string, unknown>>(() => Object.fromEntries(fields.filter((f) => f.defaultValue !== undefined).map((f) => [f.name, f.defaultValue])));
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [entities, setEntities] = useState<string[]>([]);
  const [accountable, setAccountable] = useState<string | null>(null);
  const [installation, setInstallation] = useState<Installation | null>(null);
  const [idemKey] = useState(newKey);
  const les = useQuery({
    queryKey: ["legal-entities", "options"],
    queryFn: ({ signal }) => api.get<{ id: string; name: string }[]>("/api/v1/legal-entities", { signal }),
    enabled: listing.legal_entity_scoped,
  });
  const requiredSecrets = listing.secret_fields.filter((s) => s.required && s.kind !== "oauth_refresh").map((s) => s.name);
  const install = useMutation({
    mutationFn: () =>
      marketplaceApi.install(
        {
          kind: listing.kind === "app" ? "app" : "connector",
          app_id: listing.app_id,
          connector_key: listing.connector_key,
          scopes: listing.scopes.map((s) => s.key),
          sensitive_purposes: purposes,
          config,
          secrets,
          legal_entity_ids: entities,
          accountable_user_id: accountable,
          accept_manifest_sha256: listing.manifest_sha256 ?? "",
        },
        idemKey,
      ),
    onSuccess: (inst) => {
      setInstallation(inst);
      void qc.invalidateQueries({ queryKey: marketplaceKeys.all });
      if (listing.kind !== "app") setStep("Test");
      else setStep("Finish");
    },
  });
  const retest = useMutation({ mutationFn: () => marketplaceApi.test(installation?.id ?? ""), onSuccess: () => void qc.invalidateQueries({ queryKey: marketplaceKeys.all }) });
  const index = steps.indexOf(step);
  const reviewOk = reviewAccessComplete(listing.scopes, purposes, consent);
  const configOk = listing.kind === "app" || (configureComplete(fields, config, requiredSecrets, secrets) && !!accountable && (!listing.legal_entity_scoped || entities.length > 0 || (les.data ?? []).length === 0));
  const testOk = retest.data ? retest.data.ok : installation?.test?.ok ?? installation?.status === "active";
  const needsApproval = installation?.status === "pending_approval";
  const sensitive = listing.scopes.filter((s) => s.sensitive);
  const publisher = listing.publisher_kind === "platform" ? "Talent OS" : listing.name;
  return (
    <Dialog open modalType="modal" onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface className={narrow ? styles.full : undefined}>
        <DialogBody>
          <DialogTitle>Install {listing.name}</DialogTitle>
          <DialogContent className={styles.form}>
            <TabList selectedValue={step} size="small" aria-label="Install progress">
              {steps.map((s) => (
                <Tab key={s} value={s} disabled={s !== step}>
                  {s}
                </Tab>
              ))}
            </TabList>
            {step === "Review access" ? (
              <>
                <AccessTable scopes={listing.scopes} />
                <FlowsTable flows={listing.data_flows} name={listing.name} />
                {sensitive.map((s) => (
                  <Field key={s.key} label={`${s.key}: Why does your organisation need this?`} required hint="10–500 characters">
                    <Textarea maxLength={500} value={purposes[s.key] ?? ""} onChange={(_, d) => setPurposes({ ...purposes, [s.key]: d.value })} />
                  </Field>
                ))}
                <Checkbox
                  required
                  checked={consent}
                  onChange={(_, d) => setConsent(Boolean(d.checked))}
                  label={`I agree to share this data with ${publisher} for the purposes shown. We are the data fiduciary for it.`}
                />
              </>
            ) : null}
            {step === "Configure" ? (
              <>
                <ConfigFields fields={fields} values={config} onChange={setConfig} />
                {listing.legal_entity_scoped && (les.data ?? []).length > 0 ? (
                  <IdMultiSelect label="Legal entities" options={(les.data ?? []).map((e) => ({ id: e.id, label: e.name }))} value={entities} onChange={setEntities} />
                ) : null}
                {listing.kind !== "app" ? (
                  <>
                    <UserPicker label="Accountable person" value={accountable} onChange={(id) => setAccountable(id)} />
                    <Caption1>Gets fix-it tasks when this integration needs attention.</Caption1>
                  </>
                ) : null}
                {listing.auth === "oauth2_code" ? <Body1>Connect your {listing.name} account after installing.</Body1> : null}
                {listing.secret_fields
                  .filter((s) => s.kind !== "oauth_refresh")
                  .map((s) => (
                    <Field key={s.name} label={s.label} required={s.required} hint="Stored encrypted. You won't be able to see it again.">
                      <Input type="password" autoComplete="off" value={secrets[s.name] ?? ""} onChange={(_, d) => setSecrets({ ...secrets, [s.name]: d.value })} />
                    </Field>
                  ))}
              </>
            ) : null}
            {step === "Test" ? (
              <>
                {install.isPending || retest.isPending ? <Spinner label="Testing the connection" /> : null}
                {testOk ? (
                  <MessageBar intent="success">
                    <MessageBarBody>Connection works.</MessageBarBody>
                  </MessageBar>
                ) : installation ? (
                  <MessageBar intent="error">
                    <MessageBarBody>We couldn&apos;t connect: {retest.data?.message ?? installation.test?.message ?? "the test failed."}</MessageBarBody>
                  </MessageBar>
                ) : null}
                {installation && !testOk ? (
                  <Button onClick={() => retest.mutate()} disabled={retest.isPending}>
                    Test connection
                  </Button>
                ) : null}
              </>
            ) : null}
            {step === "Finish" ? (
              needsApproval ? (
                <MessageBar intent="info">
                  <MessageBarBody>Waiting for approval. We&apos;ll notify you.</MessageBarBody>
                </MessageBar>
              ) : installation ? (
                <MessageBar intent="success">
                  <MessageBarBody>{listing.name} is installed.</MessageBarBody>
                </MessageBar>
              ) : (
                <Body1>Review your choices, then install.</Body1>
              )
            ) : null}
            {install.error ? (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(install.error)}</MessageBarBody>
              </MessageBar>
            ) : null}
          </DialogContent>
          <DialogActions>
            {step === "Review access" ? (
              <>
                <Button appearance="primary" disabled={!reviewOk} onClick={() => setStep(steps[index + 1])}>
                  Next
                </Button>
                <Button onClick={onClose}>Cancel</Button>
              </>
            ) : null}
            {step === "Configure" ? (
              <>
                <Button onClick={() => setStep(steps[index - 1])}>Back</Button>
                <Button
                  appearance="primary"
                  disabled={!configOk || install.isPending}
                  onClick={() => (listing.kind === "app" ? setStep("Finish") : install.mutate())}
                >
                  Next
                </Button>
              </>
            ) : null}
            {step === "Test" ? (
              <>
                {!testOk ? <Button onClick={() => installation && router.push(`/settings/integrations/installed/${installation.id}`)}>Back to configuration</Button> : null}
                <Button appearance="primary" disabled={!installation} onClick={() => setStep("Finish")}>
                  Next
                </Button>
              </>
            ) : null}
            {step === "Finish" ? (
              installation ? (
                <Button appearance="primary" onClick={() => router.push(`/settings/integrations/installed/${installation.id}`)}>
                  Done
                </Button>
              ) : (
                <>
                  <Button onClick={() => setStep(steps[index - 1])}>Back</Button>
                  <Button appearance="primary" disabled={install.isPending} onClick={() => install.mutate()}>
                    {sensitive.length ? "Send for approval" : "Install"}
                  </Button>
                </>
              )
            ) : null}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

