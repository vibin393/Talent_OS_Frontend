"use client";

import { Button, DrawerBody, DrawerHeader, DrawerHeaderTitle, OverlayDrawer, Tab, TabList } from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useState } from "react";
import type { AppOut } from "./api";
import { ListingForm } from "./listing-form";
import { UsageCharts } from "./usage-charts";

/** App detail drawer (74.4/74.5): the Listing editor and Usage analytics for one partner App. */
export function AppDetailDrawer({ app, onClose }: { app: AppOut; onClose: () => void }) {
  const [tab, setTab] = useState<"listing" | "usage">("listing");
  return (
    <OverlayDrawer open onOpenChange={(_, d) => !d.open && onClose()} position="end" size="large">
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>{app.name}</DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as "listing" | "usage")}>
          <Tab value="listing">Listing</Tab>
          <Tab value="usage">Usage</Tab>
        </TabList>
        {tab === "listing" ? <ListingForm app={app} /> : <UsageCharts appId={app.id} />}
      </DrawerBody>
    </OverlayDrawer>
  );
}
