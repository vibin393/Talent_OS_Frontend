import type { Metadata } from "next";
import Link from "next/link";
import { CookieBanner } from "@/features/network/cookie-banner";
import "./jobs.css";

export const metadata: Metadata = {
  title: { absolute: "Talent OS Jobs", template: "%s – Talent OS Jobs" },
  description: "Jobs from verified recruitment agencies. You apply directly to the agency.",
};

/** Platform-branded, server-rendered Job Network site shell (Epic 75, B1). */
export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="jobs-root">
      <header className="jobs-header">
        <h1>
          <Link href="/jobs" style={{ color: "inherit", textDecoration: "none" }}>
            Talent OS Jobs
          </Link>
        </h1>
        <p>Jobs from verified recruitment agencies. You apply directly to the agency.</p>
      </header>
      <main className="jobs-main">{children}</main>
      <footer className="jobs-footer">
        <Link href="/l/privacy">Privacy</Link>
      </footer>
      <CookieBanner />
    </div>
  );
}
