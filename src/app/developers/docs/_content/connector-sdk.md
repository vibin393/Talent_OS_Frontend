# Connector SDK and Conformance Kit

Last updated: 2026-10-10

Describe your connector with the manifest schema (see `/developers/sdk` data in the bundle) and implement the published ports.

Before submitting, run a conformance run against a sandbox: we observe your app for up to 30 minutes, inject one temporary error and one rate limit, probe your webhook signature check and uninstall your app at the end.

A passed run produces a signed `talentos.conformance/1` report that you attach to your submission (valid 30 days).
