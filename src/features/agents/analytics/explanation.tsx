"use client";

import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Caption1, Text, makeStyles, tokens } from "@fluentui/react-components";
import { LABELS } from "./logic";

const useStyles = makeStyles({
  panel: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, paddingBottom: tokens.spacingVerticalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** "How was this calculated?" -- the deterministic explanation generated from the Definition (never the model's prose). */
export function Explanation({ text, sourceLabel }: { text: string; sourceLabel: string | null }) {
  const styles = useStyles();
  return (
    <Accordion collapsible>
      <AccordionItem value="how">
        <AccordionHeader size="small">{LABELS.howCalculated}</AccordionHeader>
        <AccordionPanel>
          <div className={styles.panel}>
            <Text>{text}</Text>
            {sourceLabel && <Caption1 className={styles.muted}>Source: {sourceLabel}</Caption1>}
          </div>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
}
