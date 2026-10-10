"use client";

import { Body1, Card, CardHeader, Subtitle2 } from "@fluentui/react-components";

/** Empty-state card for a tab whose feature ships in a later epic. */
export function ComingInEpic({ icon, title, description }: { icon: React.ReactElement; title: string; description: string }) {
  return (
    <Card style={{ maxWidth: 560 }}>
      <CardHeader image={icon} header={<Subtitle2 as="h2">{title}</Subtitle2>} description={<Body1>{description}</Body1>} />
    </Card>
  );
}
