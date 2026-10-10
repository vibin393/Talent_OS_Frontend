"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { accessDeniedFrom, type AskWhom } from "./access";
import { AccessDenied } from "./access-denied";

type Props = { children: ReactNode; ask?: AskWhom };
type State = { error: unknown };

/**
 * Error boundary for data views: a thrown 403 (e.g. a query with `throwOnError`) renders the FR-82
 * Access Denied state; anything else is re-thrown to the next boundary. Used by the `(app)`, `portal`,
 * `client` and `vendor` layouts.
 */
export class QueryBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (!accessDeniedFrom(error)) console.error(error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      const denied = accessDeniedFrom(error, this.props.ask);
      if (!denied) throw error;
      return <AccessDenied action={denied.action} ask={denied.ask} onBack={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
