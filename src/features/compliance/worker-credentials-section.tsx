"use client";

import { Badge, Body1, Button, Caption1, makeStyles, tokens } from "@fluentui/react-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { complianceApi, complianceKeys } from "./api";
import { credentialBadge, formatDate, maskedNumber } from "./logic";
import type { Credential } from "./types";

const useStyles = makeStyles({
  list: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
});

function Row({ c }: { c: Credential }) {
  const s = useStyles();
  const canUnmask = usePermission("identity:view");
  const [shown, setShown] = useState<string | null>(null);
  const unmask = useMutation({ mutationFn: () => complianceApi.unmask(c.id), onSuccess: (r) => setShown(r.number) });
  const b = credentialBadge(c.status);
  return (
    <li className={s.row}>
      <Body1>{c.type_label ?? c.type_key}</Body1>
      <Caption1>{shown ?? maskedNumber(c.number_last4)}</Caption1>
      <Badge appearance="tint" color={b.color}>
        {b.label}
      </Badge>
      <Caption1>expires {formatDate(c.expires_on)}</Caption1>
      {canUnmask && c.number_kind === "encrypted" && c.number_last4 && !shown && (
        <Button size="small" onClick={() => unmask.mutate()} disabled={unmask.isPending}>
          Unmask
        </Button>
      )}
      {unmask.isError && <Caption1>{errorMessage(unmask.error)}</Caption1>}
    </li>
  );
}

/** Worker 360 "Credentials" section: masked numbers; Unmask is offered only to `identity:view` holders. */
export function WorkerCredentialsSection({ candidateId }: { candidateId: string }) {
  const s = useStyles();
  const canRead = usePermission("compliance:read");
  const q = useQuery({
    queryKey: complianceKeys.candidate(candidateId),
    queryFn: ({ signal }) => complianceApi.candidateCredentials(candidateId, signal),
    enabled: canRead,
  });
  if (!canRead) return null;
  if (q.isPending) return <Body1>Loading…</Body1>;
  if (q.isError) return <Body1>{errorMessage(q.error)}</Body1>;
  const current = q.data.filter((c) => c.status !== "superseded");
  if (current.length === 0) return <Body1>No credentials recorded.</Body1>;
  return (
    <ul className={s.list}>
      {current.map((c) => (
        <Row key={c.id} c={c} />
      ))}
    </ul>
  );
}
