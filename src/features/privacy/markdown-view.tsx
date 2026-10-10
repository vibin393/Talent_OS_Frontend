"use client";

import { Body1, Link, makeStyles, mergeClasses, Subtitle1, Subtitle2, Text, tokens } from "@fluentui/react-components";
import { Fragment } from "react";
import { type Block, type Inline, parseMarkdown } from "./markdown";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    "& ul, & ol": { margin: 0, paddingInlineStart: tokens.spacingHorizontalXL },
    "& code": { fontFamily: tokens.fontFamilyMonospace },
  },
});

function renderInline(nodes: Inline[]): React.ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return <Fragment key={i}>{n.v}</Fragment>;
      case "strong":
        return <strong key={i}>{renderInline(n.v)}</strong>;
      case "em":
        return <em key={i}>{renderInline(n.v)}</em>;
      case "code":
        return <code key={i}>{n.v}</code>;
      case "link":
        return (
          <Link key={i} href={n.href} target="_blank" rel="noopener noreferrer">
            {renderInline(n.v)}
          </Link>
        );
    }
  });
}

function renderBlock(b: Block, i: number): React.ReactNode {
  switch (b.t) {
    case "h":
      return b.level === 1 ? (
        <Subtitle1 key={i} as="h3">
          {renderInline(b.v)}
        </Subtitle1>
      ) : (
        <Subtitle2 key={i} as="h4">
          {renderInline(b.v)}
        </Subtitle2>
      );
    case "p":
      return <Body1 key={i}>{renderInline(b.v)}</Body1>;
    case "ul":
    case "ol": {
      const List = b.t;
      return (
        <List key={i}>
          {b.items.map((item, j) => (
            <li key={j}>
              <Text>{renderInline(item)}</Text>
            </li>
          ))}
        </List>
      );
    }
  }
}

/** Sanitized Markdown preview (rendered as React elements, never raw HTML). */
export function MarkdownView({ source, className }: { source: string; className?: string }) {
  const styles = useStyles();
  return <div className={mergeClasses(styles.root, className)}>{parseMarkdown(source).map(renderBlock)}</div>;
}
