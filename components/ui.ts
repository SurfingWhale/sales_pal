import type { CSSProperties } from "react";

// The inline styles the tabs share. SalesTracker still keeps its own copies of
// inputStyle and btnPrimary; these match them.

export const font = "'Plus Jakarta Sans', sans-serif";

export const inputStyle: CSSProperties = {
  background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 8,
  color: "var(--app-text)", padding: "10px 14px", fontSize: 13, width: "100%",
  outline: "none", fontFamily: font,
};

export const btnPrimary: CSSProperties = {
  background: "#005eb0", color: "#fff",
  border: "none", borderRadius: 8, padding: "11px 20px",
  fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: font,
};

export const btnGhost: CSSProperties = {
  ...btnPrimary, background: "transparent", color: "#005eb0", border: "1px solid #005eb0",
};

export const btnMuted: CSSProperties = {
  ...btnPrimary, background: "var(--app-border)", color: "var(--app-text)",
};

export const btnWA: CSSProperties = {
  ...btnPrimary, background: "#25D366",
};

export const chip: CSSProperties = {
  border: "1px solid var(--app-border)", background: "transparent", color: "var(--app-muted)",
  borderRadius: 6, padding: "6px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
};

export const card: CSSProperties = {
  background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 12,
};

export const label: CSSProperties = {
  fontSize: 11, color: "var(--app-muted)", display: "block", marginBottom: 6,
};

export const modalBox: CSSProperties = {
  background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16,
  padding: 24, width: "100%", maxHeight: "88vh", overflowY: "auto",
};

export const heading: CSSProperties = { fontSize: 20, fontWeight: 700, fontFamily: font };
export const subheading: CSSProperties = { color: "var(--app-muted)", fontSize: 12, marginTop: 2 };

export function badge(color: string): CSSProperties {
  return {
    display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: `${color}1a`, color, border: `1px solid ${color}40`, whiteSpace: "nowrap",
  };
}
