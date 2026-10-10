"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Field,
  Input,
  makeStyles,
  Spinner,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowSync20Regular, Copy16Regular, Delete20Regular, Globe20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, formatDateTime } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { messagingApi, messagingKeys } from "./api";
import { dnsRecords, domainStatusBadge, normalizeHost } from "./logic";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "1180px", marginTop: tokens.spacingVerticalXL },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "flex-end" },
  tableWrap: { overflowX: "auto" },
  value: { fontFamily: tokens.fontFamilyMonospace, overflowWrap: "anywhere", wordBreak: "break-all" },
  muted: { color: tokens.colorNeutralForeground3 },
  facts: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXL, alignItems: "center" },
});

const DOMAIN_ERRORS: Record<string, string> = {
  domain_taken: "This domain is already used by another organisation.",
};

/** Career site → Custom domain (FR-174): add a host, publish the DNS records, verify, remove. */
export function CustomDomainCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const allowed = usePermission("career_domain:manage");
  const [host, setHost] = useState("");
  const [hostError, setHostError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const q = useQuery({ queryKey: messagingKeys.customDomain, queryFn: ({ signal }) => messagingApi.customDomain(signal), enabled: allowed });
  const set = (d: unknown) => queryClient.setQueryData(messagingKeys.customDomain, d);
  const add = useMutation({
    mutationFn: (h: string) => messagingApi.addCustomDomain(h),
    onSuccess: (d) => {
      set(d);
      setHost("");
      toast.success("Domain added. Publish the DNS records below.");
    },
    onError: (e) => setHostError(isApiError(e) ? (DOMAIN_ERRORS[e.code] ?? (e.status === 422 ? "Enter a valid domain name, such as careers.example.in" : errorMessage(e))) : errorMessage(e)),
  });
  const verify = useMutation({
    mutationFn: () => messagingApi.verifyCustomDomain(),
    onSuccess: (d) => {
      set(d);
      if (d.status === "verified") toast.success("Domain verified");
      else toast.info("The DNS record was not found yet. DNS changes can take up to a few hours.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!allowed) return null;
  const d = q.data ?? null;
  const badge = d ? domainStatusBadge(d.status) : null;

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  };

  return (
    <Card className={styles.card}>
      <CardHeader
        image={<Globe20Regular aria-hidden />}
        header={<Subtitle2 as="h2">Custom domain</Subtitle2>}
        description="Serve your career site on your own domain, such as careers.example.in."
        action={badge ? <Badge appearance="tint" color={badge.color}>{badge.label}</Badge> : undefined}
      />
      {q.isPending ? (
        <Spinner size="tiny" label="Loading…" />
      ) : q.isError ? (
        <ErrorBar message={errorMessage(q.error)} />
      ) : !d || d.status === "removed" ? (
        <div className={styles.row}>
          <Field label="Domain" validationMessage={hostError ?? undefined} style={{ flex: "1 1 280px", maxWidth: 420 }}>
            <Input
              value={host}
              placeholder="careers.example.in"
              onChange={(_, x) => {
                setHost(x.value);
                setHostError(null);
              }}
            />
          </Field>
          <Button
            appearance="primary"
            disabled={!host.trim() || add.isPending}
            icon={add.isPending ? <Spinner size="tiny" /> : undefined}
            onClick={() => {
              const h = normalizeHost(host);
              if (!h) setHostError("Enter a valid domain name, such as careers.example.in");
              else add.mutate(h);
            }}
          >
            Add domain
          </Button>
        </div>
      ) : (
        <>
          <Text>
            <strong>{d.host}</strong>
          </Text>
          <Body1>Add these records at your DNS provider. Verification runs automatically; you can also check now.</Body1>
          <div className={styles.tableWrap}>
            <Table aria-label="DNS records" size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell style={{ width: 80 }}>Type</TableHeaderCell>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Value</TableHeaderCell>
                  <TableHeaderCell>Purpose</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dnsRecords(d).map((r) => (
                  <TableRow key={r.type}>
                    <TableCell>{r.type}</TableCell>
                    <TableCell>
                      <span className={styles.value}>{r.name}</span>{" "}
                      <Button size="small" appearance="subtle" icon={<Copy16Regular />} aria-label={`Copy ${r.type} name`} onClick={() => copy(r.name, `${r.type} name`)} />
                    </TableCell>
                    <TableCell>
                      <span className={styles.value}>{r.value}</span>{" "}
                      <Button size="small" appearance="subtle" icon={<Copy16Regular />} aria-label={`Copy ${r.type} value`} onClick={() => copy(r.value, `${r.type} value`)} />
                    </TableCell>
                    <TableCell>
                      <Caption1>{r.purpose}</Caption1>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className={styles.facts}>
            <Caption1>Last checked: {formatDateTime(d.last_checked_at)}</Caption1>
            {d.verified_at && <Caption1>Verified: {formatDateTime(d.verified_at)}</Caption1>}
            <Caption1>Certificate: managed by hosting (pending)</Caption1>
          </div>
          <div className={styles.row}>
            <Button icon={verify.isPending ? <Spinner size="tiny" /> : <ArrowSync20Regular />} disabled={verify.isPending} onClick={() => verify.mutate()}>
              Verify now
            </Button>
            <Button icon={<Delete20Regular />} onClick={() => setRemoving(true)}>
              Remove
            </Button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={removing}
        title="Remove the custom domain?"
        confirmLabel="Remove"
        onClose={() => setRemoving(false)}
        onConfirm={async () => {
          try {
            await messagingApi.removeCustomDomain();
            set(null);
            toast.success("Custom domain removed");
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        {d?.host} will stop serving your career site within a few minutes. Your career site stays available at its usual address.
      </ConfirmDialog>
    </Card>
  );
}
