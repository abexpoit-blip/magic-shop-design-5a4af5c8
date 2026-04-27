// Bootstrap admin: idempotently provisions the admin account from secrets.
// Requires either:
//   - A valid admin JWT (Authorization: Bearer <token> belonging to a user
//     who already has the `admin` role in user_roles), OR
//   - A shared bootstrap token in the X-Bootstrap-Token header that matches
//     the BOOTSTRAP_ADMIN_TOKEN secret (used for first-time provisioning).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bootstrap-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
    const ADMIN_USERNAME = Deno.env.get("ADMIN_USERNAME");
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    const BOOTSTRAP_TOKEN = Deno.env.get("BOOTSTRAP_ADMIN_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!ADMIN_EMAIL || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return json({ error: "Missing ADMIN_* secrets" }, 400);
    }

    // ---- Authorization: admin JWT or shared bootstrap token ----
    let authorized = false;

    const sharedToken = req.headers.get("x-bootstrap-token");
    if (BOOTSTRAP_TOKEN && sharedToken && sharedToken === BOOTSTRAP_TOKEN) {
      authorized = true;
    }

    if (!authorized) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (jwt) {
        const userClient = createClient(SUPABASE_URL, ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
          auth: { persistSession: false },
        });
        const { data: ures } = await userClient.auth.getUser();
        const uid = ures?.user?.id;
        if (uid) {
          const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
            auth: { persistSession: false },
          });
          const { data: roleRow } = await sb
            .from("user_roles")
            .select("role")
            .eq("user_id", uid)
            .eq("role", "admin")
            .maybeSingle();
          if (roleRow) authorized = true;
        }
      }
    }

    if (!authorized) {
      return json({ error: "unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // 1) Find or create the auth user.
    let userId: string | null = null;
    let { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let found = list?.users?.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    if (!found) {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { username: ADMIN_USERNAME },
      });

      if (cErr) {
        const message = cErr.message?.toLowerCase?.() ?? "";
        if (!message.includes("already been registered")) {
          throw cErr;
        }
        const retry = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        list = retry.data;
        found = list?.users?.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
        if (!found) throw cErr;
      } else {
        found = created.user ?? null;
      }
    }

    if (!found) {
      throw new Error("Admin account could not be located or created");
    }

    userId = found.id;
    await admin.auth.admin.updateUserById(userId, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { username: ADMIN_USERNAME },
    });

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

    for (const role of ["admin", "seller", "user"]) {
      await admin.from("user_roles").upsert(
        { user_id: userId, role },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    }

    // Do NOT leak the admin email in the success body.
    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bootstrap failed";
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
