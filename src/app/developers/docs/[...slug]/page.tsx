import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/features/developers/markdown";

const DIR = path.join(process.cwd(), "src", "app", "developers", "docs", "_content");

function guides(): string[] {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

export function generateStaticParams() {
  return guides().map((g) => ({ slug: [g] }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.join(" ").replace(/-/g, " ") };
}

/** Hand-written guides (Markdown, reviewed like code), statically generated (no API calls). */
export default async function GuidePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const name = slug.join("/");
  if (!guides().includes(name)) notFound();
  const source = fs.readFileSync(path.join(DIR, `${name}.md`), "utf-8");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
      <nav aria-label="Guides" style={{ minWidth: 200 }}>
        <ul>
          {guides().map((g) => (
            <li key={g}>
              <Link href={`/developers/docs/${g}`}>{g.replace(/-/g, " ")}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <article style={{ flex: 1, minWidth: 0 }}>
        <Markdown source={source} />
      </article>
    </div>
  );
}
