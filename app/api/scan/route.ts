import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROMPT = `Kamu mengekstrak data lead penjualan dari sebuah gambar (screenshot chat, tabel, daftar kontak, atau kartu nama).
Kembalikan HANYA JSON valid, tanpa teks lain, dengan bentuk persis:
{"leads":[{"name":"","contact":"","email":"","phone":"","category":"","source":"","status":"","value":0,"notes":""}]}
Aturan:
- "name" = nama perusahaan/bisnis. Jika hanya ada nama orang, kosongkan "name" dan taruh di "contact".
- "value" = angka rupiah sebagai integer tanpa titik/koma/simbol (mis. 15000000). 0 jika tidak ada.
- "status" salah satu: Cold, Warm, Hot, Closed. Default "Cold" bila tidak jelas.
- Kosongkan field yang tidak ada dengan "" (atau 0 untuk value). JANGAN mengarang data.
- Jika tidak ada lead sama sekali, kembalikan {"leads":[]}.`;

interface ScanLead {
  name?: string; contact?: string; email?: string; phone?: string;
  category?: string; source?: string; status?: string; value?: number | string; notes?: string;
}

function extractLeads(content: string): ScanLead[] {
  if (!content) return [];
  // strip markdown code fences if present
  let text = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  // fallback: grab the first {...} block
  if (!text.startsWith("{")) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) text = m[0];
  }
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.leads) ? parsed.leads : [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  const key = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Scan belum dikonfigurasi — env XAI_API_KEY belum diset di server." },
      { status: 503 },
    );
  }

  let image: string | undefined;
  try {
    const body = await req.json();
    image = body?.image;
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }
  if (!image || typeof image !== "string") {
    return NextResponse.json({ error: "Gambar tidak ditemukan." }, { status: 400 });
  }

  const model = process.env.XAI_VISION_MODEL || "grok-2-vision-1212";

  try {
    const resp = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: "You extract structured sales lead data from images and return only valid JSON." },
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: image, detail: "high" } },
            ],
          },
        ],
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || data?.error || `Grok API error (${resp.status})`;
      return NextResponse.json({ error: String(msg) }, { status: 502 });
    }

    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const rows = extractLeads(content);
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ error: "Gagal menghubungi layanan scan." }, { status: 500 });
  }
}
