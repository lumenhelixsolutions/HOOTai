import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

function isStaleChunkError(message: string) {
  return /Failed to fetch dynamically imported module|Loading chunk [\d]+ failed|Importing a module script failed/i.test(
    message,
  );
}

export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[HOOT page error]", error, info.componentStack);
  }

  hardReload = () => {
    // Drop any stale SPA shell after npm run build rewrites hashed chunks
    const url = new URL(window.location.href);
    url.searchParams.set("_hoot_reload", String(Date.now()));
    window.location.replace(url.toString());
  };

  render() {
    if (this.state.error) {
      const msg = this.state.error.message || "Unknown error";
      const stale = isStaleChunkError(msg);

      return (
        <div
          style={{
            padding: 24,
            borderRadius: 12,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#fca5a5",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#fecaca" }}>
            {stale ? "UI assets out of date" : "This page crashed"}
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5, opacity: 0.9 }}>
            {stale
              ? "HOOT was rebuilt and this tab is still holding an old JavaScript chunk. Hard-reload to load the new UI (Ctrl+Shift+R), or use the button below."
              : msg}
          </p>
          {stale && (
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 11,
                lineHeight: 1.45,
                opacity: 0.55,
                wordBreak: "break-all",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {msg}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {stale ? (
              <button
                type="button"
                onClick={this.hardReload}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,176,66,0.35)",
                  background: "rgba(255,176,66,0.12)",
                  color: "#ffb042",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Hard reload UI
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "#ece8e1",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
