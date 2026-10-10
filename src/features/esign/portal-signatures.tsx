"use client";

import { Badge, Body1, Button, Caption1, Card, Link as FluentLink } from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useMemo } from "react";
import { formatDateTime } from "@/features/admin/ui";
import { requestStatus } from "@/features/documents/logic";
import { ErrorBlock, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { portalCeremonyApi, portalEsignApi, portalSignatureKeys } from "./portal-api";
import { SignCeremony } from "./sign-ceremony";

/** `/portal/work/signatures`: documents the worker has to sign or has signed. */
export function PortalSignaturesList() {
  const styles = usePortalStyles();
  const q = useQuery({ queryKey: portalSignatureKeys.list, queryFn: ({ signal }) => portalEsignApi.list(signal), retry: false });
  if (q.isPending) return <LoadingBlock label="Loading documents to sign" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  const items = [...q.data].sort((a, b) => Number(b.your_turn) - Number(a.your_turn));
  return (
    <div className={styles.page}>
      <PortalPageHeader title="Documents to sign" subtitle="Agreements and letters sent to you for electronic signature." />
      <Card className={styles.card}>
        {items.length === 0 ? (
          <Body1 className={styles.empty}>Nothing to sign right now.</Body1>
        ) : (
          <ul className={styles.list}>
            {items.map((s) => {
              const st = requestStatus(s.status);
              const action = s.your_turn && s.signer_status !== "signed" && s.signer_status !== "declined";
              return (
                <li key={s.signer_id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <NextLink href={`/portal/work/signatures/${encodeURIComponent(s.signer_id)}`} className={styles.rowTitle}>
                      {s.title}
                    </NextLink>
                    <Caption1 className={styles.muted}>
                      {s.human_id} · {s.completed_at ? `Completed ${formatDateTime(s.completed_at)}` : `Sign by ${formatDateTime(s.expires_at)}`}
                    </Caption1>
                  </div>
                  <div className={styles.actions}>
                    <Badge appearance="tint" color={st.color}>
                      {st.label}
                    </Badge>
                    {action && (
                      <Button
                        as="a"
                        href={`/portal/work/signatures/${encodeURIComponent(s.signer_id)}`}
                        appearance="primary"
                        className={styles.button}
                      >
                        Review and sign
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** `/portal/work/signatures/[signerId]`: the signing ceremony in the worker portal. */
export function PortalSignPage({ signerId }: { signerId: string }) {
  const styles = usePortalStyles();
  const queryClient = useQueryClient();
  const api = useMemo(() => portalCeremonyApi(signerId), [signerId]);
  return (
    <div className={styles.page}>
      <FluentLink href="/portal/work/signatures" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44 }}>
        <ArrowLeft20Regular aria-hidden /> Documents to sign
      </FluentLink>
      <SignCeremony channel="portal" api={api} onFinished={() => void queryClient.invalidateQueries({ queryKey: portalSignatureKeys.list })} />
    </div>
  );
}
