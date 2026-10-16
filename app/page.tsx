"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import "./landing.css";

// The landing page (TasteSkill v2, "The page is the object"): a studio's
// quote slip — what SalesPal hands a client on WhatsApp — is the page. The
// hero slip can be filled in: pick a package, type a name, send it.

const PACKAGES = [
  { id: "foto", name: "Foto produk", price: 1_500_000 },
  { id: "fv", name: "Foto + video reels", price: 3_500_000 },
  { id: "event", name: "Liputan event sehari", price: 6_000_000 },
];
const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

// The app, drawn as itself (data-ui): what each moment of the day looks like.
function HuntingUI() {
  return (
    <div data-ui="" aria-label="Contoh layar Hunting">
      <div className="row"><b>@tokokue</b><span className="badge warm">Baru</span></div>
      <div className="muted">“ada yang open jasa foto katalog buat UMKM? budget ramah ya”</div>
      <div className="stage"><span className="chip on">1. Intro</span><span className="chip">2. Follow-up</span><span className="chip">3. Gali</span></div>
      <div className="msg">Halo Toko Kue! Aku liat kamu lagi nyari foto katalog. Aku biasa pegang yang kayak gini. Boleh aku kirim contoh hasil + kisaran harganya?</div>
      <div className="btns"><span className="b">Copy</span><span className="b blue">Copy &amp; DM</span></div>
    </div>
  );
}
function QuoteUI() {
  return (
    <div data-ui="" aria-label="Contoh penawaran">
      <div className="row"><b>Penawaran Q-0142</b><span className="badge">Disetujui</span></div>
      <div className="muted">Toko Kue · Foto katalog 20 produk</div>
      <div className="sep" />
      <div className="row"><span>Foto produk (20 item)</span><span className="tnum">Rp 1.500.000</span></div>
      <div className="row"><span>Edit &amp; retouch</span><span className="tnum">Rp 500.000</span></div>
      <div className="sep" />
      <div className="row"><b>Total</b><b className="tnum">Rp 2.000.000</b></div>
      <div className="row" style={{ marginTop: 12 }}><span className="b wa" style={{ width: "100%" }}>Jadiin invoice → kirim WA</span></div>
    </div>
  );
}
function InvoiceUI() {
  return (
    <div data-ui="" aria-label="Contoh invoice lunas">
      <div className="row"><b>INV-0142</b><span className="badge">Lunas</span></div>
      <div className="muted">Toko Kue · dibayar 2 kali</div>
      <div className="sep" />
      <div className="row"><span>DP 50%</span><span className="tnum">Rp 1.000.000</span></div>
      <div className="row"><span>Pelunasan</span><span className="tnum">Rp 1.000.000</span></div>
      <div className="sep" />
      <div className="row"><b>Masuk bulan ini</b><b className="tnum">Rp 2.000.000</b></div>
      <div className="muted" style={{ marginTop: 10 }}>Otomatis masuk Report Klien bulan Oktober.</div>
    </div>
  );
}
function JourneyUI() {
  const rows: [string, string, string][] = [["@tokokue", "Tertarik", ""], ["@rotikeju", "Intro terkirim", "warm"], ["@kopiflow", "Dibales", ""]];
  return (
    <div data-ui="" aria-label="Contoh journey prospek">
      <div className="row"><b>Journey prospek</b><span className="muted">3 aktif</span></div>
      <div className="sep" />
      {rows.map(([h, s, c]) => <div key={h} className="row" style={{ padding: "6px 0" }}><span>{h}</span><span className={`badge ${c}`}>{s}</span></div>)}
    </div>
  );
}
function GuildUI() {
  const ppl: [string, string, string][] = [["Raka", "Leader", "leader"], ["Sinta", "Officer", "officer"], ["Bima", "Member", "member"]];
  return (
    <div data-ui="" aria-label="Contoh guild">
      <div className="row"><b>Tim Contoh</b><span className="muted">Level 3</span></div>
      {ppl.map(([n, r, k]) => (
        // eslint-disable-next-line @next/next/no-img-element
        <div key={n} className="person"><img src={`/guild/char-${k}.png`} alt="" /><span style={{ flex: 1 }}>{n}</span><span className="chip">{r}</span></div>
      ))}
    </div>
  );
}

const SCENES = [
  { ui: <HuntingUI />, cap: "Pagi: orang nyari jasa di Threads, DM-nya udah siap." },
  { ui: <QuoteUI />, cap: "Siang: dia setuju, penawaran jadi dalam semenit." },
  { ui: <InvoiceUI />, cap: "Malam: invoice lunas, angkanya masuk report." },
];

export default function LandingPage() {
  const [client, setClient] = useState("Toko Kue Contoh");
  const [pkg, setPkg] = useState("fv");
  const [scene, setScene] = useState(0);
  const [tab, setTab] = useState(0);
  const p = PACKAGES.find(x => x.id === pkg)!;
  const dp = Math.round(p.price / 2);
  const wa = useMemo(() => `https://wa.me/?text=${encodeURIComponent(
    `Halo ${client.trim() || "kak"}, ini penawarannya:\n${p.name} — ${rp(p.price)}\nDP 50%: ${rp(dp)}\n\nKalau cocok, aku kirim invoice-nya ya.`)}`, [client, p, dp]);

  // The slow crossfade: the app beside the slip changes like light in a room.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let t: ReturnType<typeof setInterval> | undefined;
    const run = () => { clearInterval(t); if (!document.hidden) t = setInterval(() => setScene(s => (s + 1) % SCENES.length), 5600); };
    run();
    document.addEventListener("visibilitychange", run);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", run); };
  }, []);

  // Entrances: content is visible without script; with it, parts rise once.
  useEffect(() => {
    const root = document.querySelector(".lp");
    root?.classList.add("lp-js");
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -10% 0px" });
    root?.querySelectorAll("[data-rise]").forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  const tabs = [
    { name: "Hunting", title: "Orangnya nyari, kamu nyapa.", body: "Tempel link post Threads. SalesPal baca kebutuhan, tanggal dan lokasinya, lalu nyiapin DM per tahap: intro, follow-up, gali kebutuhan, penawaran.", ui: <HuntingUI /> },
    { name: "Journey", title: "Tiap orang ada jejaknya.", body: "Baru, intro, dibales, tertarik, kasih data. Siapa yang perlu disapa lagi hari ini kelihatan tanpa buka chat satu-satu.", ui: <JourneyUI /> },
    { name: "Guild", title: "Satu tim, satu angka.", body: "Undang anggota pakai link. Leader lihat semua deal dan target bulanan; tiap sales lihat punyanya sendiri.", ui: <GuildUI /> },
  ];
  const t = tabs[tab];

  return (
    <div className="lp">
      <header className="lp-nav">
        <Link href="/" className="wm">SALESPAL</Link>
        <nav aria-label="Utama">
          <a href="#alur" className="hide-s">Alurnya</a>
          <a href="#isi" className="hide-s">Isinya</a>
          <Link href="/login" className="lp-btn">Masuk</Link>
        </nav>
      </header>

      <main>
        {/* Hero: the quote slip, and the app that wrote it */}
        <section className="lp-hero" aria-labelledby="lp-h1">
          <div className="lp-card">
            <div className="lp-stripe" aria-hidden="true">{Array.from({ length: 40 }, (_, i) => <span key={i} />)}</div>
            <div className="lp-card-body">
              <h1 id="lp-h1" data-rise="">Dari DM sampai lunas.</h1>
              <p className="lp-lead" data-rise="" style={{ ["--i" as string]: 1 }}>
                SalesPal buat studio foto &amp; video: nyatet orang yang lagi nyari jasa kamu, nyiapin DM-nya, lalu ngubah closingan jadi penawaran dan invoice PDF yang langsung kekirim ke WhatsApp.
              </p>

              <form className="lp-quote" onSubmit={e => e.preventDefault()} aria-label="Coba bikin penawaran" data-rise="" style={{ ["--i" as string]: 2 }}>
                <div>
                  <label htmlFor="lp-client">Untuk</label>
                  <input id="lp-client" value={client} onChange={e => setClient(e.target.value)} autoComplete="off" />
                </div>
                <div role="radiogroup" aria-label="Paket" className="lp-pkgs">
                  {PACKAGES.map(x => (
                    <button key={x.id} type="button" role="radio" aria-checked={pkg === x.id} className="lp-pkg" onClick={() => setPkg(x.id)}>
                      <span>{x.name}</span><span className="tnum">{rp(x.price)}</span>
                    </button>
                  ))}
                </div>
                <div className="lp-lines tnum" aria-live="polite">
                  <div><span>DP 50% buat {client.trim() || "klien"}</span><span>{rp(dp)}</span></div>
                  <div className="total"><span>Total</span><span>{rp(p.price)}</span></div>
                </div>
              </form>

              <div className="lp-actions">
                <Link href="/login" className="lp-btn">Mulai gratis</Link>
                <a href={wa} target="_blank" rel="noreferrer" className="lp-link">Kirim contoh ini ke WhatsApp</a>
              </div>
              <div className="lp-card-foot"><a href="#alur" className="lp-link">Lihat alurnya</a><a href="#isi" className="lp-link">Isinya apa aja</a><Link href="/login" className="lp-link">Udah punya akun</Link></div>
            </div>
          </div>
          <figure className="lp-room" aria-label="Layar SalesPal, berganti sepanjang hari">
            {SCENES.map((s, i) => (
              <div key={i} className={`scene${i === scene ? " on" : ""}`} aria-hidden={i !== scene}>
                {s.ui}
                <figcaption>{s.cap}</figcaption>
              </div>
            ))}
          </figure>
        </section>

        {/* 1. Showcase: one plate, three tabs */}
        <section className="lp-show" aria-labelledby="lp-show-h">
          <div className="lp-plate" data-rise="">
            <div className="scene"><div className="drift">{t.ui}</div></div>
          </div>
          <div className="lp-show-text">
            <div role="tablist" aria-label="Bagian app" className="lp-tabs">
              {tabs.map((x, i) => <button key={x.name} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>{x.name}</button>)}
            </div>
            <div role="tabpanel" aria-label={t.name}>
              <h2 id="lp-show-h" data-rise="">{t.title}</h2>
              <p data-rise="" style={{ ["--i" as string]: 1 }}>{t.body}</p>
            </div>
            <div className="lp-cells">
              <Link href="/login">Coba gratis</Link>
              <a href="#alur">Lihat satu hari</a>
            </div>
          </div>
        </section>

        {/* 2. How it works: one working day, printed as a slip */}
        <section id="alur" className="lp-day" aria-labelledby="lp-day-h">
          <div className="lp-day-text">
            <h2 id="lp-day-h" data-rise="">Satu hari jualan.</h2>
            <p data-rise="" style={{ ["--i" as string]: 1 }}>Begini satu hari di SalesPal, dari notifikasi pagi sampai uang masuk dan kecatat di report.</p>
          </div>
          <div className="lp-slip tnum" data-rise="" style={{ ["--i" as string]: 2 }}>
            <h3>Pagi</h3>
            <div className="r"><span>Ringkasan “Perlu ditindak”</span><span>08.00</span></div>
            <div className="r"><span>Follow-up beruntun, satu lead satu layar</span><span>15 mnt</span></div>
            <h3>Siang</h3>
            <div className="r"><span>Tempel link post Threads</span><span>1 tap</span></div>
            <div className="r"><span>DM sesuai tahap, langsung ke Instagram</span><span>30 dtk</span></div>
            <h3>Sore</h3>
            <div className="r"><span>Dia bales, kasih nomor, jadi lead</span><span>2 tap</span></div>
            <div className="r"><span>Cek tanggal acaranya di kalender</span><span>1 tap</span></div>
            <h3>Malam</h3>
            <div className="r"><span>Penawaran → invoice PDF</span><span>1 mnt</span></div>
            <div className="r"><span>Catat DP, kirim lewat WhatsApp</span><span>1 tap</span></div>
            <div className="end"><span>Invoice lunas, report bulanan jadi sendiri</span><span>1 hari</span></div>
          </div>
        </section>

        {/* 3. What's inside: stacking sheets */}
        <section id="isi" className="lp-feat" aria-labelledby="lp-feat-h">
          <h2 id="lp-feat-h" data-rise="">Yang ada di dalamnya.</h2>
          <article className="lp-sheet s1">
            <h3>Hunting &amp; journey prospek</h3>
            <div className="pic" data-rise=""><JourneyUI /></div>
            <p className="txt" data-rise="" style={{ ["--i" as string]: 1 }}>Prospek dari post Threads, DM dan WhatsApp masuk satu daftar dengan ID-nya sendiri. Template ngisi kebutuhan, tanggal dan lokasi dari post; yang kosong pakai default kamu.</p>
          </article>
          <article className="lp-sheet s2">
            <h3>Penawaran jadi invoice</h3>
            <div className="pic" data-rise=""><InvoiceUI /></div>
            <p className="txt" data-rise="" style={{ ["--i" as string]: 1 }}>Satu form urut kayak PDF-nya: acara, item, deliverables, harga. Kop dan logo studio ikut tercetak, file PDF-nya kebagi langsung dari HP.</p>
          </article>
          <article className="lp-sheet s3">
            <h3>Kenali tipe customer</h3>
            <div className="pic" data-rise="">
              <div className="lp-pics">
                {([["owl", "Burung Hantu"], ["lion", "Singa"], ["dolphin", "Lumba-lumba"], ["rabbit", "Kelinci"]] as const).map(([id, n]) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <figure key={id}><img src={`/archetypes/animal-${id}.png`} alt={`Karakter ${n}`} width={256} height={256} loading="lazy" /><figcaption>{n}</figcaption></figure>
                ))}
              </div>
            </div>
            <p className="txt" data-rise="" style={{ ["--i" as string]: 1 }}>Analitis, dominan, ramah, atau ragu-ragu. SalesPal nebak dari cara orangnya nulis, lalu nyaranin balasan yang pas buat keberatannya.</p>
          </article>
          <article className="lp-sheet s4">
            <h3>Guild buat tim sales</h3>
            <div className="pic" data-rise="">
              <div className="lp-pics">
                {([["leader", "Leader"], ["officer", "Officer"], ["member", "Member"], ["viewer", "Viewer"]] as const).map(([id, n]) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <figure key={id}><img src={`/guild/char-${id}.png`} alt={`Karakter ${n}`} width={256} height={256} loading="lazy" /><figcaption>{n}</figcaption></figure>
                ))}
              </div>
            </div>
            <p className="txt" data-rise="" style={{ ["--i" as string]: 1 }}>Empat peran dengan hak yang jelas. Pipeline bareng, target per orang, report tim yang bisa dibekukan dan dikirim ke klien.</p>
          </article>
        </section>

        {/* 4. About: a letter on the same paper */}
        <section className="lp-letter-wrap" aria-label="Kenapa SalesPal dibikin">
          <div className="lp-letter" data-rise="">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" width={48} height={48} />
            <p>Kami jalanin studio foto dan video sendiri. Klien datang dari mana-mana: post Threads, DM Instagram, chat WhatsApp jam sebelas malam.</p>
            <p>Dulu semuanya di kepala dan di galeri screenshot. Siapa yang udah ditawarin, siapa yang belum bayar DP, acara tanggal berapa bentrok sama apa.</p>
            <p>SalesPal kami bikin buat <mark>kerjaan yang terjadi di HP</mark>: nyapa orang yang lagi nyari, ngingetin follow-up, dan ngirim penawaran yang rapi tanpa buka laptop.</p>
            <p>Gratis buat dipakai sendiri. Kalau tim kamu nambah, bikin guild.</p>
            <div className="lp-sign">Tim SalesPal</div>
            <span>dibikin orang studio, buat orang studio</span>
          </div>
          <div className="lp-tear">
            <span style={{ fontWeight: 700 }}>Masuk pakai Google atau email</span>
            <Link href="/login" className="lp-btn">Masuk</Link>
          </div>
        </section>

        {/* 5. One word is the button */}
        <Link href="/login" className="lp-cta" aria-label="Mulai pakai SalesPal, gratis">
          <span className="say">Bikin akun, tempel satu link post, kirim DM pertama kamu.</span>
          <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="4"><path d="M12 36 36 12M16 12h20v20" /></svg>
          <span className="word" aria-hidden="true">Mulai</span>
        </Link>
      </main>

      <footer className="lp-foot">
        <div className="stripe" aria-hidden="true">{Array.from({ length: 80 }, (_, i) => <span key={i} />)}</div>
        <div className="inv">
          <p>Jualan studio, rapi dari HP.</p>
          <Link href="/login" className="lp-btn">Masuk / Daftar</Link>
        </div>
        <ul>
          <li><Link href="/login">Masuk</Link></li>
          <li><a href="#alur">Alurnya</a></li>
          <li><a href="#isi">Isinya</a></li>
        </ul>
        <div className="legal"><span>© 2026 SalesPal</span><span>Karakter ilustrasi: koleksi SalesPal</span></div>
        <div className="name" aria-hidden="true">SALESPAL</div>
      </footer>
    </div>
  );
}
