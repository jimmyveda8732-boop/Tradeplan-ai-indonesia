"use client";

import { useMemo, useState } from "react";
import {
  BarChart3, Camera, CheckCircle2, ChevronRight, FileImage,
  Info, LayoutDashboard, LineChart, LogOut, Menu, ShieldCheck,
  Sparkles, Upload, UserRound, WalletCards, X
} from "lucide-react";

type Risk = "Konservatif" | "Moderat" | "Agresif";
type ScreenshotType = "Chart" | "Order Book" | "Broker Summary" | "Fundamental";

const sampleStocks = [
  { code: "BBRI", name: "Bank Rakyat Indonesia", status: "BUY", price: "4.420", entry: "4.360–4.420", sl: "4.310", tp: "4.510 / 4.600", score: 86 },
  { code: "BMRI", name: "Bank Mandiri", status: "BUY", price: "6.820", entry: "6.680–6.820", sl: "6.620", tp: "6.950 / 7.150", score: 88 },
  { code: "UNTR", name: "United Tractors", status: "HOLD", price: "23.250", entry: "22.800–23.250", sl: "22.350", tp: "23.900 / 24.500", score: 81 },
  { code: "PTBA", name: "Bukit Asam", status: "WATCH", price: "2.370", entry: "2.320–2.380", sl: "2.300", tp: "2.430 / 2.520", score: 70 },
];

export default function Home() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [modal, setModal] = useState("10000000");
  const [risk, setRisk] = useState<Risk>("Moderat");
  const [shotType, setShotType] = useState<ScreenshotType>("Chart");
  const [files, setFiles] = useState<File[]>([]);
  const [showResult, setShowResult] = useState(false);

  const formattedModal = useMemo(() => {
    const n = Number(modal.replace(/\D/g, "")) || 0;
    return new Intl.NumberFormat("id-ID").format(n);
  }, [modal]);

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 6));
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><LineChart size={25} /></div>
          <div>
            <strong>TradePlan AI</strong>
            <span>Indonesia</span>
          </div>
          <button className="icon-button close-mobile" onClick={() => setMobileMenu(false)}><X /></button>
        </div>

        <nav>
          <a className="nav-item active" href="#dashboard"><LayoutDashboard /> Dashboard</a>
          <a className="nav-item" href="#analisis"><Camera /> Analisis Baru</a>
          <a className="nav-item" href="#hasil"><BarChart3 /> Hasil Analisis</a>
          <a className="nav-item" href="#riwayat"><FileImage /> Riwayat</a>
        </nav>

        <div className="sidebar-note">
          <ShieldCheck />
          <div><strong>Data tetap aman</strong><span>Screenshot hanya dipakai untuk analisis.</span></div>
        </div>

        <button className="nav-item logout"><LogOut /> Keluar</button>
      </aside>

      <section className="content">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileMenu(true)}><Menu /></button>
          <div>
            <p className="eyebrow">DASHBOARD</p>
            <h1>Trading Plan Harian</h1>
          </div>
          <div className="user-chip"><UserRound /><span>Mode Demo</span></div>
        </header>

        <div className="hero" id="dashboard">
          <div>
            <div className="hero-badge"><Sparkles size={16}/> Analisis screenshot dengan bantuan AI</div>
            <h2>Ubah screenshot sekuritas menjadi trading plan yang mudah dipahami.</h2>
            <p>Unggah chart, order book, broker summary, atau data fundamental. Infografis hanya dibuat saat kamu memintanya.</p>
            <a className="primary-button" href="#analisis">Mulai Analisis <ChevronRight size={18}/></a>
          </div>
          <div className="hero-visual">
            <div className="market-card">
              <span>CONTOH RINGKASAN</span>
              <strong>IHSG · BULLISH</strong>
              <div className="fake-chart">
                {[25,38,31,55,48,68,62,84,75,93].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}
              </div>
              <small>Gunakan data terbaru sebelum mengambil keputusan.</small>
            </div>
          </div>
        </div>

        <section className="section" id="analisis">
          <div className="section-heading">
            <div><p className="eyebrow">LANGKAH 1</p><h2>Buat analisis baru</h2></div>
            <span className="step-chip">Maksimal 6 screenshot</span>
          </div>

          <div className="form-grid">
            <div className="panel upload-panel">
              <h3><Upload size={20}/> Unggah screenshot Ajaib</h3>
              <div className="type-tabs">
                {(["Chart","Order Book","Broker Summary","Fundamental"] as ScreenshotType[]).map(t => (
                  <button key={t} className={shotType===t ? "selected":""} onClick={()=>setShotType(t)}>{t}</button>
                ))}
              </div>

              <label className="dropzone">
                <input type="file" accept="image/*" multiple onChange={(e)=>onFiles(e.target.files)} />
                <div className="upload-icon"><Upload /></div>
                <strong>Tekan untuk memilih screenshot</strong>
                <span>PNG, JPG, atau WEBP · screenshot harus jelas dan tidak terpotong</span>
              </label>

              {files.length > 0 && (
                <div className="file-list">
                  {files.map((f,i)=>(
                    <div className="file-row" key={`${f.name}-${i}`}>
                      <FileImage /><div><strong>{f.name}</strong><span>{(f.size/1024/1024).toFixed(2)} MB · {shotType}</span></div>
                      <button onClick={()=>setFiles(files.filter((_,idx)=>idx!==i))}><X size={17}/></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel settings-panel">
              <h3><WalletCards size={20}/> Pengaturan trading</h3>
              <label>Modal trading</label>
              <div className="money-input"><span>Rp</span><input value={formattedModal} onChange={(e)=>setModal(e.target.value.replace(/\D/g,""))}/></div>

              <label>Profil risiko</label>
              <div className="risk-options">
                {(["Konservatif","Moderat","Agresif"] as Risk[]).map(r=>(
                  <button key={r} onClick={()=>setRisk(r)} className={risk===r?"selected":""}>
                    <strong>{r}</strong>
                    <span>{r==="Konservatif"?"Risiko rendah":r==="Moderat"?"Seimbang":"Risiko lebih tinggi"}</span>
                  </button>
                ))}
              </div>

              <div className="info-box"><Info size={18}/><span>Versi awal memakai data dari screenshot. Integrasi Yahoo Finance dan berita akan ditambahkan pada tahap berikutnya.</span></div>
              <button className="primary-button full" disabled={files.length===0} onClick={()=>setShowResult(true)}>
                <Sparkles size={18}/> Buat Trading Plan Demo
              </button>
            </div>
          </div>
        </section>

        <section className="section" id="hasil">
          <div className="section-heading">
            <div><p className="eyebrow">LANGKAH 2</p><h2>Contoh hasil analisis</h2></div>
            <button className="secondary-button" disabled><FileImage size={17}/> Buat Infografis</button>
          </div>

          {!showResult ? (
            <div className="empty-state">
              <BarChart3 size={40}/><h3>Belum ada analisis</h3>
              <p>Unggah minimal satu screenshot lalu tekan “Buat Trading Plan Demo”.</p>
            </div>
          ) : (
            <>
              <div className="summary-strip">
                <div><span>Modal</span><strong>Rp {formattedModal}</strong></div>
                <div><span>Profil risiko</span><strong>{risk}</strong></div>
                <div><span>Sentimen contoh</span><strong className="positive">Bullish</strong></div>
                <div><span>Status</span><strong>Demo UI</strong></div>
              </div>

              <div className="stock-grid">
                {sampleStocks.map((s,idx)=>(
                  <article className="stock-card" key={s.code}>
                    <div className="stock-head">
                      <div><span className="rank">#{idx+1}</span><h3>{s.code}</h3><small>{s.name}</small></div>
                      <span className={`status ${s.status.toLowerCase()}`}>{s.status}</span>
                    </div>
                    <div className="price"><span>Harga terakhir</span><strong>{s.price}</strong></div>
                    <div className="mini-chart">{[32,45,39,55,49,66,61,74,69,82].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div>
                    <div className="plan-table">
                      <div><span>Entry</span><strong>{s.entry}</strong></div>
                      <div><span>Stop loss</span><strong>{s.sl}</strong></div>
                      <div><span>Take profit</span><strong>{s.tp}</strong></div>
                      <div><span>Skor</span><strong>{s.score}/100</strong></div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <footer>
          <p><strong>Disclaimer:</strong> Aplikasi ini bukan ajakan membeli atau menjual saham. Selalu lakukan riset pribadi dan gunakan manajemen risiko.</p>
          <span>TradePlan AI Indonesia · Versi UI 1.0</span>
        </footer>
      </section>
    </main>
  );
}
