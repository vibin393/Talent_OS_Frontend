"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  makeStyles,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, DetailsDrawer, ErrorBar, formatDateTime } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { webhookKeys, webhooksApi } from "./api";

const useStyles = makeStyles({
  pre: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingHorizontalS,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    maxHeight: "320px",
    overflow: "auto",
  },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalL },
});

/** "Delivery details" (Epic 68, B4): the thin request envelope, the attempts and their response excerpts (plain text). */
export function DeliveryDrawer({ deliveryId, canManage, onClose }: { deliveryId: string | null; canManage: boolean; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({
    queryKey: webhookKeys.delivery(deliveryId ?? ""),
    queryFn: ({ signal }) => webhooksApi.delivery(deliveryId ?? "", signal),
    enabled: deliveryId !== null,
  });
  const d = q.data;
  return (
    <DetailsDrawer
      open={deliveryId !== null}
      title="Delivery details"
      size="medium"
      onClose={onClose}
      footer={
        canManage && d ? (
          <Button appearance="primary" onClick={() => setConfirm(true)}>
            Replay
          </Button>
        ) : undefined
      }
    >
      {q.error && <ErrorBar message={errorMessage(q.error)} />}
      {d && (
        <>
          <div className={styles.section}>
            <Subtitle2>Request</Subtitle2>
            <pre className={styles.pre}>{d.request_body ? JSON.stringify(d.request_body, null, 2) : "No longer available"}</pre>
          </div>
          <div className={styles.section}>
            <Subtitle2>Attempts</Subtitle2>
            <Table size="small" aria-label="Attempts">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>#</TableHeaderCell>
                  <TableHeaderCell>Time</TableHeaderCell>
                  <TableHeaderCell>Response code</TableHeaderCell>
                  <TableHeaderCell>Latency</TableHeaderCell>
                  <TableHeaderCell>Error</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.attempts.map((a) => (
                  <TableRow key={a.n}>
                    <TableCell>{a.n}</TableCell>
                    <TableCell>{formatDateTime(a.at)}</TableCell>
                    <TableCell>{a.status_code ?? "—"}</TableCell>
                    <TableCell>{a.latency_ms !== null ? `${a.latency_ms} ms` : "—"}</TableCell>
                    <TableCell>{a.error ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Accordion collapsible multiple>
              {d.attempts
                .filter((a) => a.excerpt)
                .map((a) => (
                  <AccordionItem key={a.n} value={a.n}>
                    <AccordionHeader>Response (first 1 KB) — attempt {a.n}</AccordionHeader>
                    <AccordionPanel>
                      <pre className={styles.pre}>{a.excerpt}</pre>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
            </Accordion>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirm}
        title="Replay this delivery?"
        confirmLabel="Replay"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          if (!d) return;
          try {
            await webhooksApi.replay(d.id);
            toast.success("Replay queued.");
            void qc.invalidateQueries({ queryKey: ["webhooks", "deliveries", d.subscription_id] });
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        The same event ID is sent again with TalentOS-Replay: true.
      </ConfirmDialog>
    </DetailsDrawer>
  );
}
