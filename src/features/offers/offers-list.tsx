"use client";

import { makeStyles, Switch, Tab, TabList, tokens } from "@fluentui/react-components";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { NoAccess, PagingBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { OfferDrawer } from "./offer-drawer";
import { OffersGrid } from "./offers-grid";
import { useOfferList } from "./use-offers";

const GROUPS = {
  open: ["draft", "pending_approval", "approved", "released", "viewed"],
  approval: ["pending_approval"],
  released: ["released", "viewed"],
  closed: ["accepted", "declined", "expired", "withdrawn"],
} as const;
type Group = keyof typeof GROUPS;

const useStyles = makeStyles({
  bar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  grow: { flex: 1 },
});

const PAGE_SIZE = 50;

/** `/offers`: offers by state (optionally only mine); `?open=<id>` opens an offer's drawer (links from My approvals). */
export function OffersList() {
  const styles = useStyles();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const canRead = usePermission("offer:read");
  const [group, setGroup] = useState<Group>("open");
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const q = useOfferList({ status: [...GROUPS[group]], owner: mine ? "mine" : null, page, pageSize: PAGE_SIZE });
  const openId = params.get("open");
  const setOpen = (id: string | null) => router.replace(id ? `${pathname}?open=${encodeURIComponent(id)}` : pathname, { scroll: false });

  if (!canRead) return <NoAccess what="offers" />;
  return (
    <>
      <PageHeader title="Offers" subtitle="Offers from draft to acceptance. Open one to edit terms, preview the letter, follow approvals and release it." />
      <div className={styles.bar}>
        <TabList
          selectedValue={group}
          onTabSelect={(_, d) => {
            setGroup(d.value as Group);
            setPage(1);
          }}
          aria-label="Offer states"
          className={styles.grow}
        >
          <Tab value="open">Open</Tab>
          <Tab value="approval">Awaiting approval</Tab>
          <Tab value="released">With candidate</Tab>
          <Tab value="closed">Closed</Tab>
        </TabList>
        <Switch
          label="Only mine"
          checked={mine}
          onChange={(_, d) => {
            setMine(d.checked);
            setPage(1);
          }}
        />
      </div>
      <OffersGrid items={q.data?.items} loading={q.isPending} error={q.error} onOpen={(o) => setOpen(o.id)} showDemand emptyText="No offers here." />
      {q.data && q.data.total > PAGE_SIZE && <PagingBar page={page} pageSize={PAGE_SIZE} total={q.data.total} onPageChange={setPage} busy={q.isFetching} />}
      {openId && <OfferDrawer offerId={openId} onClose={() => setOpen(null)} />}
    </>
  );
}
