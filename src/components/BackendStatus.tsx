"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  makeStyles,
  Spinner,
  Subtitle2,
  Title3,
  tokens,
} from "@fluentui/react-components";
import { ArrowClockwise20Regular, CheckmarkCircle20Filled, DismissCircle20Filled } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { MessageResponse } from "@/lib/api/types";

type Status = { state: "loading" } | { state: "ok"; message: string } | { state: "error"; message: string };

const useStyles = makeStyles({
  page: {
    minHeight: "100svh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  card: {
    width: "100%",
    maxWidth: "560px",
    padding: tokens.spacingHorizontalXXL,
    gap: tokens.spacingVerticalL,
  },
  muted: { color: tokens.colorNeutralForeground2 },
  code: { fontFamily: tokens.fontFamilyMonospace },
  ok: { color: tokens.colorPaletteGreenForeground1 },
  error: { color: tokens.colorPaletteRedForeground1 },
  actions: { alignSelf: "flex-start" },
});

function useCheck(path: "/api/pulse" | "/api/health") {
  return useQuery({
    queryKey: ["status", path],
    queryFn: ({ signal }) => api.get<MessageResponse>(path, { signal, skipAuthHandler: true }),
    retry: false,
    staleTime: 0,
  });
}

function toStatus(q: ReturnType<typeof useCheck>): Status {
  if (q.isPending) return { state: "loading" };
  if (q.isError) return { state: "error", message: errorMessage(q.error, q.error.message) };
  if (q.data) return { state: "ok", message: q.data.message };
  return { state: "loading" };
}

function Row({ label, status }: { label: string; status: Status }) {
  const styles = useStyles();
  const image =
    status.state === "ok" ? (
      <CheckmarkCircle20Filled className={styles.ok} aria-hidden />
    ) : status.state === "error" ? (
      <DismissCircle20Filled className={styles.error} aria-hidden />
    ) : (
      <Spinner size="extra-tiny" aria-hidden />
    );
  return (
    <Card appearance="outline" size="small">
      <CardHeader
        image={image}
        header={<Subtitle2>{label}</Subtitle2>}
        action={
          <Badge
            appearance="tint"
            color={status.state === "ok" ? "success" : status.state === "error" ? "danger" : "informative"}
            role="status"
          >
            {status.state === "loading" ? "Checking…" : status.message}
          </Badge>
        }
      />
    </Card>
  );
}

export default function BackendStatus() {
  const styles = useStyles();
  const pulse = useCheck("/api/pulse");
  const health = useCheck("/api/health");

  return (
    <div className={styles.page}>
      <main>
        <Card className={styles.card}>
          <Title3 as="h1">Talent OS status</Title3>
          <Body1 className={styles.muted}>
            API: <code className={styles.code}>/api</code> (proxied to the backend)
          </Body1>
          <Row label="API (/api/pulse)" status={toStatus(pulse)} />
          <Row label="Database (/api/health)" status={toStatus(health)} />
          <Button
            appearance="primary"
            icon={<ArrowClockwise20Regular />}
            className={styles.actions}
            onClick={() => {
              pulse.refetch();
              health.refetch();
            }}
          >
            Re-check
          </Button>
        </Card>
      </main>
    </div>
  );
}
