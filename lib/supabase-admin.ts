import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return client;
}

export async function saveDailyPlan(plan: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return null;
  }

  const planDate = String(plan.planDate ?? "");
  if (!planDate) {
    return null;
  }

  const payload = {
    plan_date: planDate,
    plan_type: plan.planType ?? "PREMARKET",
    generated_at: new Date().toISOString(),
    market_session: plan.marketSession ?? "PREMARKET",
    source_status: plan.sourceStatus ?? {},
    market_overview: plan.marketOverview ?? {},
    watchlist: plan.watchlist ?? [],
    stocks: plan.stocks ?? [],
    risk_warning: plan.riskWarning ?? "",
    raw_plan: plan,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("daily_trading_plans")
    .upsert(payload, { onConflict: "plan_date" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveMarketUpload(upload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return null;
  }

  const tradingDate = String(upload.tradingDate ?? "");
  const category = String(upload.category ?? "");

  if (!tradingDate || !category) {
    return null;
  }

  const payload = {
    trading_date: tradingDate,
    category,
    extracted_data: upload.extractedData ?? {},
    uploaded_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("market_uploads")
    .upsert(payload, { onConflict: "trading_date,category" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getLatestDailyPlan() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("daily_trading_plans")
    .select("*")
    .order("plan_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getLatestMarketUploads() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("market_uploads")
    .select("*")
    .order("trading_date", { ascending: false })
    .order("uploaded_at", { ascending: false });

  if (error) {
    throw error;
  }

  const latestByCategory = new Map<string, Record<string, unknown>>();
  for (const item of data ?? []) {
    const category = String(item.category ?? "");
    if (category && !latestByCategory.has(category)) {
      latestByCategory.set(category, item as Record<string, unknown>);
    }
  }

  return Array.from(latestByCategory.values());
}
