import type { Metadata } from "next";
import bundle from "../_generated/docs-bundle.json";

export const metadata: Metadata = { title: "Changelog" };

export default function ChangelogPage() {
  return (
    <>
      <h1>Changelog</h1>
      <p>
        Public API v1 changes. Deprecations are announced here and in the <code>Deprecation</code> and{" "}
        <code>Sunset</code> response headers.
      </p>
      <pre className="dev-code">
        <code>{JSON.stringify(bundle.changelog, null, 2)}</code>
      </pre>
    </>
  );
}
