import { corsHeaders, json, getServiceClient, getUser, getSetting, todayUTC } from "../_shared/utils.ts";

const VALID = new Set(["watch", "spin"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const catalogId = String(body.catalog_id || "").trim();
    const taskType = String(body.task_type || "");
    if (!catalogId && !VALID.has(taskType)) return json({ error: "invalid task" }, 400);

    const svc = getServiceClient();
    const { data: profile } = await svc.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!profile) return json({ error: "profile not found" }, 404);
    if (profile.flagged) return json({ error: "account flagged" }, 403);
    if (catalogId) {
      const { data: task } = await svc.from("task_catalog").select("*").eq("id", catalogId).eq("active", true).maybeSingle();
      if (!task) return json({ error: "task not found" }, 404);
      if ((profile.level ?? 0) < Number(task.min_level ?? 1)) return json({ error: "upgrade required" }, 403);

      const { data: done } = await svc.from("task_completions").select("id").eq("user_id", user.id).eq("catalog_id", catalogId).maybeSingle();
      if (done) return json({ error: "task already completed" }, 409);

      const caps = (await getSetting(svc, "daily_earning_caps")) as Record<string, number>;
      const today = todayUTC();
      const sameDay = profile.daily_earned_date === today;
      const dailyEarned = sameDay ? Number(profile.daily_earned ?? 0) : 0;
      const allowed = Math.max(0, Number(caps[String(profile.level ?? 0)] ?? 0) - dailyEarned);
      const credit = Math.min(Number(task.reward ?? 0), allowed);
      if (credit <= 0) return json({ error: "daily earning cap reached" }, 429);

      const newBalance = Number(profile.balance) + credit;
      await svc.from("profiles").update({
        balance: newBalance,
        total_earnings: Number(profile.total_earnings) + credit,
        daily_earned: dailyEarned + credit,
        daily_earned_date: today,
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);
      await svc.from("task_completions").insert({ user_id: user.id, catalog_id: catalogId, reward: credit });
      await svc.from("transactions").insert({ user_id: user.id, type: "reward", amount: credit, status: "completed", notes: `catalog:${task.title}` });
      return json({ ok: true, reward: credit, balance: newBalance });
    }

    if ((profile.level ?? 0) < 1) return json({ error: "upgrade required" }, 403);

    const taskRewards = (await getSetting(svc, "task_rewards")) as Record<string, Record<string, number>>;
    const limits = (await getSetting(svc, "daily_task_limits")) as Record<string, number>;
    const caps = (await getSetting(svc, "daily_earning_caps")) as Record<string, number>;
    const lvl = String(profile.level);

    const reward = Number(taskRewards?.[taskType]?.[lvl] ?? 0);
    const dailyLimit = Number(limits?.[taskType] ?? 0);
    const cap = Number(caps?.[lvl] ?? 0);
    if (reward <= 0) return json({ error: "task not available for your level" }, 403);

    // Count completions today
    const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
    const { count } = await svc.from("tasks_log").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).eq("task_type", taskType).gte("completed_at", startOfDay.toISOString());
    if ((count ?? 0) >= dailyLimit) return json({ error: "daily task limit reached" }, 429);

    // 30-second cooldown anti-abuse
    const { data: last } = await svc.from("tasks_log").select("completed_at")
      .eq("user_id", user.id).eq("task_type", taskType)
      .order("completed_at", { ascending: false }).limit(1).maybeSingle();
    if (last) {
      const since = Date.now() - new Date(last.completed_at).getTime();
      if (since < 30_000) return json({ error: "cooldown", remaining_ms: 30_000 - since }, 429);
    }

    const today = todayUTC();
    const sameDay = profile.daily_earned_date === today;
    const dailyEarned = sameDay ? Number(profile.daily_earned ?? 0) : 0;
    const allowed = Math.max(0, cap - dailyEarned);
    const credit = Math.min(reward, allowed);
    if (credit <= 0) return json({ error: "daily earning cap reached" }, 429);

    const newBalance = Number(profile.balance) + credit;
    const newTotal = Number(profile.total_earnings) + credit;
    const newDaily = dailyEarned + credit;

    const { error: uErr } = await svc.from("profiles").update({
      balance: newBalance,
      total_earnings: newTotal,
      daily_earned: newDaily,
      daily_earned_date: today,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (uErr) return json({ error: uErr.message }, 500);

    await svc.from("tasks_log").insert({ user_id: user.id, task_type: taskType, reward: credit });
    await svc.from("transactions").insert({ user_id: user.id, type: "reward", amount: credit, status: "completed", notes: taskType });

    return json({ ok: true, reward: credit, balance: newBalance });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
