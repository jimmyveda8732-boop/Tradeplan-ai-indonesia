import { generateDailyPlan } from "@/lib/generate-daily-plan";

export const runtime = "nodejs";

let isGenerating = false;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  if (isGenerating) {
    return Response.json({ success: false, message: "Cron already running" }, { status: 409 });
  }

  isGenerating = true;

  try {
    const result = await generateDailyPlan();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal membuat dashboard pra-pasar",
      },
      { status: 500 }
    );
  } finally {
    isGenerating = false;
  }
}
