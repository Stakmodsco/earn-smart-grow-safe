import { corsHeaders, json, getServiceClient, getUser, getSetting, todayUTC } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const svc = getServiceClient();
    const { data: profile, error: pErr } = await svc.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (pErr || !profile) return json({ error: "profile not found" }, 404);
    if (profile.flagged) return json({ error: "account flagged" }, 403);

    // 24h check
    if (profile.last_checkin) {
      const last = new Date(profile.last_checkin).getTime();
      const elapsed = Date.now() - last;
      if (elapsed < 24 * 60 * 60 * 1000) {
        const remainingMs = 24 * 60 * 60 * 1000 - elapsed;
        return json({ error: "already checked in", remaining_ms: remainingMs }, 429);
      }
    }

    const rewards = (await getSetting(svc, "checkin_rewards")) as Record<string, number>;
    const caps = (await getSetting(svc, "daily_earning_caps")) as Record<string, number>;
    const lvl = String(profile.level ?? 0);
    const reward = Number(rewards[lvl] ?? 0);
    const cap = Number(caps[lvl] ?? 0);

    const today = todayUTC();
    const sameDay = profile.daily_earned_date === today;
    const dailyEarned = sameDay ? Number(profile.daily_earned ?? 0) : 0;
    const allowed = Math.max(0, cap - dailyEarned);
    const credit = Math.min(reward, allowed);

    if (credit <= 0) return json({ error: "daily cap reached" }, 429);

    const newBalance = Number(profile.balance) + credit;
    const newTotal = Number(profile.total_earnings) + credit;
    const newDaily = dailyEarned + credit;

    const { error: uErr } = await svc.from("profiles").update({
      balance: newBalance,
      total_earnings: newTotal,
      last_checkin: new Date().toISOString(),
      daily_earned: newDaily,
      daily_earned_date: today,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (uErr) return json({ error: uErr.message }, 500);

    await svc.from("tasks_log").insert({ user_id: user.id, task_type: "checkin", reward: credit });
    await svc.from("transactions").insert({ user_id: user.id, type: "checkin", amount: credit, status: "completed" });

    return json({ ok: true, reward: credit, balance: newBalance });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
