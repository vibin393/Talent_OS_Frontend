# MCP for AI assistants

Last updated: 2026-10-10

Talent OS exposes a governed MCP server at `/mcp` (Streamable HTTP).

Clients connect with OAuth authorization code + PKCE and `resource=mcp`; the tenant must enable MCP and the user needs the `mcp:use` permission.

Tools are grouped and capped; write actions become Proposals that a person approves in Talent OS. Human-only actions are never available.

In a sandbox you can try MCP from the playground (Initialize, List tools, Call tool).
