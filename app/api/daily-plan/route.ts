import { getLatestDailyPlan } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function getTodayDateInWIB() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

export async function GET() {
  try {
    const plan = await getLatestDailyPlan();

    if (!plan) {
      return Response.json(
        {
          success: false,
          status: "NOT_AVAILABLE",
          message: "Belum ada dashboard pra-pasar yang tersimpan.",
        },
        { status: 404 }
      );
    }

    const today = getTodayDateInWIB();
    const planDate = String(plan.plan_date ?? "");
    const status = planDate === today ? "TODAY" : "PREVIOUS_DAY";

    return Response.json({
      success: true,
      status,
      plan: plan.raw_plan ?? {},
      generatedAt: plan.generated_at ?? null,
      dataAsOf: plan.raw_plan?.dataAsOf ?? plan.raw_plan?.data_as_of ?? null,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        status: "NOT_AVAILABLE",
        message: error instanceof Error ? error.message : "Tidak dapat memuat dashboard pra-pasar",
      },
      { status: 500 }
    );
  }
}
