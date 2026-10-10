"use client";

import {
  Body1,
  Button,
  Caption1,
  Field,
  Input,
  makeStyles,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Subtitle2,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { QuestionCircle20Regular, Search20Regular, Sparkle20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import type { QuerySyntaxProblem } from "./query-error";

const useStyles = makeStyles({
  row: { display: "flex", alignItems: "flex-start", gap: tokens.spacingHorizontalS },
  field: { flex: 1, minWidth: 0 },
  mono: { fontFamily: tokens.fontFamilyMonospace },
  help: { maxWidth: "360px", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  table: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalXXS,
    margin: 0,
    "& dt": { fontFamily: tokens.fontFamilyMonospace, color: tokens.colorBrandForeground1 },
    "& dd": { margin: 0 },
  },
  error: { display: "flex", flexDirection: "column" },
  excerpt: { fontFamily: tokens.fontFamilyMonospace, whiteSpace: "pre" },
  buttonAlign: { marginTop: "26px" },
});

const SYNTAX: [string, string][] = [
  ['"data engineer"', "Exact phrase"],
  ["azure AND databricks", "Both terms (AND is implied between terms)"],
  ["spark OR databricks", "Either term"],
  ["NOT sas  /  -sas", "Exclude a term"],
  ["(a OR b) AND c", "Group with parentheses"],
  ["data*", "Prefix match"],
];

function SyntaxHelp() {
  const styles = useStyles();
  return (
    <Popover withArrow positioning="below-end">
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="subtle" icon={<QuestionCircle20Regular />} aria-label="Search syntax help" className={styles.buttonAlign} />
      </PopoverTrigger>
      <PopoverSurface aria-label="Search syntax">
        <div className={styles.help}>
          <Subtitle2>Boolean search syntax</Subtitle2>
          <dl className={styles.table}>
            {SYNTAX.map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                <dd>
                  <Caption1>{v}</Caption1>
                </dd>
              </div>
            ))}
          </dl>
          <Body1>Operators must be UPPERCASE; lowercase and/or/not are searched as words.</Body1>
        </div>
      </PopoverSurface>
    </Popover>
  );
}

/** Boolean query `Input` (monospace) with syntax help; a 422 `invalid_query` shows inline with a caret. */
export function BooleanBox({
  initial,
  problem,
  busy,
  onSubmit,
}: {
  initial: string;
  problem: QuerySyntaxProblem | null;
  busy: boolean;
  onSubmit: (q: string) => void;
}) {
  const styles = useStyles();
  const [text, setText] = useState(initial);
  const message = problem ? (
    <span className={styles.error}>
      <span>
        {problem.message}
        {problem.position !== null ? ` (position ${problem.position})` : ""}
      </span>
      {problem.excerpt && <span className={styles.excerpt}>{problem.excerpt}</span>}
    </span>
  ) : undefined;
  return (
    <form
      className={styles.row}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text);
      }}
    >
      <Field
        className={styles.field}
        label="Boolean query"
        validationState={problem ? "error" : "none"}
        validationMessage={message}
      >
        <Input
          className={styles.mono}
          input={{ className: styles.mono, spellCheck: false }}
          value={text}
          onChange={(_, d) => setText(d.value)}
          placeholder='("data engineer" OR dataengineer) AND databricks NOT sas'
          maxLength={1000}
          contentBefore={<Search20Regular aria-hidden />}
        />
      </Field>
      <Button type="submit" appearance="primary" disabled={busy} className={styles.buttonAlign}>
        Search
      </Button>
      <SyntaxHelp />
    </form>
  );
}

/** Natural-language query `Textarea` + primary "Search" (Enter submits, Shift+Enter adds a line). */
export function NlBox({ initial, busy, onSubmit }: { initial: string; busy: boolean; onSubmit: (text: string) => void }) {
  const styles = useStyles();
  const [text, setText] = useState(initial);
  return (
    <form
      className={styles.row}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSubmit(text.trim());
      }}
    >
      <Field className={styles.field} label="Describe who you are looking for">
        <Textarea
          resize="vertical"
          rows={2}
          value={text}
          maxLength={1000}
          placeholder="Data engineers with Databricks and banking experience, available this month"
          onChange={(_, d) => setText(d.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (text.trim()) onSubmit(text.trim());
            }
          }}
        />
      </Field>
      <Button type="submit" appearance="primary" icon={<Sparkle20Regular />} disabled={busy || !text.trim()} className={styles.buttonAlign}>
        Search
      </Button>
    </form>
  );
}
