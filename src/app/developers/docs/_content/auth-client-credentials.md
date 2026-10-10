# Server-to-server: client credentials

Last updated: 2026-10-10

Send `grant_type=client_credentials`, your `client_id`, `client_secret` and `tenant=<tenant slug>` to `POST /api/oauth/token`.

```
curl -u $CLIENT_ID:$CLIENT_SECRET -d grant_type=client_credentials -d tenant=acme https://<host>/api/oauth/token
```

Client-credentials tokens never carry sensitive scopes; those need the authorization code flow and a user's consent.

Rotate secrets from the app's Credentials tab: the previous secret keeps working for 24 hours.
