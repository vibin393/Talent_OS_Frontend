"use client";

import {
  Badge,
  Button,
  CounterBadge,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Tab,
  TabList,
  Text,
  Textarea,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { cpApi, cpKeys } from "./api";
import { commentError, delegateBadge } from "./logic";
import type { ApprovalItemOut } from "./types";
import { Empty, Failure, formatDate, formatDateTime, Loading, PageTitle, useCpStyles } from "./ui";

function DecideDialog({ item, onClose }: { item: ApprovalItemOut | null; onClose: () => void }) {
  const s = useCpStyles();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const detail = useQuery({
    queryKey: cpKeys.approval(item?.request_id ?? "none"),
    queryFn: ({ signal }) => cpApi.approval(item!.request_id, signal),
    enabled: item !== null,
  });
  const m = useMutation({
    mutationFn: (decision: "approve" | "reject") => cpApi.decide(item!.request_id, decision, comment.trim() || null),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: cpKeys.approvals });
      await qc.invalidateQueries({ queryKey: cpKeys.home });
      setComment("");
      setRejecting(false);
      onClose();
    },
  });
  const err = rejecting ? commentError("reject", comment) : null;
  const badge = delegateBadge(item?.acting_for_name);
  return (
    <Dialog open={item !== null} onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{item?.title ?? ""}</DialogTitle>
          <DialogContent>
            {badge ? <Badge appearance="outline">{badge}</Badge> : null}
            {detail.error ? <Failure error={detail.error} /> : null}
            {detail.data ? (
              <dl className={s.dl}>
                {detail.data.fields.map((f, i) => (
                  <div key={`${f.label}-${i}`} style={{ display: "contents" }}>
                    <dt>{f.label}</dt>
                    <dd>{f.value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <Loading />
            )}
            <Field label="Comment" required={rejecting} validationMessage={err ?? undefined}>
              <Textarea rows={3} value={comment} onChange={(_, d) => setComment(d.value)} />
            </Field>
            {m.error ? (
              <MessageBar intent="error" aria-live="assertive">
                <MessageBarBody>{errorMessage(m.error)}</MessageBarBody>
              </MessageBar>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button
              disabled={m.isPending}
              onClick={() => {
                setRejecting(true);
                if (!commentError("reject", comment)) m.mutate("reject");
              }}
            >
              Reject
            </Button>
            <Button appearance="primary" disabled={m.isPending} onClick={() => m.mutate("approve")}>
              Approve
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** `/client/approvals`: one tab per kind; timesheets link to Epic 25's page, other kinds decide here. */
export function ClientApprovals() {
  const s = useCpStyles();
  const q = useQuery({ queryKey: cpKeys.approvals, queryFn: ({ signal }) => cpApi.approvals(signal) });
  const [tab, setTab] = useState<string | null>(null);
  const [open, setOpen] = useState<ApprovalItemOut | null>(null);
  if (q.error) return <Failure error={q.error} />;
  if (!q.data) return <Loading />;
  const kinds = q.data.kinds;
  const current = kinds.find((k) => k.kind === tab) ?? kinds[0];
  return (
    <div className={s.page}>
      <PageTitle actions={<Button as="a" href="/client/delegation">Out of office</Button>}>Approvals</PageTitle>
      {kinds.length === 0 ? <Empty>Nothing is waiting for you.</Empty> : null}
      {kinds.length > 0 ? (
        <TabList selectedValue={current?.kind} onTabSelect={(_, d) => setTab(String(d.value))}>
          {kinds.map((k) => (
            <Tab key={k.kind} value={k.kind}>
              {k.label} <CounterBadge count={k.count} size="small" appearance="filled" />
            </Tab>
          ))}
        </TabList>
      ) : null}
      {current?.kind === "timesheet" ? (
        <Text>
          Timesheets are approved on the{" "}
          <Link className={s.link} href="/client/timesheets">
            Timesheets page
          </Link>
          .
        </Text>
      ) : null}
      <div className={s.list}>
        {current?.items.map((it) => {
          const badge = delegateBadge(it.acting_for_name);
          return (
            <div key={it.request_id} className={s.card}>
              <div className={s.row}>
                <div className={s.grow}>
                  <Text weight="semibold">{it.title}</Text>
                  <br />
                  <Text size={200} className={s.muted}>
                    {`${it.subtitle ? `${it.subtitle} · ` : ""}submitted ${formatDateTime(it.submitted_at)}`}
                  </Text>
                </div>
                {badge ? <Badge appearance="outline">{badge}</Badge> : null}
                {it.decide_via === "subject_endpoint" && it.link ? (
                  <Button as="a" href={it.link}>
                    Open
                  </Button>
                ) : (
                  <Button appearance="primary" onClick={() => setOpen(it)}>
                    Review
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <DecideDialog item={open} onClose={() => setOpen(null)} />
    </div>
  );
}

/** `/client/delegation`: current / future delegations, add, revoke. */
export function ClientDelegation() {
  const s = useCpStyles();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: cpKeys.delegations, queryFn: ({ signal }) => cpApi.delegations(signal) });
  const colleagues = useQuery({ queryKey: cpKeys.colleagues, queryFn: ({ signal }) => cpApi.colleagues(signal) });
  const [adding, setAdding] = useState(false);
  const [who, setWho] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const add = useMutation({
    mutationFn: () => cpApi.delegate(who, from, to),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: cpKeys.delegations });
      setAdding(false);
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => cpApi.revokeDelegation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: cpKeys.delegations }),
  });
  const rangeError = from && to && to < from ? "The end date must be on or after the start date" : undefined;
  return (
    <div className={s.page}>
      <PageTitle actions={<Button appearance="primary" onClick={() => setAdding(true)}>Add delegate</Button>}>Out of office</PageTitle>
      <Text className={s.muted}>A delegate approves on your behalf; decisions show “approved by them for you”.</Text>
      {list.error ? <Failure error={list.error} /> : null}
      {list.data && list.data.length === 0 ? <Empty>No delegations.</Empty> : null}
      <div className={s.list}>
        {list.data
          ?.filter((d) => d.state !== "past")
          .map((d) => (
            <div key={d.id} className={s.card}>
              <div className={s.row}>
                <div className={s.grow}>
                  <Text weight="semibold">{d.mine ? `Delegated to ${d.delegate_name ?? "a colleague"}` : `Acting for ${d.client_user_name ?? "a colleague"}`}</Text>
                  <br />
                  <Text size={200} className={s.muted}>{`${formatDate(d.starts_on)} – ${formatDate(d.ends_on)}`}</Text>
                </div>
                <Badge appearance="tint">{d.state}</Badge>
                {d.mine && d.state !== "revoked" ? (
                  <Button disabled={revoke.isPending} onClick={() => revoke.mutate(d.id)}>
                    Revoke
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
      </div>
      <Dialog open={adding} onOpenChange={(_, d) => setAdding(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Add a delegate</DialogTitle>
            <DialogContent>
              <Field label="Colleague" required>
                <Dropdown
                  placeholder="Choose a colleague"
                  selectedOptions={who ? [who] : []}
                  value={colleagues.data?.find((c) => c.id === who)?.display_name ?? ""}
                  onOptionSelect={(_, d) => setWho(String(d.optionValue))}
                >
                  {(colleagues.data ?? []).map((c) => (
                    <Option key={c.id} value={c.id}>
                      {c.display_name}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="From" required>
                <Input type="date" value={from} onChange={(_, d) => setFrom(d.value)} />
              </Field>
              <Field label="To" required validationMessage={rangeError}>
                <Input type="date" value={to} onChange={(_, d) => setTo(d.value)} />
              </Field>
              {add.error ? (
                <MessageBar intent="error" aria-live="assertive">
                  <MessageBarBody>{errorMessage(add.error)}</MessageBarBody>
                </MessageBar>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAdding(false)}>Cancel</Button>
              <Button appearance="primary" disabled={!who || !from || !to || !!rangeError || add.isPending} onClick={() => add.mutate()}>
                Save
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
