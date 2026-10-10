import Link from "next/link";

export default function DevelopersHome() {
  const cards = [
    ["/developers/docs/getting-started", "Get started", "Your first API call in 10 minutes."],
    ["/developers/reference", "API reference", "Every public endpoint, its scopes and schemas."],
    ["/developers/docs/webhooks", "Webhooks", "Subscriptions, signatures and retries."],
    ["/developers/mcp", "MCP for AI assistants", "Connect Claude and other MCP clients."],
    ["/developers/docs/partner-requirements", "Publish to the Marketplace", "Verified Partner status and review."],
  ];
  return (
    <>
      <h1>Build on Talent OS</h1>
      <ul className="dev-cards">
        {cards.map(([href, title, text]) => (
          <li key={href}>
            <h2><Link href={href}>{title}</Link></h2>
            <p>{text}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
