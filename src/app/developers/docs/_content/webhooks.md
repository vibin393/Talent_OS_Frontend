# Webhooks

Last updated: 2026-10-10

Create a subscription with an https URL; we verify it with a signed handshake before delivering events.

Every POST carries `TalentOS-Signature: t=<unix time>,v1=<hex HMAC-SHA256>`. Compute HMAC-SHA256 of `<t>.<raw body>` with your signing secret, compare in constant time and reject timestamps older than 5 minutes. During secret rotation two `v1` values are sent.

Samples in Python, Node, Java and C# are in the docs bundle (`signing.verifiers`) and below.

Failed deliveries are retried 8 times over about 24 hours (1 + 8 attempts). Use the delivery log to replay events.

Sandboxes have an Echo endpoint that records what it receives so you can inspect payloads.
