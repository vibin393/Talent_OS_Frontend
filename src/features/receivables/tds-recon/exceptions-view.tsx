"use client";

import {
  Badge,
  Tab,
  TabList,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ErrorBar, GridSkeleton, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { Amount } from "../components";
import { tdsReconApi, tdsReconKeys, type TdsFilters } from "./api";

const REASON_LABEL = { no_statement_line: "Not in statement", booking_unmatched: "Booking unmatched" } as const;

/** Exceptions: statement lines with no recorded deduction, and recorded deductions not deposited. */
export function TdsExceptionsView({ filters }: { filters: TdsFilters }) {
  const admin = useAdminStyles();
  const [tab, setTab] = useState<"dnr" | "rnd">("dnr");
  const q = useQuery({ queryKey: tdsReconKeys.exceptions(filters), queryFn: ({ signal }) => tdsReconApi.exceptions(filters, signal) });
  const dnr = q.data?.deducted_not_recorded ?? [];
  const rnd = q.data?.recorded_not_deposited ?? [];
  return (
    <>
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as "dnr" | "rnd")} size="small">
        <Tab value="dnr">Deducted, not recorded{q.data ? ` (${dnr.length})` : ""}</Tab>
        <Tab value="rnd">Recorded, not deposited{q.data ? ` (${rnd.length})` : ""}</Tab>
      </TabList>
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      <div className={admin.surface}>
        {!q.data ? (
          !q.error && <GridSkeleton />
        ) : tab === "dnr" ? (
          dnr.length === 0 ? (
            <div className={admin.empty}>Every statement line has a recorded deduction.</div>
          ) : (
            <Table aria-label="Deducted, not recorded" className={admin.grid}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Deductor</TableHeaderCell>
                  <TableHeaderCell>TAN</TableHeaderCell>
                  <TableHeaderCell>Section</TableHeaderCell>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Amount paid</TableHeaderCell>
                  <TableHeaderCell>TDS deducted</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dnr.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.client_name ?? l.deductor_name}</TableCell>
                    <TableCell>{l.deductor_tan}</TableCell>
                    <TableCell>{l.section}</TableCell>
                    <TableCell>{l.transaction_date}</TableCell>
                    <TableCell>
                      <Amount amount={l.amount_paid} currency="INR" />
                    </TableCell>
                    <TableCell>
                      <Amount amount={l.tds_deducted} currency="INR" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : rnd.length === 0 ? (
          <div className={admin.empty}>Every recorded deduction appears in the statement.</div>
        ) : (
          <Table aria-label="Recorded, not deposited" className={admin.grid}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Client</TableHeaderCell>
                <TableHeaderCell>Section</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Amount</TableHeaderCell>
                <TableHeaderCell>Reason</TableHeaderCell>
                <TableHeaderCell>Invoice</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rnd.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.client_name ?? "—"}</TableCell>
                  <TableCell>{d.section_code ?? "—"}</TableCell>
                  <TableCell>{d.deduction_date}</TableCell>
                  <TableCell>
                    <Amount amount={d.inr_amount} currency="INR" />
                  </TableCell>
                  <TableCell>
                    <Badge appearance="tint" color={d.reason === "no_statement_line" ? "danger" : "warning"}>
                      {REASON_LABEL[d.reason] ?? d.reason}
                    </Badge>
                  </TableCell>
                  <TableCell>{d.invoice_id ? <Link href={`/billing/invoices/${d.invoice_id}`}>Open</Link> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
