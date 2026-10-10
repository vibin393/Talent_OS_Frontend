"use client";

import { makeStyles, Tab, TabList, tokens } from "@fluentui/react-components";
import { useRouter } from "next/navigation";
import { useFairnessPermissions } from "./use-fairness";

const useStyles = makeStyles({ root: { marginBottom: tokens.spacingVerticalL } });

type Section = "reports" | "aedt" | "settings";

const ROUTES: Record<Section, string> = { reports: "/fairness", aedt: "/fairness/aedt", settings: "/fairness/settings" };

/** Section tabs of the Fairness area (reports, AEDT inventory, settings). */
export function FairnessNav({ current }: { current: Section }) {
  const styles = useStyles();
  const router = useRouter();
  const { canRead, canConfigure, canManageAedt } = useFairnessPermissions();
  return (
    <TabList
      className={styles.root}
      selectedValue={current}
      onTabSelect={(_, d) => router.push(ROUTES[d.value as Section])}
      aria-label="Fairness sections"
    >
      {canRead && <Tab value="reports">Reports</Tab>}
      {(canRead || canManageAedt) && <Tab value="aedt">AEDT inventory</Tab>}
      {(canRead || canConfigure) && <Tab value="settings">Settings</Tab>}
    </TabList>
  );
}
