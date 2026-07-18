"use client";

import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type RiskLevel = "Konservatif" | "Moderat" | "Agresif";
type TradingMode = "SCALPING" | "PAGI_SORE" | "SORE_PAGI" | "SWING";
type Recommendation = "BUY" | "HOLD" | "SELL" | "WATCHLIST";
type PriorityLevel = "PRIORITAS" | "BUY BERSYARAT" | "WATCHLIST" | "HINDARI";
type TradeStatus = "TRADE" | "NO TRADE";

type StockPlan = {
  code: string;
  name: string;
  trend: string;
  recommendation: Recommendation;
  currentPrice: string;
  support: string;
  resistance: string;
  entry: string;
  stopLoss: string;
  takeProfit1: string;
  takeProfit2: string;
  setupScore: number;
  tradeStatus: TradeStatus;
  priority: PriorityLevel;
  validUntil: string;
  holdingPeriod: string;
  riskReward: string;
  maxRiskPercent: number;
  estimatedLots: number;
  estimatedPositionValue: string;
  estimatedMaxLoss: string;
  cancellationCondition: string;
  dataCompleteness: number;
  strategy: string;
  reason: string;
};

type MarketOverview = {
  ihsgCondition: string;
  marketSentiment?: string;
  foreignFlow: string;
  strongestSignal?: string;
  caution: string;
  overnightSentiment?: string;
  globalMarketSentiment?: string;
  strongestSector?: string;
};

type WatchlistItem = {
  code: string;
  score: string | number;
  categoryMatches: string[];
  reason: string;
};

type TradingPlan = {
  title: string;
  summary: string;
  marketBias: string;
  marketOverview: MarketOverview;
  watchlist: WatchlistItem[];
  stocks: StockPlan[];
  riskWarning: string;
};

type ApiResponse = {
  success: boolean;
  plan?: TradingPlan;
  message?: string;
  totalImages?: number;
};

type DailyDashboard = {
  plan: TradingPlan;
  generatedAt: string | null;
  dataAsOf: string | null;
  status: "TODAY" | "PREVIOUS_DAY" | "NOT_AVAILABLE";
};

type MarketCategoryKey =
  | "ihsg"
  | "topGainer"
  | "topLoser"
  | "topVolume"
  | "foreignBuy"
  | "foreignSell";

type UploadFiles = {
  ihsg: File | null;
  topGainer: File | null;
  topLoser: File | null;
  topVolume: File | null;
  foreignBuy: File | null;
  foreignSell: File | null;
};

const MAX_SIZE = 8 * 1024 * 1024;

const CATEGORIES: Array<{
  key: MarketCategoryKey;
  label: string;
  required: boolean;
}> = [
  { key: "ihsg", label: "IHSG", required: true },
  { key: "topGainer", label: "Top Gainer", required: false },
  { key: "topLoser", label: "Top Loser", required: false },
  { key: "topVolume", label: "Top Volume", required: false },
  { key: "foreignBuy", label: "Net Foreign Buy", required: false },
  { key: "foreignSell", label: "Net Foreign Sell", required: false },
];

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

const emptyUploads: UploadFiles = {
  ihsg: null,
  topGainer: null,
  topLoser: null,
  topVolume: null,
  foreignBuy: null,
  foreignSell: null,
};

const MODE_OPTIONS: Array<{
  value: TradingMode;
  label: string;
  description: string;
}> = [
  {
    value: "SCALPING",
    label: "Scalping",
    description: "Transaksi cepat intraday, fokus likuiditas dan momentum.",
  },
  {
    value: "PAGI_SORE",
    label: "Beli Pagi Jual Sore",
    description: "Entry setelah konfirmasi pembukaan dan keluar sebelum penutupan.",
  },
  {
    value: "SORE_PAGI",
    label: "Beli Sore Jual Pagi",
    description: "Posisi overnight dengan filter risiko lebih ketat.",
  },
  {
    value: "SWING",
    label: "Swing 2–7%",
    description: "Holding beberapa hari dengan target profit 2 sampai 7 persen.",
  },
];

export default function Home() {
  const [uploads, setUploads] = useState<UploadFiles>(emptyUploads);
  const [risk, setRisk] = useState<RiskLevel>("Moderat");
  const [modal, setModal] = useState("10000000");
  const [tradingMode, setTradingMode] = useState<TradingMode>("PAGI_SORE");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [plan, setPlan] = useState<TradingPlan | null>(null);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [dailyDashboard, setDailyDashboard] = useState<DailyDashboard | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState("");

  const formattedModal = useMemo(() => {
    const value = Number(modal.replace(/\D/g, "")) || 0;
    return new Intl.NumberFormat("id-ID").format(value);
  }, [modal]);

  function validateFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Semua file harus berupa gambar PNG, JPG, atau WEBP.";
    }
    if (file.size > MAX_SIZE) {
      return `${file.name} melebihi 8 MB.`;
    }
    return "";
  }

  function resizeDimensions(width: number, height: number) {
    const maxEdge = Math.max(width, height);
    if (maxEdge <= 1600) {
      return { width, height };
    }
    const ratio = 1600 / maxEdge;
    return {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio),
    };
  }

  async function compressImage(file: File): Promise<File> {
    const fileDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gagal memuat gambar."));
      img.src = fileDataUrl;
    });

    const { width, height } = resizeDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas tidak tersedia untuk kompresi gambar.");
    }

    ctx.drawImage(image, 0, 0, width, height);

    const maxBytes = 600 * 1024;
    let quality = 0.65;
    let blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error("Gagal membuat hasil gambar."));
          } else {
            resolve(result);
          }
        },
        "image/jpeg",
        quality,
      );
    });

    while (blob.size > maxBytes && quality > 0.4) {
      quality = Math.max(0.4, quality - 0.05);
      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (!result) {
              reject(new Error("Gagal membuat hasil gambar."));
            } else {
              resolve(result);
            }
          },
          "image/jpeg",
          quality,
        );
      });
      if (quality === 0.4) {
        break;
      }
    }

    const outputName = file.name.replace(/\.(png|jpe?g|webp)$/i, ".jpg");
    return new File([blob], outputName, { type: "image/jpeg" });
  }

  function handleFileChange(key: MarketCategoryKey, e: ChangeEvent<HTMLInputElement>) {
    setError("");
    setPlan(null);

    const file = e.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    const validation = validateFile(file);
    if (validation) {
      setError(validation);
      return;
    }

    setUploads((current) => ({ ...current, [key]: file }));
  }

  function removeFile(key: MarketCategoryKey) {
    setUploads((current) => ({ ...current, [key]: null }));
    setPlan(null);
    setError("");
    setSaveStatus("");
  }

  async function saveAnalysisToSupabase(plan: TradingPlan) {
    setSaveStatus("Menyimpan...");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSaveStatus("Belum login — hasil tidak disimpan");
        return;
      }

      const payload = {
        user_id: user.id,
        analysis_type: "MANUAL",
        title: plan.title,
        summary: plan.summary,
        market_bias: plan.marketBias,
        market_overview: plan.marketOverview,
        watchlist: plan.watchlist,
        stocks: plan.stocks,
        risk_warning: plan.riskWarning,
        raw_plan: plan,
      };

      const { error } = await supabase.from("analyses").insert(payload);

      if (error) {
        throw error;
      }

      setSaveStatus("Tersimpan");
    } catch (err) {
      console.error("Gagal menyimpan analisis ke Supabase:", err);
      setSaveStatus("Gagal menyimpan");
    }
  }

  async function analyze(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPlan(null);
    setSaveStatus("");

    if (!uploads.ihsg) {
      setError("IHSG wajib diunggah.");
      return;
    }

    setLoading(true);
    setLoadingText("Mengompres screenshot...");

    try {
      const form = new FormData();
      const compressedUploads: Partial<UploadFiles> = {};

      for (const key of Object.keys(uploads) as MarketCategoryKey[]) {
        const file = uploads[key];
        if (file) {
          compressedUploads[key] = await compressImage(file);
        }
      }

      if (compressedUploads.ihsg) form.append("ihsg", compressedUploads.ihsg);
      if (compressedUploads.topGainer) form.append("topGainer", compressedUploads.topGainer);
      if (compressedUploads.topLoser) form.append("topLoser", compressedUploads.topLoser);
      if (compressedUploads.topVolume) form.append("topVolume", compressedUploads.topVolume);
      if (compressedUploads.foreignBuy) form.append("foreignBuy", compressedUploads.foreignBuy);
      if (compressedUploads.foreignSell) form.append("foreignSell", compressedUploads.foreignSell);
      form.append("modal", modal);
      form.append("risk", risk);
      form.append("tradingMode", tradingMode);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });

      const data: ApiResponse = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Analisis gagal.");
      }

      if (!data.plan) {
        throw new Error("Rencana trading tidak ditemukan dalam respons API.");
      }

      setPlan(data.plan);
      await saveAnalysisToSupabase(data.plan);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Terjadi kesalahan saat memproses permintaan.");
      }
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  }

  function getRecommendationClass(recommendation: Recommendation) {
    switch (recommendation) {
      case "BUY":
        return "badge recommendation buy";
      case "HOLD":
        return "badge recommendation hold";
      case "SELL":
        return "badge recommendation sell";
      case "WATCHLIST":
        return "badge recommendation watchlist";
      default:
        return "badge recommendation";
    }
  }

  function getTrendClass(trend: string) {
    const normalized = trend.toLowerCase();
    if (normalized.includes("bull")) return "trendLabel bullish";
    if (normalized.includes("bear")) return "trendLabel bearish";
    if (normalized.includes("side")) return "trendLabel sideways";
    if (normalized.includes("rebound")) return "trendLabel rebound";
    return "trendLabel neutral";
  }

  function getPriorityClass(priority: string) {
    switch (priority) {
      case "PRIORITAS":
        return "badge recommendation buy";
      case "BUY BERSYARAT":
        return "badge recommendation hold";
      case "WATCHLIST":
        return "badge recommendation watchlist";
      case "HINDARI":
        return "badge recommendation sell";
      default:
        return "badge recommendation";
    }
  }

  function getTradeStatusClass(status: string) {
    return status === "TRADE" ? "badge recommendation buy" : "badge recommendation sell";
  }

  const activeModeLabel = MODE_OPTIONS.find((item) => item.value === tradingMode)?.label ?? tradingMode;

  async function loadDailyDashboard() {
    setDailyLoading(true);
    setDailyError("");

    try {
      const response = await fetch("/api/daily-plan");
      const data = await response.json();

      if (!response.ok || !data.success) {
        setDailyDashboard(null);
        setDailyError(data.message ?? "Dashboard pra-pasar belum tersedia.");
        return;
      }

      setDailyDashboard({
        plan: data.plan,
        generatedAt: data.generatedAt ?? null,
        dataAsOf: data.dataAsOf ?? null,
        status: data.status ?? "NOT_AVAILABLE",
      });
    } catch (err) {
      setDailyDashboard(null);
      setDailyError(err instanceof Error ? err.message : "Gagal memuat dashboard pra-pasar.");
    } finally {
      setDailyLoading(false);
    }
  }

  useEffect(() => {
    void loadDailyDashboard();
  }, []);

  return (
    <main className="app">
      <header className="navbar">
        <div className="container navbarContent">
          <a href="#" className="brand">
            <span className="brandLogo">TP</span>
            <span className="brandText">
              <strong>TradePlan AI Indonesia</strong>
              <small>Dashboard saham berbasis screenshot</small>
            </span>
          </a>
          <a href="#analisis" className="navButton">
            Mulai Analisis
          </a>
        </div>
      </header>

      <section className="preMarketSection">
        <div className="container preMarketCard">
          <div className="preMarketHeader">
            <div>
              <span className="sectionLabel">DASHBOARD PRA-PEMBUKAAN</span>
              <h2>Dashboard otomatis sebelum pembukaan pasar</h2>
              <p>Data ini memakai penutupan sebelumnya, upload terbaru, dan sentimen semalam. Bukan data live hari ini.</p>
            </div>
            <div className="preMarketActions">
              <button type="button" className="secondaryButton" onClick={() => void loadDailyDashboard()}>
                Muat Ulang Dashboard
              </button>
              <a href="#analisis" className="secondaryButton">
                Analisis Manual
              </a>
              <a href="#analisis" className="secondaryButton">
                Unggah Data Pasar Terbaru
              </a>
            </div>
          </div>

          {dailyLoading ? (
            <div className="resultState compact">
              <span className="spinner" />
              <strong>Sedang menyiapkan dashboard pra-pasar...</strong>
              <p>Memuat data terbaru dari sistem otomatis.</p>
            </div>
          ) : dailyDashboard ? (
            <div className="dailyDashboard">
              <div className="dailyDashboardHeader">
                <div>
                  <p className="planTitle">{dailyDashboard.plan.title}</p>
                  <p className="planSummary">{dailyDashboard.plan.summary}</p>
                </div>
                <div className="dailyMeta">
                  <span className={dailyDashboard.status === "TODAY" ? "successBadge" : "badge"}>{dailyDashboard.status}</span>
                  <small>Generated: {dailyDashboard.generatedAt ? new Date(dailyDashboard.generatedAt).toLocaleString("id-ID") : "-"}</small>
                </div>
              </div>
              <div className="overviewGrid">
                <div className="overviewItem">
                  <span>Bias pasar</span>
                  <strong>{dailyDashboard.plan.marketBias}</strong>
                </div>
                <div className="overviewItem">
                  <span>Data sebagai</span>
                  <strong>{dailyDashboard.dataAsOf ?? "Perlu data terakhir"}</strong>
                </div>
                <div className="overviewItem">
                  <span>IHSG</span>
                  <strong>{dailyDashboard.plan.marketOverview.ihsgCondition}</strong>
                </div>
                <div className="overviewItem">
                  <span>Sentimen semalam</span>
                  <strong>{dailyDashboard.plan.marketOverview.overnightSentiment ?? dailyDashboard.plan.marketOverview.marketSentiment ?? "Perlu data"}</strong>
                </div>
                <div className="overviewItem fullWidth">
                  <span>Catatan</span>
                  <strong>{dailyDashboard.plan.marketOverview.caution}</strong>
                </div>
              </div>
              <div className="watchlistSection">
                <div className="sectionSubheading">
                  <span>Watchlist pra-pembukaan</span>
                </div>
                <div className="watchlistGrid">
                  {dailyDashboard.plan.watchlist.map((item) => (
                    <article className="watchlistItem" key={item.code}>
                      <div className="watchlistHeader">
                        <p className="stockCode">{item.code}</p>
                        <strong>{item.score}</strong>
                      </div>
                      <p className="watchlistReason">{item.reason}</p>
                      <small>Kategori: {item.categoryMatches.join(", ")}</small>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="resultState compact">
              <span className="emptyIcon">DP</span>
              <strong>Dashboard pra-pasar belum tersedia</strong>
              <p>{dailyError || "Belum ada dashboard otomatis yang tersimpan untuk hari ini."}</p>
            </div>
          )}
        </div>
      </section>

      <section className="hero">
        <div className="container heroGrid">
          <div className="heroContent">
            <span className="badge">Didukung Gemini AI</span>
            <h1>Dashboard TradePlan AI untuk screenshot saham Indonesia.</h1>
            <p>
              Unggah data pasar dari aplikasi sekuritas, dan aplikasi akan melengkapi berita, sentimen, serta data harga pasar.
            </p>
            <div className="heroActions">
              <a href="#analisis" className="primaryButton">
                Analisis Sekarang
              </a>
              <span>PNG/JPG/WEBP, otomatis dikompres.</span>
            </div>
          </div>

          <div className="heroCard">
            <div className="heroMetric">
              <strong>Data IHSG Wajib</strong>
              <p>Dashboard memerlukan data IHSG untuk membuat ringkasan pasar.</p>
            </div>
            <div className="heroMetric">
              <strong>5 Kategori Tambahan</strong>
              <p>Top Gainer, Top Loser, Top Volume, Net Foreign Buy, Net Foreign Sell.</p>
            </div>
            <div className="heroMetric">
              <strong>Analisis Lengkap</strong>
              <p>Berita, sentimen, dan histori pasar akan dilengkapi oleh AI.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="analisis" className="analysisSection">
        <div className="container">
          <div className="sectionHeading">
            <span className="sectionLabel">ANALISIS BARU</span>
            <h2>Unggah screenshot pasar sekuritas</h2>
            <p>
              Gunakan screenshot data pasar dari aplikasi sekuritas. IHSG wajib diunggah, kategori lain boleh kosong.
            </p>
          </div>

          <form className="analysisGrid" onSubmit={analyze}>
            <div className="formCard">
              <div className="formGroup">
                <label htmlFor="modal">Modal investasi</label>
                <div className="moneyInput">
                  <span>Rp</span>
                  <input
                    id="modal"
                    type="text"
                    inputMode="numeric"
                    value={modal}
                    onChange={(e) => setModal(e.target.value.replace(/\D/g, ""))}
                    placeholder="10000000"
                  />
                </div>
                <small>Modal terformat: Rp{formattedModal}</small>
              </div>

              <div className="formGroup">
                <label>Profil risiko</label>
                <div className="riskOptions">
                  {(["Konservatif", "Moderat", "Agresif"] as RiskLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={risk === level ? "riskButton active" : "riskButton"}
                      onClick={() => setRisk(level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="formGroup">
                <label>Mode trading</label>
                <div className="modeGrid">
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={tradingMode === option.value ? "modeCard active" : "modeCard"}
                      onClick={() => setTradingMode(option.value)}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="formGroup">
                <label>Unggah kategori data</label>
                <div className="categoryGrid">
                  {CATEGORIES.map(({ key, label, required }) => {
                    const file = uploads[key];
                    return (
                      <div className="categoryCard" key={key}>
                        <div className="categoryHeader">
                          <div>
                            <p className="categoryTitle">{label}</p>
                            {required && <span className="requiredBadge">Wajib</span>}
                          </div>
                          <div className={`categoryStatus ${file ? "uploaded" : "missing"}`}>
                            {file ? "Sudah diunggah" : "Belum diunggah"}
                          </div>
                        </div>
                        <label className="dropzone small">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => handleFileChange(key, e)}
                          />
                          <span>{file ? file.name : `Unggah ${label}`}</span>
                          <small>PNG/JPG/WEBP, maksimal 8 MB.</small>
                        </label>
                        {file && (
                          <button type="button" className="removeFileSmall" onClick={() => removeFile(key)}>
                            Hapus file
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {error && <div className="errorMessage">{error}</div>}

              <button type="submit" className="analyzeButton" disabled={loading || !uploads.ihsg}>
                {loading ? (loadingText || "Gemini sedang menganalisis...") : "Mulai Analisis AI"}
              </button>
            </div>

            <div className="resultCard">
              <div className="resultHeader">
                <div>
                  <span className="sectionLabel">HASIL DASHBOARD</span>
                  <h2>Ringkasan Trading Plan</h2>
                </div>
                <div className="resultHeaderActions">
                  {plan && <span className="successBadge">Dashboard siap</span>}
                  {saveStatus ? <span className="saveStatusBadge">{saveStatus}</span> : null}
                </div>
              </div>

              {loading ? (
                <div className="resultState">
                  <span className="spinner" />
                  <strong>Gemini sedang membaca screenshot</strong>
                  <p>Harap tunggu dan jangan tutup halaman ini.</p>
                </div>
              ) : plan ? (
                <section className="dashboard">
                  <div className="planTop">
                    <div>
                      <p className="planTitle">{plan.title}</p>
                      <p className="planSummary">{plan.summary}</p>
                    </div>
                    <div className="marketBiasCard">
                      <span>Market Bias</span>
                      <strong>{plan.marketBias}</strong>
                    </div>
                  </div>

                  <div className="overviewGrid">
                    <div className="overviewItem">
                      <span>IHSG</span>
                      <strong>{plan.marketOverview.ihsgCondition}</strong>
                    </div>
                    <div className="overviewItem">
                      <span>Sentimen</span>
                      <strong>{plan.marketOverview.marketSentiment}</strong>
                    </div>
                    <div className="overviewItem">
                      <span>Arus asing</span>
                      <strong>{plan.marketOverview.foreignFlow}</strong>
                    </div>
                    <div className="overviewItem">
                      <span>Sinyal kuat</span>
                      <strong>{plan.marketOverview.strongestSignal}</strong>
                    </div>
                    <div className="overviewItem fullWidth">
                      <span>Catatan</span>
                      <strong>{plan.marketOverview.caution}</strong>
                    </div>
                  </div>

                  <div className="modeSummaryCard">
                    <div>
                      <span>Mode trading aktif</span>
                      <strong>{activeModeLabel}</strong>
                    </div>
                    <div>
                      <span>Setup Score</span>
                      <strong>Skor kualitas setup, bukan jaminan profit.</strong>
                    </div>
                  </div>

                  {plan.watchlist.length > 0 && (
                    <div className="watchlistSection">
                      <div className="sectionSubheading">
                        <span>Watchlist singkat</span>
                      </div>
                      <div className="watchlistGrid">
                        {plan.watchlist.map((item) => (
                          <article className="watchlistItem" key={item.code}>
                            <div className="watchlistHeader">
                              <p className="stockCode">{item.code}</p>
                              <strong>{item.score}</strong>
                            </div>
                            <p className="watchlistReason">{item.reason}</p>
                            <small>Kategori: {item.categoryMatches.join(", ")}</small>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="stockGrid">
                    {plan.stocks.map((stock) => (
                      <article className="stockCard" key={stock.code}>
                        <div className="stockCardHeader">
                          <div>
                            <p className="stockCode">{stock.code}</p>
                            <p className="stockName">{stock.name}</p>
                          </div>
                          <div className="statusGroup">
                            <span className={getTrendClass(stock.trend)}>{stock.trend}</span>
                            <span className={getPriorityClass(stock.priority)}>{stock.priority}</span>
                          </div>
                        </div>

                        <div className="stockMetrics">
                          <div>
                            <span>Harga terakhir</span>
                            <strong>{stock.currentPrice}</strong>
                          </div>
                          <div>
                            <span>Support</span>
                            <strong>{stock.support}</strong>
                          </div>
                          <div>
                            <span>Resistance</span>
                            <strong>{stock.resistance}</strong>
                          </div>
                        </div>

                        <div className="stockMetrics">
                          <div>
                            <span>Entry</span>
                            <strong>{stock.entry}</strong>
                          </div>
                          <div>
                            <span>Stop loss</span>
                            <strong>{stock.stopLoss}</strong>
                          </div>
                          <div>
                            <span>Take profit 1</span>
                            <strong>{stock.takeProfit1}</strong>
                          </div>
                        </div>

                        <div className="stockMetrics">
                          <div>
                            <span>Take profit 2</span>
                            <strong>{stock.takeProfit2}</strong>
                          </div>
                          <div>
                            <span>Risk/reward</span>
                            <strong>{stock.riskReward}</strong>
                          </div>
                          <div>
                            <span>Jumlah lot</span>
                            <strong>{stock.estimatedLots}</strong>
                          </div>
                        </div>

                        <div className="stockMetrics">
                          <div>
                            <span>Nilai pembelian</span>
                            <strong>{stock.estimatedPositionValue}</strong>
                          </div>
                          <div>
                            <span>Risiko maksimal</span>
                            <strong>{stock.estimatedMaxLoss}</strong>
                          </div>
                          <div>
                            <span>Valid sampai</span>
                            <strong>{stock.validUntil}</strong>
                          </div>
                        </div>

                        <div className="stockMetrics">
                          <div>
                            <span>Holding period</span>
                            <strong>{stock.holdingPeriod}</strong>
                          </div>
                          <div>
                            <span>Setup score</span>
                            <strong>{stock.setupScore}/100</strong>
                          </div>
                          <div>
                            <span>Status</span>
                            <strong>{stock.tradeStatus}</strong>
                          </div>
                        </div>

                        <div className="confidenceBar">
                          <div className="confidenceFill" style={{ width: `${Math.min(Math.max(stock.dataCompleteness, 0), 100)}%` }} />
                        </div>
                        <div className="confidenceMeta">
                          <span>Kelengkapan Data</span>
                          <strong>{stock.dataCompleteness}%</strong>
                        </div>

                        <div className="strategyGroup">
                          <div>
                            <span>Strategi</span>
                            <strong>{stock.strategy}</strong>
                          </div>
                          <div>
                            <span>Kondisi pembatalan</span>
                            <p>{stock.cancellationCondition}</p>
                          </div>
                          <div>
                            <span>Alasan singkat</span>
                            <p>{stock.reason}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="riskFooter">
                    <strong>Peringatan risiko</strong>
                    <p>{plan.riskWarning}</p>
                  </div>
                </section>
              ) : (
                <div className="resultState">
                  <span className="emptyIcon">AI</span>
                  <strong>Dashboard belum tersedia</strong>
                  <p>Unggah screenshot dan mulai analisis untuk melihat rencana trading.</p>
                </div>
              )}
            </div>
          </form>
        </div>
      </section>

      <section className="sourceSection container">
        <div className="sourceCard">
          <strong>Sumber analisis</strong>
          <ul className="sourceList">
            <li>Data sekuritas dari screenshot pengguna.</li>
            <li>Berita dan sentimen pasar dari sumber online.</li>
            <li>Harga dan histori saham dari penyedia data pasar.</li>
          </ul>
        </div>
      </section>

      <section className="container warningCard">
        <strong>Peringatan risiko</strong>
        <p>
          Hasil analisis disediakan untuk tujuan informasi dan edukasi, bukan rekomendasi membeli atau menjual saham.
          Selalu lakukan pemeriksaan mandiri sebelum mengambil keputusan investasi.
        </p>
      </section>

      <footer className="footer">
        <div className="container footerContent">
          <strong>TradePlan AI Indonesia</strong>
          <span>Analisis saham berbasis screenshot dan Gemini AI.</span>
        </div>
      </footer>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(html) {
          scroll-behavior: smooth;
        }

        :global(body) {
          margin: 0;
          background:
            radial-gradient(circle at 15% 0%, rgba(14, 116, 144, 0.22), transparent 34%),
            radial-gradient(circle at 90% 18%, rgba(37, 99, 235, 0.15), transparent 30%),
            #050914;
          color: #f8fafc;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        :global(button),
        :global(input) {
          font: inherit;
        }

        :global(button) {
          -webkit-tap-highlight-color: transparent;
        }

        .app {
          min-height: 100vh;
          overflow-x: hidden;
        }

        .container {
          width: min(1160px, calc(100% - 32px));
          margin: 0 auto;
        }

        .navbar {
          position: sticky;
          top: 0;
          z-index: 20;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(5, 9, 20, 0.92);
          backdrop-filter: blur(18px);
        }

        .navbarContent {
          min-height: 74px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: inherit;
          text-decoration: none;
        }

        .brandLogo {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          background: linear-gradient(135deg, #22d3ee, #5eead4);
          color: #04202e;
          font-weight: 900;
          box-shadow: 0 12px 36px rgba(34, 211, 238, 0.2);
        }

        .brandText {
          display: flex;
          flex-direction: column;
        }

        .brandText strong {
          font-size: 16px;
        }

        .brandText small {
          margin-top: 2px;
          color: #94a3b8;
          font-size: 12px;
        }

        .navButton,
        .primaryButton,
        .secondaryButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: linear-gradient(135deg, #22d3ee, #5eead4);
          color: #04202e;
          text-decoration: none;
          font-weight: 900;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .navButton {
          padding: 11px 16px;
          font-size: 14px;
        }

        .primaryButton {
          padding: 14px 20px;
        }

        .secondaryButton {
          padding: 10px 14px;
          font-size: 13px;
          background: rgba(8, 47, 73, 0.65);
          color: #e0f2fe;
          border: 1px solid rgba(103, 232, 249, 0.24);
        }

        .navButton:hover,
        .primaryButton:hover,
        .secondaryButton:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 34px rgba(34, 211, 238, 0.2);
        }

        .preMarketSection {
          padding: 48px 0 24px;
        }

        .preMarketCard {
          padding: 24px;
          border-radius: 24px;
          border: 1px solid rgba(103, 232, 249, 0.16);
          background: rgba(6, 18, 34, 0.86);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.2);
        }

        .preMarketHeader {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .preMarketHeader h2 {
          margin: 10px 0;
          font-size: clamp(24px, 3.6vw, 34px);
        }

        .preMarketHeader p {
          margin: 0;
          color: #94a3b8;
          line-height: 1.7;
        }

        .preMarketActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .dailyDashboard {
          display: grid;
          gap: 16px;
        }

        .dailyDashboardHeader {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        }

        .dailyMeta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          color: #94a3b8;
          font-size: 12px;
        }

        .hero {
          padding: 82px 0 68px;
        }

        .heroGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
          gap: 44px;
          align-items: center;
        }

        .badge,
        .sectionLabel {
          color: #67e8f9;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.14em;
        }

        .badge {
          display: inline-flex;
          padding: 8px 12px;
          border: 1px solid rgba(34, 211, 238, 0.28);
          border-radius: 999px;
          background: rgba(8, 145, 178, 0.1);
        }

        .hero h1 {
          max-width: 760px;
          margin: 22px 0 20px;
          font-size: clamp(42px, 6vw, 72px);
          line-height: 1.02;
          letter-spacing: -0.055em;
        }

        .heroContent > p {
          max-width: 700px;
          margin: 0;
          color: #b6c2d3;
          font-size: 18px;
          line-height: 1.75;
        }

        .heroActions {
          margin-top: 32px;
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
        }

        .heroActions > span {
          color: #64748b;
          font-size: 13px;
        }

        .heroCard {
          display: grid;
          gap: 14px;
          padding: 24px;
          border-radius: 22px;
          background: rgba(10, 18, 36, 0.82);
          border: 1px solid rgba(103, 232, 249, 0.15);
        }

        .heroMetric {
          padding: 20px;
          border-radius: 18px;
          background: rgba(8, 47, 73, 0.45);
          border: 1px solid rgba(103, 232, 249, 0.08);
        }

        .heroMetric strong {
          display: block;
          margin-bottom: 6px;
          font-size: 18px;
          color: #e0f2fe;
        }

        .heroMetric p {
          margin: 0;
          color: #94a3b8;
          line-height: 1.6;
          font-size: 14px;
        }

        .analysisSection {
          padding: 58px 0 44px;
        }

        .sectionHeading {
          max-width: 720px;
          margin-bottom: 28px;
        }

        .sectionHeading h2 {
          margin: 10px 0;
          font-size: clamp(32px, 5vw, 52px);
          letter-spacing: -0.045em;
        }

        .sectionHeading p {
          margin: 0;
          color: #94a3b8;
          line-height: 1.7;
        }

        .analysisGrid {
          display: grid;
          grid-template-columns: minmax(330px, 0.9fr) minmax(0, 1.1fr);
          gap: 24px;
          align-items: start;
        }

        .formCard,
        .resultCard {
          padding: 26px;
          border-radius: 22px;
          border: 1px solid rgba(148, 163, 184, 0.17);
          background: rgba(10, 18, 36, 0.78);
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(18px);
        }

        .formGroup + .formGroup {
          margin-top: 26px;
        }

        .formGroup > label {
          display: block;
          margin-bottom: 10px;
          color: #dbeafe;
          font-size: 14px;
          font-weight: 800;
        }

        .moneyInput {
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 14px;
          background: #071020;
        }

        .moneyInput:focus-within {
          border-color: rgba(34, 211, 238, 0.7);
          box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.08);
        }

        .moneyInput span {
          padding-left: 15px;
          color: #67e8f9;
          font-weight: 900;
        }

        .moneyInput input {
          width: 100%;
          padding: 15px;
          border: 0;
          outline: none;
          background: transparent;
          color: white;
        }

        .formGroup > small {
          display: block;
          margin-top: 8px;
          color: #64748b;
        }

        .riskOptions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .riskButton {
          padding: 11px 8px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 10px;
          background: #071020;
          color: #94a3b8;
          cursor: pointer;
          font-weight: 800;
          transition: 0.2s ease;
        }

        .riskButton:hover {
          border-color: rgba(34, 211, 238, 0.4);
          color: #e2e8f0;
        }

        .riskButton.active {
          border-color: #67e8f9;
          background: #67e8f9;
          color: #04202e;
        }

        .categoryGrid {
          display: grid;
          gap: 14px;
        }

        .categoryCard {
          padding: 18px;
          border-radius: 18px;
          background: rgba(8, 47, 73, 0.45);
          border: 1px solid rgba(103, 232, 249, 0.12);
        }

        .categoryHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .categoryTitle {
          margin: 0 0 6px;
          font-size: 15px;
          font-weight: 900;
          color: #e0f2fe;
        }

        .requiredBadge {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          color: #0f766e;
          background: rgba(20, 184, 166, 0.18);
        }

        .categoryStatus {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(14, 116, 144, 0.18);
          color: #c7d2fe;
          font-weight: 700;
          font-size: 13px;
        }

        .categoryStatus.uploaded {
          background: rgba(20, 184, 166, 0.16);
          color: #bbf7d0;
        }

        .dropzone.small {
          min-height: 140px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px dashed rgba(103, 232, 249, 0.52);
          border-radius: 16px;
          background: rgba(8, 47, 73, 0.2);
          text-align: center;
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
        }

        .dropzone.small:hover {
          border-color: #67e8f9;
          background: rgba(8, 47, 73, 0.32);
          transform: translateY(-2px);
        }

        .dropzone.small input {
          display: none;
        }

        .dropzone.small span {
          display: block;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .dropzone.small small {
          display: block;
          color: #94a3b8;
        }

        .removeFileSmall {
          margin-top: 12px;
          border: 0;
          background: transparent;
          color: #fca5a5;
          cursor: pointer;
          font-size: 13px;
        }

        .errorMessage {
          margin-top: 16px;
          padding: 12px 14px;
          border: 1px solid rgba(248, 113, 113, 0.3);
          border-radius: 12px;
          background: rgba(127, 29, 29, 0.22);
          color: #fecaca;
          line-height: 1.5;
        }

        .analyzeButton {
          width: 100%;
          margin-top: 18px;
          padding: 15px;
          border: 0;
          border-radius: 13px;
          background: linear-gradient(135deg, #22d3ee, #5eead4);
          color: #04202e;
          cursor: pointer;
          font-weight: 900;
          transition: transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
        }

        .analyzeButton:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 14px 34px rgba(34, 211, 238, 0.18);
        }

        .analyzeButton:disabled {
          cursor: not-allowed;
          opacity: 0.42;
        }

        .resultCard {
          min-height: 610px;
        }

        .resultHeader {
          padding-bottom: 20px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        }

        .resultHeaderActions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        .resultHeader h2 {
          margin: 7px 0 0;
        }

        .successBadge {
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.14);
          color: #a7f3d0;
          font-size: 12px;
          font-weight: 900;
        }

        .saveStatusBadge {
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(8, 47, 73, 0.6);
          color: #bae6fd;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid rgba(103, 232, 249, 0.24);
        }

        .resultState {
          min-height: 480px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          text-align: center;
        }

        .resultState.compact {
          padding: 16px;
          border-radius: 16px;
          background: rgba(8, 47, 73, 0.24);
        }

        .resultState strong {
          margin-top: 14px;
          color: #e2e8f0;
        }

        .resultState p {
          max-width: 380px;
          margin: 9px 0 0;
          line-height: 1.65;
        }

        .emptyIcon {
          width: 64px;
          height: 64px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: rgba(34, 211, 238, 0.11);
          color: #67e8f9;
          font-weight: 900;
        }

        .spinner {
          width: 44px;
          height: 44px;
          border: 4px solid rgba(148, 163, 184, 0.2);
          border-top-color: #67e8f9;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .dashboard {
          display: grid;
          gap: 20px;
        }

        .planTop {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          flex-wrap: wrap;
        }

        .planTitle {
          margin: 0;
          font-size: 24px;
          font-weight: 900;
          color: #e0f2fe;
        }

        .planSummary {
          margin: 8px 0 0;
          color: #94a3b8;
          line-height: 1.75;
          max-width: 700px;
        }

        .marketBiasCard {
          min-width: 200px;
          padding: 18px 16px;
          border-radius: 18px;
          background: rgba(8, 47, 73, 0.55);
          border: 1px solid rgba(34, 211, 238, 0.12);
          display: grid;
          gap: 8px;
          text-align: right;
        }

        .marketBiasCard span {
          color: #94a3b8;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .marketBiasCard strong {
          font-size: 20px;
          color: #dbeafe;
        }

        .overviewGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .overviewItem {
          padding: 18px;
          border-radius: 18px;
          background: rgba(8, 47, 73, 0.54);
          border: 1px solid rgba(148, 163, 184, 0.12);
        }

        .overviewItem.fullWidth {
          grid-column: span 2;
        }

        .overviewItem span {
          display: block;
          color: #94a3b8;
          font-size: 12px;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .overviewItem strong {
          display: block;
          color: #f8fafc;
          font-size: 16px;
          line-height: 1.5;
        }

        .watchlistSection {
          display: grid;
          gap: 14px;
        }

        .sectionSubheading {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .sectionSubheading span {
          color: #67e8f9;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .watchlistGrid {
          display: grid;
          gap: 12px;
        }

        .watchlistItem {
          padding: 16px;
          border-radius: 18px;
          background: rgba(5, 11, 24, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.12);
        }

        .watchlistHeader {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 10px;
        }

        .watchlistHeader .stockCode {
          margin: 0;
          font-size: 16px;
          font-weight: 900;
          color: #e0f2fe;
        }

        .watchlistHeader strong {
          color: #dbeafe;
        }

        .watchlistReason {
          margin: 0 0 8px;
          color: #cbd5e1;
          line-height: 1.6;
        }

        .stockGrid {
          display: grid;
          gap: 18px;
        }

        .stockCard {
          padding: 22px;
          border-radius: 22px;
          background: rgba(5, 11, 24, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.12);
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.18);
          display: grid;
          gap: 18px;
        }

        .stockCardHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .stockCode {
          margin: 0;
          font-size: 20px;
          font-weight: 900;
          color: #e0f2fe;
        }

        .stockName {
          margin: 6px 0 0;
          color: #94a3b8;
          font-size: 14px;
        }

        .statusGroup {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .trendLabel,
        .badge.recommendation {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .trendLabel.bullish {
          color: #bbf7d0;
          background: rgba(20, 184, 166, 0.18);
          border: 1px solid rgba(20, 184, 166, 0.28);
        }

        .trendLabel.bearish {
          color: #fecaca;
          background: rgba(239, 68, 68, 0.14);
          border: 1px solid rgba(239, 68, 68, 0.22);
        }

        .trendLabel.sideways {
          color: #bfdbfe;
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.2);
        }

        .trendLabel.rebound {
          color: #fff7cd;
          background: rgba(234, 179, 8, 0.14);
          border: 1px solid rgba(234, 179, 8, 0.24);
        }

        .trendLabel.neutral {
          color: #cbd5e1;
          background: rgba(148, 163, 184, 0.12);
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .badge.recommendation.buy {
          color: #0f766e;
          background: rgba(20, 184, 166, 0.16);
          border: 1px solid rgba(20, 184, 166, 0.24);
        }

        .badge.recommendation.hold {
          color: #1d4ed8;
          background: rgba(59, 130, 246, 0.16);
          border: 1px solid rgba(59, 130, 246, 0.24);
        }

        .badge.recommendation.sell {
          color: #b91c1c;
          background: rgba(248, 113, 113, 0.14);
          border: 1px solid rgba(248, 113, 113, 0.22);
        }

        .badge.recommendation.watchlist {
          color: #d97706;
          background: rgba(251, 191, 36, 0.14);
          border: 1px solid rgba(251, 191, 36, 0.22);
        }

        .stockMetrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .stockMetrics div,
        .confidenceGroup {
          display: grid;
          gap: 6px;
        }

        .stockMetrics span,
        .strategyGroup span {
          color: #94a3b8;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stockMetrics strong,
        .confidenceGroup strong {
          color: #f8fafc;
          font-size: 16px;
          line-height: 1.4;
        }

        .confidenceGroup {
          min-width: 180px;
        }

        .confidenceBar {
          width: 100%;
          height: 12px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.16);
          overflow: hidden;
        }

        .confidenceFill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #22d3ee, #5eead4);
        }

        .strategyGroup {
          display: grid;
          gap: 14px;
        }

        .strategyGroup div {
          display: grid;
          gap: 6px;
        }

        .strategyGroup strong {
          color: #f8fafc;
        }

        .strategyGroup p {
          margin: 0;
          color: #cbd5e1;
          line-height: 1.7;
        }

        .riskFooter {
          padding: 20px;
          border-radius: 18px;
          border: 1px solid rgba(250, 204, 21, 0.3);
          background: rgba(113, 63, 18, 0.18);
          color: #f8fafc;
        }

        .riskFooter strong {
          display: block;
          margin-bottom: 10px;
          color: #fde68a;
        }

        .sourceSection {
          padding-bottom: 36px;
        }

        .sourceCard {
          padding: 22px;
          border-radius: 22px;
          background: rgba(10, 18, 36, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.17);
        }

        .sourceCard strong {
          display: block;
          margin-bottom: 14px;
          font-size: 16px;
          color: #e0f2fe;
        }

        .sourceList {
          margin: 0;
          padding-left: 18px;
          color: #94a3b8;
          line-height: 1.8;
        }

        .sourceList li {
          margin-bottom: 10px;
        }

        .warningCard {
          margin-top: 36px;
          margin-bottom: 36px;
          padding: 20px 22px;
          border: 1px solid rgba(250, 204, 21, 0.23);
          border-radius: 16px;
          background: rgba(113, 63, 18, 0.18);
        }

        .warningCard strong {
          color: #fde68a;
        }

        .warningCard p {
          margin: 7px 0 0;
          color: #cbd5e1;
          line-height: 1.65;
        }

        .footer {
          border-top: 1px solid rgba(148, 163, 184, 0.13);
        }

        .footerContent {
          padding: 28px 0 40px;
          display: flex;
          justify-content: space-between;
          gap: 18px;
          color: #64748b;
        }

        .footerContent strong {
          color: #94a3b8;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 860px) {
          .heroGrid,
          .analysisGrid {
            grid-template-columns: 1fr;
          }

          .hero {
            padding-top: 54px;
          }

          .resultCard {
            min-height: 500px;
          }
        }

        @media (max-width: 700px) {
          .stockMetrics {
            grid-template-columns: 1fr;
          }

          .overviewGrid,
          .watchlistGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 580px) {
          .container {
            width: min(100% - 24px, 1160px);
          }

          .navbarContent {
            min-height: 66px;
            flex-direction: column;
            align-items: stretch;
          }

          .navButton {
            width: 100%;
          }

          .hero {
            padding: 44px 0 48px;
          }

          .hero h1 {
            font-size: 42px;
          }

          .heroContent > p {
            font-size: 16px;
          }

          .formCard,
          .resultCard,
          .heroCard,
          .sourceCard {
            padding: 20px;
            border-radius: 18px;
          }

          .riskOptions {
            grid-template-columns: 1fr;
          }

          .resultCard {
            min-height: 460px;
          }

          .resultState {
            min-height: 340px;
          }

          .footerContent {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
