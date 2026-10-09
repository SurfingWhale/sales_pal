import { HEAT, LEVEL_WORD, Level } from "@/lib/score";

// Five dots for a lead's potential (canvas): filled up to its level, the rest rings.
export default function HeatDots({ level, size = 7, gap = 3, labelled = false }: { level: Level; size?: number; gap?: number; labelled?: boolean }) {
  return (
    <span role={labelled ? "img" : undefined} aria-label={labelled ? `Potensi ${LEVEL_WORD[level].toLowerCase()}` : undefined} aria-hidden={labelled ? undefined : true}
      style={{ display: "inline-flex", gap, flexShrink: 0 }}>
      {HEAT.map((c, i) => (
        <span key={c} style={{ width: size, height: size, borderRadius: "50%", background: i < level ? c : "transparent", boxShadow: i < level ? "none" : "inset 0 0 0 1.5px var(--dot-ring)" }} />
      ))}
    </span>
  );
}
