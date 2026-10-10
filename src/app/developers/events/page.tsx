import type { Metadata } from "next";
import bundle from "../_generated/docs-bundle.json";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <>
      <h1>Event catalogue</h1>
      <p>Webhook payloads are thin: ids, type, time and safe summary fields. Fetch details through the API.</p>
      {bundle.events.map((e) => (
        <section key={e.type} id={`event-${e.type}`} aria-labelledby={`h-${e.type}`}>
          <h2 id={`h-${e.type}`}>
            <code>{e.type}</code> <span className="dev-badge">v{e.version}</span>
          </h2>
          <p>{e.description}</p>
          <p>
            Scopes:{" "}
            {e.scopes.map((s) => (
              <span key={s} className="dev-badge">
                {s}
              </span>
            ))}
          </p>
          {Object.keys(e.example).length ? (
            <pre className="dev-code">
              <code>{JSON.stringify(e.example, null, 2)}</code>
            </pre>
          ) : null}
        </section>
      ))}
    </>
  );
}
