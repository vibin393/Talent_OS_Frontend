import type { Metadata } from "next";
import bundle from "../_generated/docs-bundle.json";

export const metadata: Metadata = { title: "Scopes" };

export default function ScopesPage() {
  return (
    <>
      <h1>Scopes</h1>
      <table className="dev-table">
        <thead>
          <tr>
            <th scope="col">Scope</th>
            <th scope="col">Label</th>
            <th scope="col">Description</th>
            <th scope="col">Purpose</th>
            <th scope="col">Resources</th>
          </tr>
        </thead>
        <tbody>
          {bundle.scopes.map((s) => (
            <tr key={s.key} id={`scope-${s.key}`}>
              <td>
                <code>{s.key}</code> {s.sensitive ? <span className="dev-badge sensitive">Sensitive</span> : null}
              </td>
              <td>{s.label}</td>
              <td>{s.description}</td>
              <td>{s.purpose}</td>
              <td>
                {s.resources.join(", ")}
                {s.api_key_allowed ? "" : " (not for API keys)"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
