import { GoogleGenAI } from "@google/genai";
import { getLatestDailyPlan, getLatestMarketUploads, saveDailyPlan } from "./supabase-admin";

const MAX_WATCHLIST_ITEMS = 10;
const MAX_PRIORITY_STOCKS = 5;

const dailyPlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    planDate: { type: "string" },
    planType: { type: "string" },
    dataAsOf: { type: "string" },
    marketBias: { type: "string" },
    summary: { type: "string" },
    marketOverview: {
      type: "object",
      additionalProperties: false,
      properties: {
        ihsgCondition: { type: "string" },
        overnightSentiment: { type: "string" },
        globalMarketSentiment: { type: "string" },
        foreignFlow: { type: "string" },
        strongestSector: { type: "string" },
        caution: { type: "string" },
      },
      required: ["ihsgCondition", "overnightSentiment", "globalMarketSentiment", "foreignFlow", "strongestSector", "caution"],
    },
    watchlist: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string" },
          score: { type: ["string", "number"] },
          categoryMatches: { type: "array", items: { type: "string" } },
          reason: { type: "string" },
        },
        required: ["code", "score", "categoryMatches", "reason"],
      },
    },
    stocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string" },
          name: { type: "string" },
          trend: { type: "string" },
          recommendation: { type: "string" },
          setupScore: { type: "integer", minimum: 0, maximum: 100 },
          tradeStatus: { type: "string", enum: ["TRADE", "NO TRADE"] },
          priority: { type: "string", enum: ["PRIORITAS", "BUY BERSYARAT", "WATCHLIST", "HINDARI"] },
          currentPrice: { type: "string" },
          support: { type: "string" },
          resistance: { type: "string" },
          entry: { type: "string" },
          stopLoss: { type: "string" },
          takeProfit1: { type: "string" },
          takeProfit2: { type: "string" },
          riskReward: { type: "string" },
          holdingPeriod: { type: "string" },
          validUntil: { type: "string" },
          estimatedLots: { type: "integer", minimum: 0 },
          estimatedPositionValue: { type: "string" },
          estimatedMaxLoss: { type: "string" },
          strategy: { type: "string" },
          cancellationCondition: { type: "string" },
          dataCompleteness: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
        },
        required: [
          "code",
          "name",
          "trend",
          "recommendation",
          "setupScore",
          "tradeStatus",
          "priority",
          "currentPrice",
          "support",
          "resistance",
          "entry",
          "stopLoss",
          "takeProfit1",
          "takeProfit2",
          "riskReward",
          "holdingPeriod",
          "validUntil",
          "estimatedLots",
          "estimatedPositionValue",
          "estimatedMaxLoss",
          "strategy",
          "cancellationCondition",
          "dataCompleteness",
          "reason",
        ],
      },
    },
    riskWarning: { type: "string" },
  },
  required: ["title", "planDate", "planType", "dataAsOf", "marketBias", "summary", "marketOverview", "watchlist", "stocks", "riskWarning"],
};

function getDateInWIB(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function summarizeUploads(uploads: Array<Record<string, unknown>>) {
  if (!uploads.length) {
    return "Belum ada upload pasar terbaru tersimpan.";
  }

  return uploads
    .map((upload) => {
      const category = String(upload.category ?? "");
      const extractedData = upload.extractedData as Record<string, unknown> | undefined;
      const fileName = extractedData && typeof extractedData === "object" ? String((extractedData as Record<string, unknown>).fileName ?? "") : "";
      return `- ${category}: ${fileName || "data tersimpan"}`;
    })
    .join("\n");
}

export async function generateDailyPlan() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi.");
  }

  const latestUploads = await getLatestMarketUploads();
  const previousPlan = await getLatestDailyPlan();
  const planDate = getDateInWIB(new Date());
  const defaultModal = process.env.DEFAULT_MODAL ?? "10000000";
  const defaultRisk = process.env.DEFAULT_RISK ?? "Moderat";
  const defaultTradingMode = process.env.DEFAULT_TRADING_MODE ?? "PAGI_SORE";

  const previousPlanSummary = previousPlan?.raw_plan
    ? JSON.stringify(previousPlan.raw_plan).slice(0, 2500)
    : "Belum ada dashboard pra-pasar sebelumnya.";

  const promptParts = [
    {
      text: `Kamu adalah asisten trading pra-pasar untuk pasar saham Indonesia. Buat dashboard pra-pembukaan untuk tanggal ${planDate}.`,
    },
    {
      text: `Gunakan data penutupan hari sebelumnya, data upload pasar terbaru, berita dan sentimen semalam bila tersedia, serta data historis yang tersedia. Jangan menyebutnya sebagai data live hari ini jika sebenarnya berasal dari penutupan sebelumnya.`,
    },
    {
      text: `Konfigurasi default: modal Rp${defaultModal}, profil risiko ${defaultRisk}, mode trading ${defaultTradingMode}.`,
    },
    {
      text: `Upload pasar terbaru yang tersedia:\n${summarizeUploads(latestUploads)}`,
    },
    {
      text: `Dashboard sebelumnya yang tersedia:\n${previousPlanSummary}`,
    },
    {
      text: `Aturan penting:\n- Jangan mengarang angka. Jika chart atau harga tidak tersedia, gunakan "Perlu chart saham".\n- Jika stop loss tidak bisa dihitung, tradeStatus harus NO TRADE.\n- Setup Score bukan jaminan profit.\n- Dashboard 08.30 harus diberi label PRA-PEMBUKAAN.\n- dataAsOf harus menjelaskan tanggal data terakhir.\n- Maksimal 10 watchlist dan 5 saham prioritas.\n- Gunakan Bahasa Indonesia singkat.\n- Jangan menjanjikan win rate.\n- Jangan melakukan transaksi otomatis.\n- Hasil JSON harus konsisten dengan schema yang diberikan.`,
    },
  ];

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      {
        role: "user",
        parts: promptParts,
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: dailyPlanSchema,
    },
  });

  if (!response.text) {
    throw new Error("Gemini tidak menghasilkan dashboard pra-pasar.");
  }

  const plan = JSON.parse(response.text);
  const normalizedPlan = {
    ...plan,
    planDate,
    planType: "PREMARKET",
    marketSession: "PREMARKET",
    dataAsOf: plan.dataAsOf || `Data terakhir tersedia sampai ${planDate}`,
    marketOverview: {
      ihsgCondition: plan.marketOverview?.ihsgCondition ?? "Perlu data IHSG",
      overnightSentiment: plan.marketOverview?.overnightSentiment ?? "Perlu sentimen semalam",
      globalMarketSentiment: plan.marketOverview?.globalMarketSentiment ?? "Perlu sentimen global",
      foreignFlow: plan.marketOverview?.foreignFlow ?? "Perlu data arus asing",
      strongestSector: plan.marketOverview?.strongestSector ?? "Perlu sektor kuat",
      caution: plan.marketOverview?.caution ?? "Perlu konfirmasi lebih lanjut",
    },
    watchlist: Array.isArray(plan.watchlist) ? plan.watchlist.slice(0, MAX_WATCHLIST_ITEMS) : [],
    stocks: Array.isArray(plan.stocks) ? plan.stocks.slice(0, MAX_PRIORITY_STOCKS) : [],
    riskWarning: plan.riskWarning || "Periksa data secara mandiri sebelum mengambil keputusan.",
    sourceStatus: {
      uploadsCount: latestUploads.length,
      hasPreviousPlan: Boolean(previousPlan),
      generatedFrom: "supabase-and-gemini",
    },
  };

  const savedPlan = await saveDailyPlan(normalizedPlan);

  return {
    success: true,
    plan: normalizedPlan,
    saved: Boolean(savedPlan),
  };
}
