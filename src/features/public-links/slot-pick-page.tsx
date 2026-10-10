"use client";

import { Card, makeStyles, tokens } from "@fluentui/react-components";
import { useMemo } from "react";
import { publicSlotPickApi } from "@/features/agents/scheduling/api";
import { SlotPicker } from "@/features/agents/scheduling/slot-picker";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalXL, gap: tokens.spacingVerticalL, "@media (max-width: 480px)": { padding: tokens.spacingHorizontalM } },
});

/** `/l/{token}` with purpose `slot_pick` (Epic 59): the candidate picks an interview time, asks for others or suggests times. */
export function PublicSlotPick({ token }: { token: string }) {
  const styles = useStyles();
  const source = useMemo(() => publicSlotPickApi.source(token), [token]);
  return (
    <Card className={styles.card}>
      <SlotPicker source={source} />
    </Card>
  );
}
