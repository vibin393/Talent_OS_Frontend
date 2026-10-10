"use client";

import {
  Badge,
  Dropdown,
  Field,
  makeStyles,
  mergeClasses,
  Option,
  Tab,
  TabList,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { formatMoney } from "@/features/billing/money";
import { legalEntitiesApi, legalEntityKeys } from "@/features/legal-entities/api";

export const useRcvStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, minWidth: 0 },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "flex-end" },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    padding: tokens.spacingHorizontalL,
    minWidth: 0,
  },
  tiles: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: tokens.spacingHorizontalM },
  tile: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    padding: tokens.spacingHorizontalM,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  tileValue: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold, fontVariantNumeric: "tabular-nums" },
  muted: { color: tokens.colorNeutralForeground3 },
  amount: { fontVariantNumeric: "tabular-nums", textAlign: "right", whiteSpace: "nowrap" },
  negative: { color: tokens.colorPaletteRedForeground1 },
  scroll: { overflowX: "auto", minWidth: 0 },
  grow: { flex: "1 1 200px", minWidth: 0 },
  narrow: { width: "160px" },
  error: { color: tokens.colorPaletteRedForeground1 },
});

const TABS: { href: string; label: string }[] = [
  { href: "/receivables/payments", label: "Payments" },
  { href: "/receivables/bank-imports", label: "Bank import" },
  { href: "/receivables/aging", label: "AR aging" },
  { href: "/receivables/collections", label: "Collections" },
  { href: "/receivables/write-offs", label: "Write-offs" },
  { href: "/receivables/tds", label: "TDS" },
  { href: "/receivables/statements", label: "Statements" },
  { href: "/receivables/exports", label: "Accounting export" },
  { href: "/receivables/reconciliation", label: "Reconciliation" },
];

/** Section navigation for the receivables pages. */
export function ReceivablesTabs() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const current = TABS.find((t) => pathname.startsWith(t.href))?.href ?? TABS[0].href;
  return (
    <TabList selectedValue={current} onTabSelect={(_, d) => router.push(String(d.value))} size="small">
      {TABS.map((t) => (
        <Tab key={t.href} value={t.href}>
          {t.label}
        </Tab>
      ))}
    </TabList>
  );
}

/** Legal Entity dropdown; selects the first entity when none is chosen yet. */
export function LegalEntitySelect({ value, onChange, className }: { value: string | null; onChange: (id: string) => void; className?: string }) {
  const q = useQuery({ queryKey: legalEntityKeys.list, queryFn: ({ signal }) => legalEntitiesApi.list(signal) });
  const entities = useMemo(() => q.data ?? [], [q.data]);
  useEffect(() => {
    if (!value && entities.length > 0) onChange(entities[0].id);
  }, [value, entities, onChange]);
  const selected = entities.find((e) => e.id === value);
  return (
    <Field label="Legal entity" className={className}>
      <Dropdown value={selected?.name ?? ""} selectedOptions={value ? [value] : []} onOptionSelect={(_, d) => d.optionValue && onChange(d.optionValue)}>
        {entities.map((e) => (
          <Option key={e.id} value={e.id}>
            {e.name}
          </Option>
        ))}
      </Dropdown>
    </Field>
  );
}

export function Amount({ amount, currency, strong }: { amount: string | null | undefined; currency: string; strong?: boolean }) {
  const s = useRcvStyles();
  const neg = (amount ?? "").startsWith("-");
  return (
    <span className={mergeClasses(s.amount, neg && s.negative)} style={strong ? { fontWeight: 600 } : undefined}>
      {formatMoney({ amount, currency })}
    </span>
  );
}

const STATUS_COLOR: Record<string, "success" | "warning" | "danger" | "informative" | "subtle" | "brand"> = {
  paid: "success",
  fully_allocated: "success",
  executed: "success",
  received: "success",
  kept: "success",
  closed: "subtle",
  open: "informative",
  partially_paid: "warning",
  partially_allocated: "warning",
  pending_approval: "warning",
  expected: "warning",
  unpaid: "informative",
  unallocated: "informative",
  reversed: "danger",
  broken: "danger",
  lapsed: "danger",
  rejected: "danger",
  mismatch: "danger",
  written_off: "subtle",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <Badge appearance="tint" color={STATUS_COLOR[status] ?? "informative"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
