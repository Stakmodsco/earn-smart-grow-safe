import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { email, recoveryKey, password } = await req.json();

    if (!email || !recoveryKey || !password) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: usersData, error: usersErr } = await sb.auth.admin.listUsers();

    if (usersErr) {
      return Response.json({ error: usersErr.message }, { status: 400 });
    }

    const user = usersData.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      return Response.json({ error: "Invalid email or recovery key" }, { status: 400 });
    }

    const cleanedKey = recoveryKey.replace(/\s/g, "").toUpperCase();
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(cleanedKey)
    );

    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: savedKey, error: keyErr } = await sb
      .from("user_recovery_keys")
      .select("id")
      .eq("user_id", user.id)
      .eq("recovery_key_hash", hash)
      .eq("used", false)
      .maybeSingle();

    if (keyErr || !savedKey) {
      return Response.json({ error: "Invalid or already used recovery key" }, { status: 400 });
    }

    const { error: updateErr } = await sb.auth.admin.updateUserById(user.id, {
      password,
    });

    if (updateErr) {
      return Response.json({ error: updateErr.message }, { status: 400 });
    }

    await sb
      .from("user_recovery_keys")
      .update({ used: true })
      .eq("id", savedKey.id);

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
});
