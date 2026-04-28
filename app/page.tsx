"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";

const stripItems = [
  "🗺️ GMaps Scraping → Outscraper",
  "📩 Cold Email → Instantly.ai",
  "⚡ AI Scoring → Real-time",
  "📊 Pipeline → Live",
  "🤖 Personalization → Claude + GPT",
  "🎯 7-Touch Formula → Proven",
  "💡 Rejection Data → Win More",
];

const features = [
  { icon: "🗺️", cls: "b", title: "GMaps Lead Mining", desc: "Scrape ribuan potential client berdasarkan kategori, kota, dan rating. Filter bisnis aktif dengan sinyal intent tertinggi." },
  { icon: "⚡", cls: "g", title: "AI Lead Scoring", desc: "Setiap lead di-score berdasarkan 5 parameter otomatis: website, rating, sosmed, kategori, dan budget signals." },
  { icon: "📩", cls: "a", title: "Multi-Channel Outreach", desc: "Track email, DM IG, WhatsApp, LinkedIn dalam satu dashboard. Open rate & reply rate real-time." },
  { icon: "❌", cls: "b", title: "Rejection Intelligence", desc: "Setiap rejection dicatat + lesson learned + follow-up date otomatis. Pattern rejection jadi insight closing." },
  { icon: "📊", cls: "g", title: "Sales Pipeline Visual", desc: "Cold → Warm → Hot → Closed. Total pipeline value, conversion rate, dan metrik penting real-time." },
  { icon: "🤖", cls: "a", title: "AI Playbook Built-in", desc: "Panduan step-by-step scraping, 7-touch sequence, stack tools AI terbaik, dan benchmark metrics dalam app." },
];

const showcaseItems = [
  { img: "/phone1.jpg", name: "Sales Command Center", sub: "Overview semua metrik penting" },
  { img: "/phone2.jpg", name: "Lead Database", sub: "Filter, score & manage leads" },
  { img: "/phone3.jpg", name: "Outreach Tracker", sub: "Email, DM, WA dalam satu tempat" },
  { img: "/phone4.jpg", name: "Rejection Log", sub: "Ubah rejection jadi data menang" },
];

export default function LandingPage() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true);
    startX.current = e.pageX - (trackRef.current?.offsetLeft ?? 0);
    scrollLeft.current = trackRef.current?.scrollLeft ?? 0;
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - (trackRef.current.offsetLeft ?? 0);
    trackRef.current.scrollLeft = scrollLeft.current - (x - startX.current) * 1.5;
  }

  function handleScroll() {
    if (!trackRef.current) return;
    const idx = Math.round(trackRef.current.scrollLeft / (trackRef.current.scrollWidth / showcaseItems.length));
    setActiveIdx(idx);
  }

  function scrollToItem(i: number) {
    const el = trackRef.current?.querySelectorAll(".sc-item")[i];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  return (
    <>
      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(4,4,10,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid #14151c", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="logo-text" style={{ fontSize: 22, marginBottom: 0 }}>SALES<em>PAL</em></div>
        <Link href="/login" className="btn-primary" style={{ padding: "10px 24px", fontSize: 13 }}>
          🚀 Masuk / Daftar
        </Link>
      </nav>

      {/* HERO */}
      <section className="hero" style={{ paddingTop: 120 }}>
        <div className="hero-content">
          <div className="badge-pill">
            <span className="dot" />
            Built with AI &middot; Sales Intelligence Platform
          </div>

          <div className="logo-lockup">
            <Image src="/logo.png" alt="SalesPal" width={56} height={56} className="logo-img" />
            <div className="logo-text">SALES<em>PAL</em></div>
          </div>

          <h1 className="hero-headline">
            <span className="line1">Track Every</span>
            <span className="line1">Lead.</span>
            <span className="line2">Close More</span>
            <span className="line2">Deals.</span>
            <span className="line3">Dominate</span>
            <span className="line3">Your Market.</span>
          </h1>

          <p className="hero-sub">
            AI-powered CRM + outreach tracker buat sales yang mau scale di era otomasi. Dari GMaps scraping sampai rejection analytics — semua ada.
          </p>

          <div className="hero-cta">
            <Link href="/login" className="btn-primary">🚀 Mulai Gratis</Link>
            <Link href="/dashboard" className="btn-ghost">Lihat Demo →</Link>
          </div>

          {/* Floating Phones */}
          <div className="phones-wrap">
            <div className="phone-mock p1">
              <div className="phone-notch" /><div className="phone-cam" />
              <div className="phone-vol" /><div className="phone-vol2" /><div className="phone-pwr" />
              <div className="phone-inner">
                <Image src="/phone1.jpg" alt="Dashboard" fill style={{ objectFit: "cover", objectPosition: "top" }} />
              </div>
              <div className="phone-label">📊 Dashboard</div>
            </div>
            <div className="phone-mock p2">
              <div className="phone-notch" /><div className="phone-cam" />
              <div className="phone-vol" /><div className="phone-vol2" /><div className="phone-pwr" />
              <div className="phone-inner">
                <Image src="/phone2.jpg" alt="Lead DB" fill style={{ objectFit: "cover", objectPosition: "top" }} />
              </div>
              <div className="phone-label">👥 Lead DB</div>
            </div>
            <div className="phone-mock p3">
              <div className="phone-notch" /><div className="phone-cam" />
              <div className="phone-vol" /><div className="phone-vol2" /><div className="phone-pwr" />
              <div className="phone-inner">
                <Image src="/phone3.jpg" alt="Outreach" fill style={{ objectFit: "cover", objectPosition: "top" }} />
              </div>
              <div className="phone-label">📩 Outreach</div>
            </div>
            <div className="phone-mock p4">
              <div className="phone-notch" /><div className="phone-cam" />
              <div className="phone-vol" /><div className="phone-vol2" /><div className="phone-pwr" />
              <div className="phone-inner">
                <Image src="/phone4.jpg" alt="Rejection Log" fill style={{ objectFit: "cover", objectPosition: "top" }} />
              </div>
              <div className="phone-label">❌ Rejection Log</div>
            </div>
            <div className="phones-floor" />
          </div>
        </div>
      </section>

      {/* MARQUEE STRIP */}
      <div className="strip">
        <div className="strip-track">
          {[...stripItems, ...stripItems].map((item, i) => (
            <div key={i} className="strip-item" dangerouslySetInnerHTML={{ __html: item.replace(" → ", " → <b>").replace(/(<b>.*)$/, "$1</b>") }} />
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div className="sec">
        <div className="sec-tag">Core Features</div>
        <h2 className="sec-title">Semua yang lo butuhin buat menang di sales.</h2>
        <div className="feat-grid">
          {features.map((f) => (
            <div key={f.title} className="feat-card">
              <div className={`fi ${f.cls}`}>{f.icon}</div>
              <div className="feat-title">{f.title}</div>
              <div className="feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SHOWCASE */}
      <section className="showcase">
        <div className="showcase-head">
          <h2>Liat langsung,<br />bukan cuma kata-kata.</h2>
          <p>Scroll → untuk lihat semua fitur</p>
        </div>
        <div
          className="sc-track"
          ref={trackRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={() => setIsDragging(false)}
          onMouseUp={() => setIsDragging(false)}
          onMouseMove={handleMouseMove}
          onScroll={handleScroll}
        >
          {showcaseItems.map((item, i) => (
            <div key={item.name} className={`sc-item${activeIdx === i ? " active" : ""}`}>
              <div className="sc-phone">
                <div className="sn" /><div className="sc2" />
                <div className="sv" /><div className="sv2" /><div className="sp" />
                <div className="sc-inner">
                  <Image src={item.img} alt={item.name} width={232} height={504} style={{ objectFit: "cover", objectPosition: "top", width: "100%", height: "100%" }} />
                </div>
              </div>
              <div className="sc-name">{item.name}</div>
              <div className="sc-sub">{item.sub}</div>
            </div>
          ))}
        </div>
        <div className="dots">
          {showcaseItems.map((_, i) => (
            <button key={i} className={`landing-dot${activeIdx === i ? " on" : ""}`} onClick={() => scrollToItem(i)} />
          ))}
        </div>
      </section>

      {/* STATS */}
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card"><div className="sv b">5–15%</div><div className="sl">Cold email reply rate yang harus lo kejar</div></div>
          <div className="stat-card"><div className="sv g">40%+</div><div className="sl">Meeting rate dari setiap reply yang lo dapat</div></div>
          <div className="stat-card"><div className="sv w">7×</div><div className="sl">Touchpoints rata-rata sebelum deal closed</div></div>
          <div className="stat-card"><div className="sv b">+30%</div><div className="sl">Win rate naik pakai AI-personalized proposal</div></div>
        </div>
      </div>

      {/* CTA */}
      <div className="cta-section">
        <div className="cta-box">
          <div className="cta-left">
            <h2>Udah cukup<br />prospek manual<br />tanpa sistem.</h2>
            <p>SALESPAL ngasih lo unfair advantage. Mulai tracking, mulai closing, mulai winning — sekarang.</p>
          </div>
          <div className="cta-right">
            <Link href="/login" className="btn-primary" style={{ fontSize: 16, padding: "18px 40px" }}>
              Get SALESPAL Free →
            </Link>
            <div className="info-tag">🎬 Demo di TikTok @salespal.id</div>
            <div className="info-tag">✓ No credit card &nbsp;✓ Setup 2 menit</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="foot-brand">
            <Image src="/logo.png" alt="SalesPal" width={30} height={30} style={{ borderRadius: 9, objectFit: "contain", background: "#0c1a3a" }} />
            SALES<em>PAL</em>
          </div>
          <p>AI-Powered Sales Intelligence · Built for closers 🐺</p>
          <p>© 2026 SalesPal. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
