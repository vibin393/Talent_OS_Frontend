"use client";

import { Button, Caption1, makeStyles, Radio, RadioGroup, Spinner, Tag, TagGroup, Text, tokens, Field } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar } from "@/features/admin/ui";
import { DemandPicker } from "@/features/campus/pickers";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage } from "@/lib/api/errors";
import { screeningAgentApi, screeningAgentKeys } from "./api";
import type { BindingIn, BindingOut, BindingScope } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  muted: { color: tokens.colorNeutralForeground3 },
});

const SCOPE_LABELS: Record<BindingScope, string> = { tenant: "Whole organisation", client: "Client", demand: "Demand" };

/** "Use for: Whole organisation / Client … / Demand …" (the most specific approved binding wins). */
export function bindingLabel(b: Pick<BindingOut, "scope_kind" | "scope_id">, names: Record<string, string> = {}): string {
  if (b.scope_kind === "tenant") return SCOPE_LABELS.tenant;
  const label = SCOPE_LABELS[b.scope_kind as BindingScope] ?? b.scope_kind;
  const name = (b.scope_id && names[b.scope_id]) || (b.scope_id ? `${b.scope_id.slice(0, 8)}…` : "");
  return `${label} ${name}`.trim();
}

export function BindingEditor({ questionnaireId }: { questionnaireId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const key = screeningAgentKeys.bindings(questionnaireId);
  const bindings = useQuery({ queryKey: key, queryFn: ({ signal }) => screeningAgentApi.bindings(questionnaireId, signal) });
  const [scope, setScope] = useState<BindingScope>("tenant");
  const [names, setNames] = useState<Record<string, string>>({});
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const bind = useMutation({
    mutationFn: (body: BindingIn) => screeningAgentApi.bind(questionnaireId, body),
    onSuccess: () => toast.success("Questionnaire assigned."),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: refresh,
  });
  const unbind = useMutation({
    mutationFn: (b: BindingOut) => screeningAgentApi.unbind(questionnaireId, { scope_kind: b.scope_kind as BindingScope, scope_id: b.scope_id }),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: refresh,
  });
  const pick = (kind: BindingScope, id: string, name: string) => {
    setNames((n) => ({ ...n, [id]: name }));
    bind.mutate({ scope_kind: kind, scope_id: id });
  };
  const list = bindings.data ?? [];

  return (
    <div className={styles.root}>
      <Text weight="semibold">Use for</Text>
      {bindings.isError ? (
        <ErrorBar message={errorMessage(bindings.error)} />
      ) : list.length === 0 ? (
        <Caption1 className={styles.muted}>Not assigned. Without an assignment the Screening Agent uses the default questions.</Caption1>
      ) : (
        <TagGroup
          aria-label="Use for"
          onDismiss={(_, d) => {
            const b = list.find((x) => x.id === d.value);
            if (b) unbind.mutate(b);
          }}
        >
          {list.map((b) => (
            <Tag key={b.id} value={b.id} dismissible dismissIcon={{ "aria-label": `Remove ${bindingLabel(b, names)}` }}>
              {bindingLabel(b, names)}
            </Tag>
          ))}
        </TagGroup>
      )}
      <Field label="Add">
        <RadioGroup layout="horizontal" value={scope} onChange={(_, d) => setScope(d.value as BindingScope)}>
          <Radio value="tenant" label="Whole organisation" />
          <Radio value="client" label="Client" />
          <Radio value="demand" label="Demand" />
        </RadioGroup>
      </Field>
      <div className={styles.row}>
        {scope === "tenant" && (
          <Button disabled={bind.isPending || list.some((b) => b.scope_kind === "tenant")} icon={bind.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => bind.mutate({ scope_kind: "tenant", scope_id: null })}>
            Use for the whole organisation
          </Button>
        )}
        {scope === "client" && <ClientPicker label="Client" value={null} onChange={(c) => c && pick("client", c.id, c.name)} disabled={bind.isPending} />}
        {scope === "demand" && <DemandPicker label="Demand" onPick={(d) => pick("demand", d.id, d.req_id ? `${d.req_id} ${d.title}` : d.title)} disabled={bind.isPending} />}
      </div>
    </div>
  );
}
