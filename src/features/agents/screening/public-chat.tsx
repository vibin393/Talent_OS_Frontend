"use client";

import { Body1, Button, Card, makeStyles, Spinner, Text, tokens } from "@fluentui/react-components";
import { useMemo } from "react";
import { linkErrorCopy } from "@/features/public-links/logic";
import { isApiError } from "@/lib/api/errors";
import { publicScreeningChatApi } from "./api";
import { CandidateChat } from "./candidate-chat";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalXL, gap: tokens.spacingVerticalL, "@media (max-width: 480px)": { padding: tokens.spacingHorizontalM } },
});

/** `/l/{token}` with purpose `agent_conversation`: the candidate chat without portal chrome. */
export function PublicScreeningChat({ token }: { token: string }) {
  const styles = useStyles();
  const source = useMemo(() => publicScreeningChatApi.source(token), [token]);
  return (
    <Card className={styles.card}>
      <CandidateChat
        source={source}
        renderLoading={() => <Spinner label="Loading…" />}
        renderError={(e, retry) => {
          const copy = isApiError(e) ? linkErrorCopy(e.status, e.code) : linkErrorCopy(500, undefined);
          return (
            <div role="alert">
              <Text weight="semibold" as="p">
                {copy.title}
              </Text>
              <Body1 as="p">{copy.body}</Body1>
              {!(isApiError(e) && (e.status === 404 || e.status === 410)) && <Button onClick={retry}>Try again</Button>}
            </div>
          );
        }}
      />
    </Card>
  );
}
