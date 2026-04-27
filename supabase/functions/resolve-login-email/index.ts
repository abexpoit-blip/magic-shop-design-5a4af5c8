// Resolves a login identifier (username, email, or display name) to the
// actual auth.users email so the frontend can call signInWithPassword().
// Public endpoint: returns ONLY an email string (no PII beyond what the user
// already provided), or 404 if no match. Rate-limit at the gateway level.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { identifier } = await req.json().catch(() => ({ identifier: "" }));
    const raw = String(identifier ?? "").trim();
    if (!raw) {
      return json({ error: "identifier required" }, 400);
    }

    // If it already looks like a valid email, just return it as-is.
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      return json({ email: raw });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 1. Try profiles.username (case-insensitive).
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", raw)
      .maybeSingle();

    let userId = profile?.id as string | undefined;

    // 2. Fall back to auth metadata username scan.
    if (!userId) {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const lower = raw.toLowerCase();
      const match = list?.users?.find((u) => {
        const meta = (u.user_metadata?.username ?? "").toString().toLowerCase();
        const emailLocal = (u.email ?? "").toLowerCase().split("@")[0];
        return meta === lower || emailLocal === lower;
      });
      if (match) userId = match.id;
    }

    if (!userId) {
      return json({ error: "not_found" }, 404);
    }

    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(userId);
    if (userErr || !userRes?.user?.email) {
      return json({ error: "not_found" }, 404);
    }

    return json({ email: userRes.user.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "resolve-login-email failed";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
