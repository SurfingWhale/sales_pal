"use client";

import { useState } from "react";
import { deleteDoc } from "firebase/firestore";
import Icon from "@/components/Icon";
import ConfirmSheet from "@/components/ConfirmSheet";
import { marginColor } from "@/components/ComponentCatalog";
import { QuoteTemplate, marginOf, rupiah, subtotal } from "@/lib/billing";
import { Space, spaceDoc } from "@/lib/space";
import { card, chip, font } from "@/components/ui";

// The quotes kept to start the next one from (PRD-017 §4). They are made from
// a quote (Penawaran → Simpan sebagai template) and used from + Penawaran;
// here they are listed and removed.
export default function QuoteTemplateList({ templates, space, canEdit }: { templates: QuoteTemplate[]; space: Space; canEdit: boolean }) {
  const [deleting, setDeleting] = useState<QuoteTemplate | null>(null);
  if (!templates.length) return null;
  return (
    <section aria-labelledby="qt-h" style={{ marginTop: 32 }}>
      <h2 id="qt-h" style={{ margin: 0, fontSize: 17, fontWeight: 700, fontFamily: font }}>Template penawaran</h2>
      <p style={{ margin: "2px 0 12px", fontSize: 12, color: "var(--app-muted)", lineHeight: 1.5 }}>Dibuat dari penawaran (Simpan sebagai template), dipakai di + Penawaran → Mulai dari template.</p>
      <ul aria-label="Daftar template penawaran" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 10 }}>
        {templates.slice().sort((a, b) => a.name.localeCompare(b.name)).map(t => {
          const m = marginOf({ items: t.items, discount: 0 });
          return (
            <li key={t.id} style={{ ...card, padding: 14, display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                <div className="tabnum" style={{ fontSize: 12, color: "var(--app-muted)" }}>
                  {t.items.length} item · {rupiah(subtotal(t.items))}
                  {m && m.percent !== null && <> · <b style={{ color: marginColor(m.percent) }}>margin {m.percent}%</b></>}
                </div>
              </div>
              {canEdit && (
                <button onClick={() => setDeleting(t)} aria-label={`Hapus template ${t.name}`} style={{ ...chip, minWidth: 44, borderColor: "#ff444440", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="trash" size={16} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {deleting && (
        <ConfirmSheet title="Hapus template?" onConfirm={() => deleteDoc(spaceDoc(space, "quoteTemplates", deleting.id))} onClose={() => setDeleting(null)}>
          Template <b>{deleting.name}</b> hilang. Penawaran yang udah dibuat dari template ini ga ikut berubah.
        </ConfirmSheet>
      )}
    </section>
  );
}
