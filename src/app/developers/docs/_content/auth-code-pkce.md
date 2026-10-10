# Acting for a user: authorization code + PKCE

Last updated: 2026-10-10

Redirect the user to `/oauth/authorize` with `response_type=code`, `client_id`, an exact `redirect_uri`, `scope`, `state`, `code_challenge` (S256) and `resource=api` or `resource=mcp`.

The user sees the consent screen with every scope and its purpose. After approval you receive `code` and exchange it at `/api/oauth/token` with your `code_verifier`.

Refresh tokens rotate on every use; reusing an old refresh token revokes the whole family.
