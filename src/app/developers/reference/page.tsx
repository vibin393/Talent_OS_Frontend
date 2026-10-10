import type { Metadata } from "next";
import bundle from "../_generated/docs-bundle.json";
import { operationAnchor } from "@/features/developers/logic";

export const metadata: Metadata = { title: "API reference" };

type Param = { name: string; in: string; required?: boolean; description?: string };
type Op = {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Param[];
  "x-required-scopes"?: string[];
};

/** Generated from the pinned public OpenAPI (Epic 67) at build time: one section per resource tag. */
export default function ReferencePage() {
  const sensitive = new Set(bundle.scopes.filter((s) => s.sensitive).map((s) => s.key));
  const groups = new Map<string, { method: string; path: string; op: Op }[]>();
  for (const [path, ops] of Object.entries(bundle.openapi.paths as unknown as Record<string, Record<string, Op>>)) {
    for (const [method, op] of Object.entries(ops)) {
      const tag = (op.tags?.[0] ?? "other").replace(/^public:/, "");
      const row = { method: method.toUpperCase(), path: path.replace("/api/public/v1", "/public/v1"), op };
      groups.set(tag, [...(groups.get(tag) ?? []), row]);
    }
  }
  return (
    <>
      <h1>API reference</h1>
      <p>
        Base URL <code>/public/v1</code>. Authenticate with an OAuth access token: <code>Authorization: Bearer …</code>.
      </p>
      {[...groups.entries()].sort().map(([tag, ops]) => (
        <section key={tag} aria-labelledby={`tag-${tag}`}>
          <h2 id={`tag-${tag}`}>{tag}</h2>
          {ops.map(({ method, path, op }) => (
            <article key={`${method} ${path}`} id={operationAnchor(op.operationId ?? `${method}-${path}`)}>
              <h3>
                <span className="dev-method">{method}</span>
                <code>{path}</code>
              </h3>
              <p>
                {op.summary}
                {op.description ? ` — ${op.description}` : ""}
              </p>
              <p>
                Required scopes:{" "}
                {(op["x-required-scopes"] ?? []).map((s) => (
                  <span key={s} className={sensitive.has(s) ? "dev-badge sensitive" : "dev-badge"}>
                    {s}
                    {sensitive.has(s) ? " (sensitive)" : ""}
                  </span>
                ))}
              </p>
              {op.parameters?.length ? (
                <table className="dev-table">
                  <thead>
                    <tr>
                      <th scope="col">Parameter</th>
                      <th scope="col">In</th>
                      <th scope="col">Required</th>
                      <th scope="col">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {op.parameters.map((p) => (
                      <tr key={`${p.in}-${p.name}`}>
                        <td>
                          <code>{p.name}</code>
                        </td>
                        <td>{p.in}</td>
                        <td>{p.required ? "Yes" : "No"}</td>
                        <td>{p.description ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </article>
          ))}
        </section>
      ))}
    </>
  );
}
