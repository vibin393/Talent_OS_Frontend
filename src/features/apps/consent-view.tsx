"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Checkbox,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Title3,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { type AuthorizeView, consentApi } from "./api";
import { consentStateMessage, publisherBadge } from "./rules";

const useStyles = makeStyles({
  root: {
    maxWidth: "560px",
    margin: "0 auto",
    padding: tokens.spacingHorizontalL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "center" },
  scope: { display: "flex", flexDirection: "column" },
});

/** The OAuth consent screen (Epic 67, spec B2). App-supplied text is rendered as plain text. */
export function ConsentView({ query }: { query: string }) {
  const styles = useStyles();
  const [view, setView] = useState<AuthorizeView | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    consentApi
      .view(query)
      .then((out) => {
        if ("redirect_to" in out) {
          window.location.assign(out.redirect_to);
          return;
        }
        setView(out);
        setChecked(new Set(out.scopes));
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          window.location.assign(`/login?next=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
        } else if (e instanceof ApiError && e.status === 400) {
          setBlocked("invalid");
        } else setError(errorMessage(e));
      });
  }, [query]);

  const decide = async (approve: boolean) => {
    if (!view) return;
    try {
      const out = await consentApi.decide(view.request_id, approve, approve ? [...checked] : undefined);
      setReturning(true);
      window.location.assign(out.redirect_to);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (error)
    return (
      <div className={styles.root}>
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      </div>
    );
  if (blocked)
    return (
      <div className={styles.root}>
        <MessageBar intent="warning">
          <MessageBarBody>{consentStateMessage(blocked, "")}</MessageBarBody>
        </MessageBar>
      </div>
    );
  if (!view) return <Spinner label="Checking the request…" />;
  const appName = view.app?.name ?? view.app_name;
  const stateMessage = consentStateMessage(view.state, appName);
  if (returning) return <Spinner label={`Returning to ${appName}…`} />;
  return (
    <div className={styles.root}>
      <Title3>
        <b>{appName}</b> {view.resource === "mcp" ? "wants to use Talent OS tools for you" : "wants to access your Talent OS account"}
      </Title3>
      {view.app ? (
        <div className={styles.row}>
          <Badge appearance="tint">{publisherBadge(view.app.publisher_kind, view.app.verified, view.app.publisher_name)}</Badge>
          <Caption1>Published by {view.app.publisher_name}</Caption1>
          {view.app.homepage_url ? (
            <a href={view.app.homepage_url} target="_blank" rel="noopener noreferrer">
              Website
            </a>
          ) : null}
          {view.app.privacy_url ? (
            <a href={view.app.privacy_url} target="_blank" rel="noopener noreferrer">
              Privacy policy
            </a>
          ) : null}
        </div>
      ) : null}
      {stateMessage ? (
        <MessageBar intent="warning">
          <MessageBarBody>{stateMessage}</MessageBarBody>
        </MessageBar>
      ) : (
        <>
          {view.existing_authorization ? (
            <MessageBar intent="info">
              <MessageBarBody>
                You already allowed this app on {new Date(view.existing_authorization.granted_at).toLocaleDateString()}. Approving adds the new access
                below.
              </MessageBarBody>
            </MessageBar>
          ) : null}
          <Subtitle2>This app will be able to:</Subtitle2>
          {view.scope_details.map((s) => (
            <div key={s.key} className={styles.scope}>
              <div className={styles.row}>
                <Checkbox
                  label={s.label}
                  checked={checked.has(s.key)}
                  onChange={(_, d) =>
                    setChecked((c) => {
                      const next = new Set(c);
                      if (d.checked) next.add(s.key);
                      else next.delete(s.key);
                      return next;
                    })
                  }
                />
                {s.sensitive ? <Badge color="warning">Sensitive</Badge> : null}
              </div>
              <Caption1>{s.sensitive ? s.purpose_text : s.description}</Caption1>
            </div>
          ))}
          {view.resource === "mcp" ? (
            <MessageBar intent="info">
              <MessageBarBody>
                Your AI assistant will see the same records you can see. Anything it asks to change or send waits in your Proposals for you to approve.
                Its model provider processes the data it receives.
              </MessageBarBody>
            </MessageBar>
          ) : null}
          {view.unavailable_scopes.length + view.not_held_scopes.length > 0 ? (
            <>
              <Subtitle2>Not available</Subtitle2>
              {view.unavailable_scopes.map((s) => (
                <Caption1 key={s.key}>
                  {s.label} — Not allowed by your organisation
                </Caption1>
              ))}
              {view.not_held_scopes.map((s) => (
                <Caption1 key={s.key}>
                  {s.label} — You don&apos;t have this access yourself
                </Caption1>
              ))}
            </>
          ) : null}
          {view.data_flows.length ? (
            <>
              <Subtitle2>Data this app sends or receives</Subtitle2>
              <Table aria-label="Data flows" size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Direction</TableHeaderCell>
                    <TableHeaderCell>Data</TableHeaderCell>
                    <TableHeaderCell>Purpose</TableHeaderCell>
                    <TableHeaderCell>Country</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.data_flows.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell>{f.direction === "in" ? "Received from the app" : "Sent to the app"}</TableCell>
                      <TableCell>{[f.entity, ...f.fields].join(", ")}</TableCell>
                      <TableCell>{f.purpose}</TableCell>
                      <TableCell>{f.destination_country ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}
          <div className={styles.row}>
            <Button appearance="primary" disabled={checked.size === 0} onClick={() => void decide(true)}>
              Allow
            </Button>
            <Button onClick={() => void decide(false)}>Cancel</Button>
          </div>
          <Body1>
            <Caption1>You can remove this access at any time in Profile → Connected apps.</Caption1>
          </Body1>
        </>
      )}
    </div>
  );
}
