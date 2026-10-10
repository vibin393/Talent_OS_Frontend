"use client";

import {
  createDOMRenderer,
  renderToStyleElements,
  RendererProvider,
  SSRProvider,
} from "@fluentui/react-components";
import { useServerInsertedHTML } from "next/navigation";
import { useRef, useState } from "react";

/**
 * Fluent UI (Griffel) style registry for the App Router, per Fluent's Next.js guidance: styles
 * collected while server-rendering are emitted as `<style>` elements into the initial HTML via
 * `useServerInsertedHTML`, so the first paint is fully styled and the client renderer rehydrates them.
 */
export function FluentSsrRegistry({ children }: { children: React.ReactNode }) {
  const [renderer] = useState(() => createDOMRenderer());
  const didRender = useRef(false);

  useServerInsertedHTML(() => {
    // Emit once: Griffel renders every collected rule, and repeating them would duplicate CSS.
    if (didRender.current) return null;
    didRender.current = true;
    return <>{renderToStyleElements(renderer)}</>;
  });

  return (
    <RendererProvider renderer={renderer}>
      <SSRProvider>{children}</SSRProvider>
    </RendererProvider>
  );
}
