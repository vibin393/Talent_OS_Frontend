"use client";

/** Renders a Copilot answer from the safe Markdown subset (`markdown.ts`): React text nodes only, never HTML. */
import { Body1, makeStyles, tokens } from "@fluentui/react-components";
import Link from "next/link";
import { Fragment, type ReactNode, useMemo } from "react";
import { type Block, type Inline, parseMarkdown, refSet } from "./markdown";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, overflowWrap: "anywhere" },
  p: { margin: 0 },
  list: { margin: 0, paddingInlineStart: tokens.spacingHorizontalXL },
  code: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
    paddingInline: tokens.spacingHorizontalXXS,
  },
  tableWrap: { overflowX: "auto" },
  table: { borderCollapse: "collapse", fontSize: tokens.fontSizeBase200, minWidth: "100%" },
  cell: {
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    textAlign: "start",
    verticalAlign: "top",
  },
  link: { color: tokens.colorBrandForegroundLink },
  heading: { fontWeight: tokens.fontWeightSemibold },
});

function InlineNodes({ nodes, linkClass, codeClass }: { nodes: Inline[]; linkClass: string; codeClass: string }): ReactNode {
  return nodes.map((n, i) => {
    switch (n.kind) {
      case "text":
        return <Fragment key={i}>{n.text}</Fragment>;
      case "code":
        return (
          <code key={i} className={codeClass}>
            {n.text}
          </code>
        );
      case "strong":
        return (
          <strong key={i}>
            <InlineNodes nodes={n.children} linkClass={linkClass} codeClass={codeClass} />
          </strong>
        );
      case "em":
        return (
          <em key={i}>
            <InlineNodes nodes={n.children} linkClass={linkClass} codeClass={codeClass} />
          </em>
        );
      case "link":
        return (
          <Link key={i} href={n.href} className={linkClass}>
            <InlineNodes nodes={n.children} linkClass={linkClass} codeClass={codeClass} />
          </Link>
        );
    }
  });
}

export function AnswerMarkdown({ text, refs }: { text: string; refs: readonly (readonly [string, string])[] | null | undefined }) {
  const styles = useStyles();
  const blocks: Block[] = useMemo(() => parseMarkdown(text, refSet(refs)), [text, refs]);
  const inl = (nodes: Inline[]) => <InlineNodes nodes={nodes} linkClass={styles.link} codeClass={styles.code} />;
  return (
    <div className={styles.root}>
      {blocks.map((b, i) => {
        if (b.kind === "p")
          return (
            <Body1 as="p" key={i} className={styles.p}>
              {inl(b.children)}
            </Body1>
          );
        if (b.kind === "h")
          return (
            <Body1 as="p" key={i} className={styles.heading}>
              {inl(b.children)}
            </Body1>
          );
        if (b.kind !== "table") {
          const Tag = b.kind;
          return (
            <Tag key={i} className={styles.list}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Body1>{inl(item)}</Body1>
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <div key={i} className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {b.head.map((c, j) => (
                    <th key={j} className={styles.cell} scope="col">
                      {inl(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j}>
                    {r.map((c, k) => (
                      <td key={k} className={styles.cell}>
                        {inl(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
