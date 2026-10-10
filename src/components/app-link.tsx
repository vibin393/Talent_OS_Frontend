"use client";

import { Link } from "@fluentui/react-components";
import { useRouter } from "next/navigation";

/**
 * Fluent `Link` rendered as a real `<a href>` that uses Next.js client-side navigation for plain
 * clicks (modified clicks keep the browser default, e.g. open in a new tab).
 */
export function AppLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        router.push(href);
      }}
    >
      {children}
    </Link>
  );
}
