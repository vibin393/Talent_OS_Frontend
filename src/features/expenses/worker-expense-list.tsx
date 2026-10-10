"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Option,
  Spinner,
  Text,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { errorMessage } from "@/lib/api/errors";
import { expenseErrorMessage, formatDate, statusColor, statusLabel } from "./format";
import { formatMoney } from "./money";
import { useMyExpenseClaims, useNewExpenseClaim } from "./use-expense-claims";

/** `/portal/work/expenses`: the Worker's expense claims (status, totals) and "New claim". */
export function WorkerExpenseList() {
  const portal = usePortalStyles();
  const q = useMyExpenseClaims();
  const [open, setOpen] = useState(false);
  if (q.isPending) return <LoadingBlock label="Loading expense claims" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className={portal.page}>
      <PortalPageHeader title="My expenses" subtitle="Claim travel, meals, mileage and other work expenses." />
      <div className={portal.actions}>
        <Button appearance="primary" className={portal.button} icon={<Add20Regular />} onClick={() => setOpen(true)}>
          New claim
        </Button>
      </div>
      <Card className={portal.card}>
        {q.data.length === 0 ? (
          <Body1 className={portal.empty}>You have no expense claims yet.</Body1>
        ) : (
          <ul className={portal.list}>
            {q.data.map((c) => (
              <li key={c.id} className={portal.row}>
                <span className={portal.rowMain}>
                  <NextLink href={`/portal/work/expenses/${encodeURIComponent(c.id)}`} className={portal.rowTitle}>
                    {c.title || c.human_id}
                  </NextLink>
                  <Caption1>
                    {[c.client_name, c.role_title, c.human_id, `${c.line_count} expense${c.line_count === 1 ? "" : "s"}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </Caption1>
                  {c.submitted_at && <Caption1>Submitted {formatDate(c.submitted_at)}</Caption1>}
                </span>
                <span className={portal.actions}>
                  <Badge appearance="tint" color={statusColor(c.status)}>
                    {statusLabel(c.status)}
                  </Badge>
                  <Text weight="semibold">{formatMoney(c.total_claimed, c.currency)}</Text>
                  {c.total_approved !== null && c.total_approved !== c.total_claimed && (
                    <Caption1>Approved {formatMoney(c.total_approved, c.currency)}</Caption1>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {open && <NewClaimDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewClaimDialog({ onClose }: { onClose: () => void }) {
  const portal = usePortalStyles();
  const router = useRouter();
  const { placements, create } = useNewExpenseClaim(true);
  const [placementId, setPlacementId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const list = placements.data ?? [];
  const selected = list.find((p) => p.placement_id === placementId) ?? (list.length === 1 ? list[0] : undefined);
  const label = (p: (typeof list)[number]) => [p.role_title, p.client_name].filter(Boolean).join(" · ") || p.placement_id;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !create.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>New expense claim</DialogTitle>
          <DialogContent className={portal.form}>
            {placements.isPending ? (
              <Spinner size="small" label="Loading placements…" />
            ) : placements.isError ? (
              <InlineError message={errorMessage(placements.error)} />
            ) : list.length === 0 ? (
              <Body1>You have no placements that can receive expense claims.</Body1>
            ) : (
              <>
                <Field label="Placement" required>
                  <Dropdown
                    className={portal.input}
                    value={selected ? label(selected) : ""}
                    selectedOptions={selected ? [selected.placement_id] : []}
                    onOptionSelect={(_, d) => setPlacementId(d.optionValue ?? null)}
                  >
                    {list.map((p) => (
                      <Option key={p.placement_id} value={p.placement_id} text={label(p)}>
                        {label(p)} ({p.currency})
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="Title" hint="Optional, e.g. “Client visit — Pune, October”">
                  <Input className={portal.input} value={title} maxLength={200} onChange={(_, d) => setTitle(d.value)} />
                </Field>
              </>
            )}
            <InlineError message={create.isError ? expenseErrorMessage(create.error, errorMessage) : null} />
          </DialogContent>
          <DialogActions>
            <Button className={portal.button} disabled={create.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              className={portal.button}
              disabled={!selected || create.isPending}
              onClick={async () => {
                if (!selected) return;
                try {
                  const c = await create.mutateAsync({ placement_id: selected.placement_id, title: title.trim() || null });
                  router.push(`/portal/work/expenses/${encodeURIComponent(c.id)}`);
                } catch {
                  // shown inline
                }
              }}
            >
              Create claim
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
