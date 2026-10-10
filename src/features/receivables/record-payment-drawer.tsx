"use client";

import {
  Button,
  Dropdown,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  OverlayDrawer,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage } from "@/lib/api/errors";
import { receivablesApi, receivablesKeys } from "./api";
import { Amount, LegalEntitySelect, useRcvStyles } from "./components";
import {
  type AllocationLine,
  allocationState,
  autoAllocate,
  canSubmitPayment,
  compareAmounts,
  linesFromDocuments,
  newIdempotencyKey,
  todayIso,
} from "./logic";
import type { PaymentIn, PaymentMode } from "./types";

const MODES: PaymentMode[] = ["neft", "rtgs", "imps", "upi", "cheque", "wire"];

/** Record Payment: header fields, allocation grid (auto oldest-due-first or manual), TDS per document with the
 * expected value prefilled and a variance warning. One Idempotency-Key per drawer open. */
export function RecordPaymentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useRcvStyles();
  const qc = useQueryClient();
  const [key] = useState(newIdempotencyKey);
  const [le, setLe] = useState<string | null>(null);
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [fxRate, setFxRate] = useState("");
  const [mode, setMode] = useState<PaymentMode>("neft");
  const [reference, setReference] = useState("");
  const [auto, setAuto] = useState(true);
  const [edits, setEdits] = useState<Record<string, { amount?: string; tds?: string }>>({});

  const docs = useQuery({
    queryKey: receivablesKeys.openDocs(client?.id ?? "", le ?? "", currency),
    queryFn: ({ signal }) => receivablesApi.openDocuments(client!.id, le!, currency, signal),
    enabled: !!client && !!le,
  });
  const expected = useMemo(() => new Map((docs.data ?? []).map((d) => [d.document_id, d])), [docs.data]);

  const lines: AllocationLine[] = useMemo(() => {
    const base = linesFromDocuments(docs.data ?? []).map((l) => ({ ...l, tds: edits[l.document_id]?.tds ?? "" }));
    if (auto) return autoAllocate(base, amount || "0");
    return base.map((l) => ({ ...l, amount: edits[l.document_id]?.amount ?? "" }));
  }, [docs.data, edits, auto, amount]);
  const state = allocationState(lines, amount || "0");

  const save = useMutation({
    mutationFn: () => {
      const body: PaymentIn = {
        legal_entity_id: le!,
        client_id: client!.id,
        payment_date: date,
        amount,
        currency,
        fx_rate: currency !== "INR" && fxRate ? fxRate : null,
        mode,
        reference: reference || null,
        allocations: lines
          .filter((l) => l.amount && compareAmounts(l.amount, "0") > 0)
          .map((l) => ({ document_kind: l.document_kind, document_id: l.document_id, amount: l.amount })),
        tds: lines
          .filter((l) => l.tds && compareAmounts(l.tds, "0") > 0)
          .map((l) => ({
            document_kind: l.document_kind,
            document_id: l.document_id,
            kind: "income_tax" as const,
            rate_pct: expected.get(l.document_id)?.tds_rate_pct ?? "0",
            amount: l.tds,
          })),
      };
      return receivablesApi.recordPayment(body, key);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: receivablesKeys.all });
      onClose();
    },
  });

  const setLine = (id: string, field: "amount" | "tds", value: string) =>
    setEdits((e) => ({ ...e, [id]: { ...e[id], [field]: value } }));

  return (
    <OverlayDrawer open={open} onOpenChange={(_, d) => !d.open && onClose()} position="end" size="large">
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>
          Record payment
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <div className={s.stack}>
          <div className={s.row}>
            <LegalEntitySelect value={le} onChange={setLe} className={s.grow} />
            <ClientPicker value={client?.id ?? null} valueLabel={client?.name} onChange={setClient} className={s.grow} required />
          </div>
          <div className={s.row}>
            <Field label="Payment date" required>
              <Input type="date" value={date} onChange={(_, d) => setDate(d.value)} />
            </Field>
            <Field label="Amount" required validationMessage={state.overAllocated ? "Allocations exceed the payment" : undefined}>
              <Input inputMode="decimal" value={amount} onChange={(_, d) => setAmount(d.value)} className={s.narrow} />
            </Field>
            <Field label="Currency">
              <Input value={currency} maxLength={3} onChange={(_, d) => setCurrency(d.value.toUpperCase())} style={{ width: 80 }} />
            </Field>
            {currency !== "INR" && (
              <Field label="FX rate to INR" hint="Blank uses the stored rate">
                <Input inputMode="decimal" value={fxRate} onChange={(_, d) => setFxRate(d.value)} className={s.narrow} />
              </Field>
            )}
            <Field label="Mode">
              <Dropdown value={mode.toUpperCase()} selectedOptions={[mode]} onOptionSelect={(_, d) => setMode(d.optionValue as PaymentMode)}>
                {MODES.map((m) => (
                  <Option key={m} value={m}>
                    {m.toUpperCase()}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Reference (UTR / cheque no.)">
              <Input value={reference} onChange={(_, d) => setReference(d.value)} />
            </Field>
          </div>
          <Switch checked={auto} onChange={(_, d) => setAuto(d.checked)} label="Auto-allocate (oldest due first, disputed amounts excluded)" />
          {!client ? (
            <Text className={s.muted}>Pick a client to see open documents.</Text>
          ) : docs.isLoading ? (
            <Text>Loading open documents...</Text>
          ) : (
            <div className={s.scroll}>
              <Table size="small" aria-label="Allocation">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Document</TableHeaderCell>
                    <TableHeaderCell>Due</TableHeaderCell>
                    <TableHeaderCell>Open</TableHeaderCell>
                    <TableHeaderCell>Disputed</TableHeaderCell>
                    <TableHeaderCell>TDS (expected)</TableHeaderCell>
                    <TableHeaderCell>Allocate</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const doc = expected.get(l.document_id);
                    const tdsVariance = !!doc?.expected_tds && !!l.tds && compareAmounts(l.tds, doc.expected_tds) !== 0;
                    const bad = state.exceedsOpen.includes(l.document_id) || state.invalid.includes(l.document_id);
                    return (
                      <TableRow key={l.document_id}>
                        <TableCell>{l.number ?? l.document_id.slice(0, 8)}</TableCell>
                        <TableCell>{l.due_date ?? "-"}</TableCell>
                        <TableCell>
                          <Amount amount={l.open} currency={currency} />
                        </TableCell>
                        <TableCell>
                          <Amount amount={l.disputed} currency={currency} />
                        </TableCell>
                        <TableCell>
                          <Field validationState={tdsVariance ? "warning" : "none"} validationMessage={tdsVariance ? `Expected ${doc?.expected_tds}` : undefined}>
                            <Input
                              size="small"
                              inputMode="decimal"
                              placeholder={doc?.expected_tds ?? "0.00"}
                              value={l.tds}
                              onChange={(_, d) => setLine(l.document_id, "tds", d.value)}
                              style={{ width: 110 }}
                            />
                          </Field>
                        </TableCell>
                        <TableCell>
                          <Field validationState={bad ? "error" : "none"} validationMessage={bad ? "Exceeds open balance" : undefined}>
                            <Input
                              size="small"
                              inputMode="decimal"
                              disabled={auto}
                              value={l.amount}
                              onChange={(_, d) => setLine(l.document_id, "amount", d.value)}
                              style={{ width: 120 }}
                            />
                          </Field>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <div className={s.row}>
            <Text>
              Allocated <Amount amount={state.allocated} currency={currency} strong />
            </Text>
            <Text>
              Remaining (on account) <Amount amount={state.remaining} currency={currency} strong />
            </Text>
          </div>
          {save.error && (
            <MessageBar intent="error">
              <MessageBarBody>{errorMessage(save.error)}</MessageBarBody>
            </MessageBar>
          )}
        </div>
      </DrawerBody>
      <DrawerFooter>
        <Button appearance="primary" disabled={!le || !client || !canSubmitPayment(state, amount) || save.isPending} onClick={() => save.mutate()}>
          Confirm payment
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </DrawerFooter>
    </OverlayDrawer>
  );
}
