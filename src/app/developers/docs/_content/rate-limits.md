# Rate limits

Last updated: 2026-10-10

Limits depend on the tenant's rate tier (sandbox: 60 requests per minute). Responses carry `RateLimit-*` headers.

On `429`, wait for `Retry-After` before retrying. On `503`, retry `POST` requests with the same `Idempotency-Key`.
