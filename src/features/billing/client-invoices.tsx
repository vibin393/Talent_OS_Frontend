"use client";

import {
  Button,
  makeStyles,
  mergeClasses,
  Spinner,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { errorMessage } from "@/lib/api/errors";
import { billingKeys, portalBillingApi, portalPdfUrl } from "./api";
import { formatMoney } from "./money";
import type { PortalInvoiceSummary } from "./types";

const useStyles = makeStyles({
  list: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    maxWidth: "720px",
  },
  card: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    minWidth: 0,
  },
  grow: { flex: "1 1 180px", minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
  amount: {
    fontVariantNumeric: "tabular-nums",
    fontWeight: tokens.fontWeightSemibold,
  },
});

const LABEL: Record<PortalInvoiceSummary["kind"], string> = {
  invoice: "Invoice",
  credit_note: "Credit note",
  debit_note: "Debit note",
};

/** Client Portal `/client/invoices`: issued invoices / notes with download (mobile-first from 360 px). */
export function ClientInvoices() {
  const s = useStyles();
  const q = useQuery({
    queryKey: billingKeys.portal,
    queryFn: ({ signal }) => portalBillingApi.list(signal),
  });
  if (!q.data)
    return q.error ? <Text>{errorMessage(q.error)}</Text> : <Spinner />;
  if (q.data.length === 0)
    return <Text className={s.muted}>No invoices yet.</Text>;
  return (
    <div className={s.list}>
      {q.data.map((d) => (
        <div key={d.id} className={s.card}>
          <div className={s.grow}>
            <Text weight="semibold">{`${LABEL[d.kind]} ${d.number ?? ""}`}</Text>
            <br />
            <Text
              size={200}
              className={s.muted}
            >{`${d.doc_date ?? ""}${d.due_date ? ` · due ${d.due_date}` : ""}${d.status === "cancelled" ? " · cancelled" : ""}`}</Text>
          </div>
          <span className={mergeClasses(s.amount)}>
            {formatMoney({ amount: d.document_total, currency: d.currency })}
          </span>
          <Button as="a" href={portalPdfUrl(d.kind, d.id)} size="small">
            Download
          </Button>
        </div>
      ))}
    </div>
  );
}
