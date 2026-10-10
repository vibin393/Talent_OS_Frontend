"use client";

import {
  Button,
  Caption1,
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
  tokens,
  makeStyles,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import type { PaymentIn, PaymentMode } from "@/features/receivables/types";
import { type PaymentSuggestionOut, ledgerApi, ledgerKeys } from "./api";
import { prefillToPayment } from "./logic";

const MODES: PaymentMode[] = ["neft", "rtgs", "imps", "upi", "cheque", "wire"];

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

/**
 * "Record payment from Zoho Books": the P2 payment form pre-filled from a suggestion. Confirming records the Payment
 * in Talent OS as the user (★); it never writes back to Zoho Books.
 */
export function ConfirmDrawer({ suggestion, onClose }: { suggestion: PaymentSuggestionOut; onClose: () => void }) {
  const s = useStyles();
  const qc = useQueryClient();
  const seed = prefillToPayment(suggestion);
  const [date, setDate] = useState(seed.payment_date);
  const [amount, setAmount] = useState(seed.amount);
  const [currency, setCurrency] = useState(seed.currency);
  const [mode, setMode] = useState<PaymentMode>(seed.mode);
  const [reference, setReference] = useState(seed.reference ?? "");

  const save = useMutation({
    mutationFn: () => {
      const edits: Partial<PaymentIn> = { payment_date: date, amount, currency, mode, reference: reference || null };
      return ledgerApi.confirm(suggestion.id, prefillToPayment(suggestion, edits));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ledgerKeys.all });
      onClose();
    },
  });

  return (
    <OverlayDrawer open onOpenChange={(_, d) => !d.open && onClose()} position="end" size="medium">
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>
          Record payment from Zoho Books
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <div className={s.stack}>
          <Caption1>You are recording this payment in Talent OS. Talent OS will not change Zoho Books.</Caption1>
          <Field label="Invoice">
            <Input readOnly value={suggestion.invoice_number} />
          </Field>
          <Field label="Client">
            <Input readOnly value={suggestion.client_name ?? suggestion.client_id ?? "—"} />
          </Field>
          <div className={s.row}>
            <Field label="Payment date" required>
              <Input type="date" value={date} onChange={(_, d) => setDate(d.value)} />
            </Field>
            <Field label="Amount" required>
              <Input inputMode="decimal" value={amount} onChange={(_, d) => setAmount(d.value)} />
            </Field>
            <Field label="Currency">
              <Input value={currency} maxLength={3} onChange={(_, d) => setCurrency(d.value.toUpperCase())} style={{ width: 80 }} />
            </Field>
          </div>
          <div className={s.row}>
            <Field label="Mode">
              <Dropdown value={mode.toUpperCase()} selectedOptions={[mode]} onOptionSelect={(_, d) => setMode(d.optionValue as PaymentMode)}>
                {MODES.map((m) => (
                  <Option key={m} value={m}>
                    {m.toUpperCase()}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Reference">
              <Input value={reference} onChange={(_, d) => setReference(d.value)} />
            </Field>
            {suggestion.tds_amount ? (
              <Field label="TDS">
                <Input readOnly value={suggestion.tds_amount} />
              </Field>
            ) : null}
          </div>
          {save.error ? (
            <MessageBar intent="error">
              <MessageBarBody>{errorMessage(save.error)}</MessageBarBody>
            </MessageBar>
          ) : null}
        </div>
      </DrawerBody>
      <DrawerFooter>
        <Button appearance="primary" disabled={!amount || !date || save.isPending} onClick={() => save.mutate()}>
          Record payment
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </DrawerFooter>
    </OverlayDrawer>
  );
}
