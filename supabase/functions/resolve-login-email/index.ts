// Resolves a login identifier (username or email) to the actual auth.users
// email so the frontend can call signInWithPassword(). Hardened version:
// - Rejects callers without a valid SUPABASE anon apikey header (default).
// - Only consults the `profiles` table; never scans listUsers().
// - Returns a uniform 404 for any miss to avoid user enumeration timing.

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
    if (!raw || raw.length > 254) {
      return json({ error: "not_found" }, 404);
    }

    // If it already looks like a valid email, just return it as-is.
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      return json({ email: raw });
    }

    // Reject anything that doesn't look like a sane username to limit abuse.
    if (!/^[A-Za-z0-9._-]{2,64}$/.test(raw)) {
      return json({ error: "not_found" }, 404);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Only look up via profiles.username (case-insensitive). Do NOT fall back
    // to scanning auth.admin.listUsers — that enables full enumeration.
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", raw)
      .maybeSingle();

    if (!profile?.id) {
      return json({ error: "not_found" }, 404);
    }

    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(profile.id);
    if (userErr || !userRes?.user?.email) {
      return json({ error: "not_found" }, 404);
    }

    return json({ email: userRes.user.email });
  } catch {
    // Never leak internal error details — return uniform 404.
    return json({ error: "not_found" }, 404);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
