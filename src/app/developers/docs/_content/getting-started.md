# Your first API call in 10 minutes

Last updated: 2026-10-10

Create a developer account at `/developers/sign-up`, verify your email and turn on two-step verification.

Create your organisation, then open **Workspace -> Sandboxes** and create a small sandbox. Sandboxes contain only fictitious data.

Create an app (confidential, client credentials, scope `candidates:read`), copy the client secret (shown once) and install the app in your sandbox.

In the playground, paste the secret under **Get a token -> Server-to-server**, then call the API:

```
curl -H "Authorization: Bearer $TOKEN" https://<host>/public/v1/candidates
```

Sandbox responses carry `X-TalentOS-Sandbox: true`.
