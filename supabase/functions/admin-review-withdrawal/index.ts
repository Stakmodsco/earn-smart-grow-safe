import { corsHeaders, json, getServiceClient, getUser, isAdmin } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    const svc = getServiceClient();
    if (!(await isAdmin(svc, user.id))) return json({ error: "forbidden" }, 403);

    const { withdrawal_id, action, notes } = await req.json();
    if (!withdrawal_id || !["complete", "reject"].includes(action)) return json({ error: "invalid input" }, 400);

    const { data: w } = await svc.from("withdrawals").select("*").eq("id", withdrawal_id).maybeSingle();
    if (!w) return json({ error: "not found" }, 404);
    if (w.status !== "pending") return json({ error: "already processed" }, 409);

    const { data: profile } = await svc.from("profiles").select("*").eq("id", w.user_id).maybeSingle();
    if (!profile) return json({ error: "user not found" }, 404);

    if (action === "reject") {
      // refund locked -> available
      await svc.from("profiles").update({
        balance: Number(profile.balance) + Number(w.amount),
        locked_balance: Math.max(0, Number(profile.locked_balance) - Number(w.amount)),
        updated_at: new Date().toISOString(),
      }).eq("id", w.user_id);
      await svc.from("withdrawals").update({
        status: "rejected", processed_at: new Date().toISOString(), reviewed_by: user.id, notes,
      }).eq("id", withdrawal_id);
      await svc.from("transactions").update({ status: "rejected" }).eq("notes", w.id).eq("type", "withdrawal");
      return json({ ok: true });
    }

    // complete: drop locked
    await svc.from("profiles").update({
      locked_balance: Math.max(0, Number(profile.locked_balance) - Number(w.amount)),
      updated_at: new Date().toISOString(),
    }).eq("id", w.user_id);
    await svc.from("withdrawals").update({
      status: "completed", processed_at: new Date().toISOString(), reviewed_by: user.id, notes,
    }).eq("id", withdrawal_id);
    await svc.from("transactions").update({ status: "completed" }).eq("notes", w.id).eq("type", "withdrawal");

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
