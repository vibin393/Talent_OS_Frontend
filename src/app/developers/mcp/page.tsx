import type { Metadata } from "next";
import Link from "next/link";
import bundle from "../_generated/docs-bundle.json";

export const metadata: Metadata = { title: "MCP" };

const CLASS_LABEL: Record<string, string> = { reads: "Reads", creates: "Creates", proposes: "Proposes" };
type Tool = (typeof bundle.mcp.tools)[number];

export default function McpPage() {
  const groups = new Map<string, Tool[]>();
  for (const t of bundle.mcp.tools) groups.set(t.group, [...(groups.get(t.group) ?? []), t]);
  return (
    <>
      <h1>MCP for AI assistants</h1>
      <p>
        Endpoint <code>/mcp</code> (Streamable HTTP). Supported protocol versions:{" "}
        {bundle.mcp.protocol_versions.join(", ")}.
      </p>
      <p>
        Connect with an OAuth authorization-code + PKCE token for the <code>mcp</code> resource. See the{" "}
        <Link href="/developers/docs/mcp">MCP guide</Link>.
      </p>
      {[...groups.entries()].map(([group, list]) => (
        <section key={group} aria-labelledby={`g-${group}`}>
          <h2 id={`g-${group}`}>{group}</h2>
          {list.map((t) => (
            <article key={t.name} id={`tool-${t.name}`}>
              <h3>
                <code>{t.name}</code>{" "}
                <span className="dev-badge">{CLASS_LABEL[t.execution_class] ?? t.execution_class}</span>
              </h3>
              <p>
                {t.title}: {t.description}
              </p>
              <p>
                Scopes:{" "}
                {t.scopes.map((s) => (
                  <span key={s} className="dev-badge">
                    {s}
                  </span>
                ))}{" "}
                · at most {t.max_results} results
              </p>
            </article>
          ))}
        </section>
      ))}
    </>
  );
}
