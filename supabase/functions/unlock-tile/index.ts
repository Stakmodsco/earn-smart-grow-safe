// Unlocks a premium activity tile by deducting a small fee from the
// user's main balance. Tier-based free unlocks are handled client-side.
import { corsHeaders, json, getServiceClient, getUser, getSetting } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const tileId = String(body.tile_id || "");
    if (!tileId) return json({ error: "tile_id required" }, 400);

    const svc = getServiceClient();

    const { data: profile } = await svc.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!profile) return json({ error: "profile not found" }, 404);
    if (profile.flagged) return json({ error: "account flagged" }, 403);

    // Already unlocked?
    const { data: existing } = await svc.from("tile_unlocks")
      .select("id").eq("user_id", user.id).eq("tile_id", tileId).maybeSingle();
    if (existing) return json({ ok: true, already: true });

    // Tier-based free unlock?
    const tierMap = (await getSetting(svc, "tier_tile_unlocks")) as Record<string, string[]> | null;
    const free = tierMap?.[String(profile.level)] ?? [];
    if (free.includes(tileId)) {
      await svc.from("tile_unlocks").insert({ user_id: user.id, tile_id: tileId, fee_paid: 0 });
      return json({ ok: true, free: true });
    }

    // Otherwise charge the fee from balance
    const fees = (await getSetting(svc, "tile_unlock_fees")) as Record<string, number> | null;
    const fee = Number(fees?.[tileId] ?? 0);
    if (fee <= 0) return json({ error: "tile not unlockable" }, 400);

    if (Number(profile.balance) < fee) {
      return json({ error: `insufficient balance — need $${fee.toFixed(2)}` }, 402);
    }

    const newBalance = Number(profile.balance) - fee;
    const { error: uErr } = await svc.from("profiles")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (uErr) return json({ error: uErr.message }, 500);

    await svc.from("tile_unlocks").insert({ user_id: user.id, tile_id: tileId, fee_paid: fee });
    await svc.from("transactions").insert({
      user_id: user.id, type: "reward", amount: -fee, status: "completed",
      notes: `tile_unlock:${tileId}`,
    });

    return json({ ok: true, fee, balance: newBalance });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
