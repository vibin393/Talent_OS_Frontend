"use client";

import { Body1, Button, Card, CardHeader, Subtitle2, tokens } from "@fluentui/react-components";

/** A plain card that explains a console area whose data is not yet exposed by an endpoint (gap note). */
export function GapCard({ title, children, link }: { title: string; children: React.ReactNode; link?: { href: string; label: string } }) {
  return (
    <Card>
      <CardHeader header={<Subtitle2>{title}</Subtitle2>} />
      <div style={{ padding: tokens.spacingHorizontalM, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS }}>
        <Body1>{children}</Body1>
        {link ? (
          <div>
            <Button as="a" href={link.href}>
              {link.label}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
