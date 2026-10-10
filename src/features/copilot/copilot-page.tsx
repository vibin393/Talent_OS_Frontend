"use client";

/** Full-page Copilot (Epic 54 B1, `/ai/copilot`): the user's history beside one conversation. */
import { Button, makeStyles, MessageBar, MessageBarBody, Spinner, tokens } from "@fluentui/react-components";
import { Compose20Regular } from "@fluentui/react-icons";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { hasPermission } from "@/features/auth/permissions";
import { useMe } from "@/features/auth/use-me";
import { useCopilotStatus } from "./api";
import { COPY, unavailableMessage } from "./copy";
import { ConversationView } from "./conversation-view";
import { HistoryList } from "./history-list";

const useStyles = makeStyles({
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 300px) 1fr",
    gap: tokens.spacingHorizontalXL,
    height: "calc(100svh - 220px)",
    minHeight: "420px",
    "@media (max-width: 767px)": { gridTemplateColumns: "1fr", height: "auto" },
  },
  side: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, overflowY: "auto", minHeight: 0 },
  main: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingHorizontalL,
    boxShadow: tokens.shadow4,
  },
});

export function CopilotPage() {
  const styles = useStyles();
  const me = useMe();
  const params = useSearchParams();
  const allowed = hasPermission(me.data?.permissions, "copilot:use");
  const status = useCopilotStatus(allowed);
  const [conversationId, setConversationId] = useState<string | null>(params.get("conversation"));
  const [mode, setMode] = useState("copilot");
  const [nonce, setNonce] = useState(0);
  if (!allowed) {
    return (
      <MessageBar intent="warning">
        <MessageBarBody>You don&apos;t have access to Copilot.</MessageBarBody>
      </MessageBar>
    );
  }
  const data = status.data;
  const warning = data && !data.available ? unavailableMessage(data.reason) : null;
  return (
    <div>
      <PageHeader title="Copilot history" />
      <div className={styles.layout}>
        <div className={styles.side}>
          <Button
            icon={<Compose20Regular />}
            onClick={() => {
              setConversationId(null);
              setNonce((n) => n + 1);
            }}
          >
            {COPY.newChat}
          </Button>
          <HistoryList
            selectedId={conversationId}
            retentionDays={data?.retention_days ?? null}
            onOpen={(id, agentKey) => {
              setConversationId(id);
              setMode(agentKey);
              setNonce((n) => n + 1);
            }}
            onDeleted={(id) => {
              if (id === conversationId) {
                setConversationId(null);
                setNonce((n) => n + 1);
              }
            }}
          />
        </div>
        <div className={styles.main}>
          {status.isPending ? <Spinner label="Loading Copilot" /> : null}
          {warning ? (
            <MessageBar intent="warning">
              <MessageBarBody>{warning}</MessageBarBody>
            </MessageBar>
          ) : null}
          {data?.available ? (
            <ConversationView
              key={`${mode}:${nonce}`}
              conversationId={conversationId}
              mode={mode}
              pageContext={null}
              status={data}
              onConversation={setConversationId}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
