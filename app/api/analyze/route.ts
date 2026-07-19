import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const MODEL_NAME = "gemini-2.5-flash-lite";
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

type GeminiError = Error & {
  status?: number;
  code?: string;
};

type AnalyzeRequestBody = {
  modal: string;
  risk: string;
  tradingMode: string;
  images: Array<{ category: string; url: string; fileName: string }>;
};

function normalizeJsonResponse(text: string) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1] : text;
  const trimmed = candidate.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

async function downloadImageAsBase64(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gagal mengunduh gambar dari ${url}`);
  }

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  if (!ACCEPTED_IMAGE_TYPES.includes(contentType)) {
    throw new Error(`Tipe gambar tidak didukung: ${contentType}`);
  }

  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return { mimeType: contentType, base64 };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, message: "GEMINI_API_KEY belum terbaca." }, { status: 500 });
  }

  try {
    const body = (await request.json()) as AnalyzeRequestBody;
    const modal = String(body.modal ?? "0");
    const risk = String(body.risk ?? "Moderat");
    const tradingMode = String(body.tradingMode ?? "PAGI_SORE");
    const images = Array.isArray(body.images) ? body.images : [];

    if (!images.length) {
      return NextResponse.json({ success: false, message: "Minimal satu screenshot harus dikirim." }, { status: 400 });
    }

    const imageParts: GeminiPart[] = [];
    const failedImages: string[] = [];
    const downloadedCategories: string[] = [];

    for (const image of images) {
      if (!image.url || !image.category || !image.fileName) {
        failedImages.push(image.category ?? "kategori tidak dikenal");
        continue;
      }

      try {
        const { mimeType, base64 } = await downloadImageAsBase64(image.url);
        imageParts.push({ text: `Screenshot berikut adalah ${image.category}.` });
        imageParts.push({ inlineData: { mimeType, data: base64 } });
        downloadedCategories.push(image.category);
      } catch (error) {
        failedImages.push(image.category);
      }
    }

    if (!downloadedCategories.length) {
      return NextResponse.json(
        { success: false, message: "Tidak ada screenshot yang berhasil dibaca." },
        { status: 400 }
      );
    }

    if (!downloadedCategories.includes("IHSG")) {
      return NextResponse.json(
        { success: false, message: "IHSG wajib disertakan dan dapat dibaca." },
        { status: 400 }
      );
    }

    const labeledParts: GeminiPart[] = [];
    labeledParts.push({ text: `Modal pengguna: Rp${modal}. Profil risiko: ${risk}. Mode trading: ${tradingMode}.` });
    labeledParts.push({ text: "Baca hanya informasi yang terlihat di screenshot. Jangan mengarang angka atau harga yang tidak terlihat." });
    labeledParts.push({ text: "Balas hanya JSON murni tanpa markdown, tanpa penjelasan tambahan, dan gunakan Bahasa Indonesia singkat." });
    labeledParts.push(...imageParts);

    const modeInstructionsByMode: Record<string, string> = {
      SCALPING: `
- Prioritaskan top volume, frekuensi, likuiditas, spread, momentum, volume burst, foreign flow, dan saham yang muncul berulang.
- Hindari saham volume lemah atau hanya naik tanpa dukungan transaksi.
- Target relatif pendek dan validitas sinyal intraday singkat.
- Jika data order book atau chart intraday tidak ada, turunkan skor.
- Jangan mengarang spread atau VWAP jika tidak terlihat.
- Gunakan bobot scoring: likuiditas dan volume 25, momentum 20, foreign/broker flow 15, kemunculan di beberapa kategori 15, kondisi IHSG dan sektor 10, kejelasan entry dan stop 15.
`,
      PAGI_SORE: `
- Prioritaskan saham yang kuat setelah pembukaan.
- Gunakan IHSG, top volume, top gainer, foreign buy, dan kekuatan sektor.
- Hindari membeli saham yang sudah terlalu jauh dari entry.
- Holding period satu hari.
- Sinyal harus memiliki batas waktu.
- Jika momentum melemah, berikan tradeStatus NO TRADE.
- Gunakan bobot scoring: momentum 25, likuiditas dan volume 20, foreign flow 15, IHSG dan sektor 15, kemunculan di beberapa kategori 10, kejelasan entry dan stop 15.
`,
      SORE_PAGI: `
- Filter paling ketat karena ada risiko overnight.
- Prioritaskan saham yang ditutup kuat, volume tinggi, foreign accumulation, dan tidak dekat resistance besar.
- Gunakan ukuran posisi lebih kecil.
- Harus memiliki kondisi pembatalan.
- Jika data tidak cukup untuk menilai risiko overnight, berikan tradeStatus NO TRADE.
- Gunakan bobot scoring: struktur penutupan 25, volume 20, foreign flow 15, support dan resistance 15, sentimen 10, risk/reward 15.
`,
      SWING: `
- Target profit 2 sampai 7 persen.
- Prioritaskan tren harian, breakout atau pullback sehat, volume, relative strength, support-resistance, dan foreign flow.
- Holding period beberapa hari.
- Risk/reward minimal 1:1.5.
- Bila risk/reward buruk, berikan tradeStatus NO TRADE.
- Gunakan bobot scoring: struktur tren 20, volume 15, support-resistance 15, relative strength 15, foreign flow 10, sentimen 10, risk/reward 15.
`,
    };

    const modeInstructions = modeInstructionsByMode[tradingMode] ?? `
- Prioritaskan saham yang kuat sesuai mode trading yang dipilih.
- Gunakan bobot scoring yang sesuai dengan gaya trading.
`;

    labeledParts.push({
      text: `Instruksi:
- Baca kondisi IHSG.
- Deteksi saham yang muncul berulang di beberapa kategori.
- Identifikasi saham dengan volume kuat.
- Identifikasi akumulasi atau distribusi asing.
- Hindari saham yang hanya masuk top gainer tetapi volume lemah.
- Pilih maksimal 10 kandidat dan maksimal 5 prioritas utama.
- Jika support, stop loss, entry, atau target tidak cukup datanya, tulis "Perlu chart saham".
- Gunakan Bahasa Indonesia singkat.
- Hasil marketOverview harus berisi ihsgCondition, marketSentiment, foreignFlow, strongestSignal, caution.
- Hasil watchlist harus berisi kode, score, categoryMatches, reason.
- Hasil stocks harus berisi code, name, trend, recommendation, currentPrice, support, resistance, entry, stopLoss, takeProfit1, takeProfit2, setupScore, tradeStatus, priority, validUntil, holdingPeriod, riskReward, maxRiskPercent, estimatedLots, estimatedPositionValue, estimatedMaxLoss, cancellationCondition, dataCompleteness, strategy, reason.
- Tentukan setupScore dari 0 sampai 100.
- Klasifikasikan priority: 85-100 => PRIORITAS, 75-84 => BUY BERSYARAT, 65-74 => WATCHLIST, di bawah 65 => HINDARI atau NO TRADE.
- Hard filter NO TRADE jika IHSG sangat lemah, data screenshot tidak cukup, entry sudah terlewat, stop loss tidak dapat ditentukan, risk/reward buruk, volume tidak mendukung, data saling bertentangan, saham tidak cukup likuid, terlalu dekat resistance, atau risiko overnight terlalu tinggi.
- Gunakan modal pengguna dan profil risiko untuk menghitung posisi: konservatif sekitar 0.5% modal per posisi, moderat sekitar 1%, agresif sekitar 1.5%. Jangan melebihi modal. Jumlah lot harus bilangan bulat. Jika harga atau stop loss tidak dapat ditentukan, estimatedLots harus 0 dan tradeStatus NO TRADE.
- Jangan menjanjikan win rate, jangan menulis probabilitas pasti menang. Gunakan istilah Setup Score, Kelengkapan Data, dan Kualitas Konfirmasi.
- ${modeInstructions}
`,
    });

    const ai = new GoogleGenAI({ apiKey });
    console.info("[analyze] request received", {
      model: MODEL_NAME,
      imageCount: downloadedCategories.length,
      images: images.map((image) => ({ category: image.category, url: image.url, fileName: image.fileName })),
      failedImages,
    });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: "user",
          parts: labeledParts,
        },
      ],
    });

    const rawText = response.text ?? "";
    if (!rawText) {
      throw new Error("Gemini tidak menghasilkan data analisis.");
    }

    const cleanedText = normalizeJsonResponse(rawText);
    let plan: unknown;
    try {
      plan = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("[analyze] invalid JSON from Gemini", { stage: "parse", model: MODEL_NAME });
      throw new Error("Respons Gemini bukan JSON yang valid.");
    }

    if (!plan || typeof plan !== "object" || !Array.isArray((plan as { stocks?: unknown }).stocks) || (plan as { stocks: unknown[] }).stocks.length === 0) {
      throw new Error("Tidak ada saham yang berhasil terdeteksi.");
    }

    return NextResponse.json({ success: true, totalImages: images.length, plan });
  } catch (error) {
    const details =
      typeof error === "object" && error !== null && "status" in error
        ? (error as GeminiError).status
        : typeof error === "object" && error !== null && "code" in error
          ? (error as GeminiError).code
          : undefined;

    console.error("[analyze] request failed", {
      stage: "analyze",
      message: error instanceof Error ? error.message : "Unknown error",
      details,
    });

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan saat membuat analisis.",
        details,
      },
      { status: 500 }
    );
  }
}
