import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./developers.css";

export const metadata: Metadata = { title: { default: "Talent OS for Developers", template: "%s · Talent OS Developers" } };

const NAV = [
  ["/developers/docs/getting-started", "Docs"],
  ["/developers/reference", "API reference"],
  ["/developers/events", "Events"],
  ["/developers/mcp", "MCP"],
  ["/developers/scopes", "Scopes"],
  ["/developers/changelog", "Changelog"],
  ["/developers/workspace", "Workspace"],
] as const;

/** Developer site shell (Epic 74, spec B): statically rendered, no API calls, works when the API is degraded. */
export default function DevelopersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dev-site">
      <a className="dev-skip" href="#dev-main">Skip to content</a>
      <header className="dev-top">
        <Link href="/developers" className="dev-brand">Talent OS <span>Developers</span></Link>
        <nav aria-label="Developer site">
          <ul>
            {NAV.map(([href, label]) => (
              <li key={href}><Link href={href}>{label}</Link></li>
            ))}
            <li><Link href="/developers/sign-in">Sign in</Link></li>
          </ul>
        </nav>
      </header>
      <main id="dev-main" className="dev-main">{children}</main>
      <footer className="dev-footer">
        <p>Talent OS for Developers · <Link href="/developers/docs/partner-requirements">Partner requirements</Link> · <Link href="/sub-processors">Sub-processors</Link></p>
      </footer>
    </div>
  );
}
