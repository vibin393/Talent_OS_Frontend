import type { NextConfig } from "next";

// Server-only origin of the FastAPI backend. The browser only ever calls relative `/api/...` URLs;
// Next proxies them so the session/CSRF cookies are first-party to the frontend origin.
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Strict Mode's dev-only double mount makes Fluent UI's Keyborg (focus tracking) log
  // "Keyborg instance … is being disposed incorrectly" on every page. Production is unaffected.
  reactStrictMode: false,
  // Epic 67 (spec A8): the consent page can never be framed (clickjacking).
  async headers() {
    return [
      {
        source: "/oauth/authorize",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      // Epic 66 (AD-77, spec 0.7): the Public API, the OAuth protocol endpoints (the /oauth/authorize consent page is a
      // Next.js page and wins: these rewrites run after the filesystem), OAuth / MCP discovery and the MCP endpoint.
      { source: "/public/v1/:path*", destination: `${BACKEND_URL}/api/public/v1/:path*` },
      { source: "/oauth/:path*", destination: `${BACKEND_URL}/api/oauth/:path*` },
      { source: "/.well-known/:path*", destination: `${BACKEND_URL}/.well-known/:path*` },
      { source: "/mcp", destination: `${BACKEND_URL}/api/mcp` },
    ];
  },
};

export default nextConfig;
