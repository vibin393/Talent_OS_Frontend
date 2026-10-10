"use client";

import { Badge, Button, Field, Input, MessageBar, MessageBarBody, Text } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { Empty, formatDate, formatDateTime, Loading, useCpStyles } from "./ui";

type PackInternal = {
  id: string;
  period_month: string;
  title: string;
  published_at: string | null;
  items: { id: string; label: string; file_id: string | null; document_id: string | null }[];
  downloads: { id: string; item_id: string | null; label: string | null; client_user_id: string | null; at: string }[];
};

const enc = encodeURIComponent;

/** Client 360 "Compliance packs" (Epic 18, FR-103): create, add items, publish, download log. */
export function CompliancePacksTab({ clientId, readOnly }: { clientId: string; readOnly: boolean }) {
  const s = useCpStyles();
  const qc = useQueryClient();
  const base = `/api/v1/clients/${enc(clientId)}/compliance-packs`;
  const key = ["clients", clientId, "compliance-packs"];
  const q = useQuery({ queryKey: key, queryFn: ({ signal }) => api.get<PackInternal[]>(base, { signal }) });
  const [month, setMonth] = useState("");
  const [title, setTitle] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const create = useMutation({
    mutationFn: () => api.post<PackInternal>(base, { period_month: `${month}-01`, title }),
    onSuccess: () => {
      setTitle("");
      void refresh();
    },
  });
  const upload = useMutation({
    mutationFn: ({ packId, file }: { packId: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("label", file.name);
      return api.post<PackInternal>(`${base}/${enc(packId)}/items`, form);
    },
    onSuccess: refresh,
  });
  const publish = useMutation({ mutationFn: (packId: string) => api.post<PackInternal>(`${base}/${enc(packId)}/publish`), onSuccess: refresh });
  const error = create.error ?? upload.error ?? publish.error;
  return (
    <div className={s.page}>
      {!readOnly ? (
        <form
          className={s.row}
          onSubmit={(e) => {
            e.preventDefault();
            if (month && title.trim().length >= 2) create.mutate();
          }}
        >
          <Field label="Month">
            <Input type="month" value={month} onChange={(_, d) => setMonth(d.value)} />
          </Field>
          <Field label="Title" className={s.grow}>
            <Input value={title} onChange={(_, d) => setTitle(d.value)} />
          </Field>
          <Button type="submit" appearance="primary" disabled={create.isPending}>
            New pack
          </Button>
        </form>
      ) : null}
      {error ? (
        <MessageBar intent="error" aria-live="assertive">
          <MessageBarBody>{errorMessage(error)}</MessageBarBody>
        </MessageBar>
      ) : null}
      {!q.data ? <Loading /> : null}
      {q.data && q.data.length === 0 ? <Empty>No compliance packs yet.</Empty> : null}
      <div className={s.list}>
        {q.data?.map((p) => (
          <div key={p.id} className={s.card}>
            <div className={s.row}>
              <Text weight="semibold" className={s.grow}>{`${p.title} · ${formatDate(p.period_month)}`}</Text>
              <Badge appearance="tint">{p.published_at ? `Published ${formatDate(p.published_at)}` : "Draft"}</Badge>
            </div>
            <Text size={200}>{p.items.map((i) => i.label).join(" · ") || "No items"}</Text>
            {!readOnly && !p.published_at ? (
              <div className={s.actions}>
                <input
                  type="file"
                  aria-label={`Add an item to ${p.title}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload.mutate({ packId: p.id, file });
                  }}
                />
                <Button appearance="primary" disabled={p.items.length === 0 || publish.isPending} onClick={() => publish.mutate(p.id)}>
                  Publish
                </Button>
              </div>
            ) : null}
            {p.downloads.length > 0 ? (
              <Text size={200} className={s.muted}>
                {`Downloads: ${p.downloads.map((d) => `${d.label ?? "item"} (${formatDateTime(d.at)})`).join(", ")}`}
              </Text>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
