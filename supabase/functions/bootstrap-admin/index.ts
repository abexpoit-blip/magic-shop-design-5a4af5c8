// Bootstrap admin: idempotently provisions the admin account from secrets.
// Safe to call repeatedly. Requires no auth — uses service role internally.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
    const ADMIN_USERNAME = Deno.env.get("ADMIN_USERNAME");
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ADMIN_EMAIL || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "Missing ADMIN_* secrets" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // 1) Find or create the auth user.
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    if (found) {
      userId = found.id;
      // Reset password & confirm email to keep it consistent with the secret.
      await admin.auth.admin.updateUserById(userId, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { username: ADMIN_USERNAME },
      });
    } else {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { username: ADMIN_USERNAME },
      });
      if (cErr) throw cErr;
      userId = created.user!.id;
    }

    // 2) Ensure profile (handle_new_user trigger may have done it).
    await admin.from("profiles").upsert({
      id: userId,
      username: ADMIN_USERNAME,
      display_name: ADMIN_USERNAME,
      seller_display_name: "Cruzer Admin",
      is_seller: true,
      is_seller_verified: true,
      is_seller_visible: true,
      trust_tier: "vip",
      seller_status: "approved",
    }, { onConflict: "id" });

    // 3) Grant admin + seller + user roles (unique constraint on user_id+role makes this safe).
    for (const role of ["admin", "seller", "user"]) {
      await admin.from("user_roles").upsert(
        { user_id: userId, role },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, email: ADMIN_EMAIL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bootstrap failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
