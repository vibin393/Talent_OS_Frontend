"use client";

import { useEffect, useState } from "react";

/**
 * OAuth redirect target for the playground "Acting for a user" flow. Opened in a new tab; it posts the authorization
 * code back to the playground tab (which holds the PKCE verifier in memory) and closes. No token or secret here.
 */
export default function PlaygroundCallback() {
  const [message, setMessage] = useState("Completing sign-in…");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const err = params.get("error");
    if (err) {
      setMessage(`Sign-in was not completed: ${err}`);
      return;
    }
    if (code && window.opener) {
      window.opener.postMessage({ source: "tos-playground-callback", code, state }, window.location.origin);
      setMessage("Done. You can close this tab.");
      window.setTimeout(() => window.close(), 500);
    } else {
      setMessage("No authorization code was returned.");
    }
  }, []);
  return (
    <main id="dev-main" style={{ padding: 24 }}>
      <p>{message}</p>
    </main>
  );
}
