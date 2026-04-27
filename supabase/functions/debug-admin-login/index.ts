import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminEmail = Deno.env.get("ADMIN_EMAIL")!;
    const adminPassword = Deno.env.get("ADMIN_PASSWORD")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: loginData, error: loginError } = await authClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    if (loginError || !loginData.session || !loginData.user) {
      return json({
        loginOk: false,
        loginError: loginError?.message ?? "login failed",
      }, 200);
    }

    const functionRes = await fetch(`${supabaseUrl}/functions/v1/verify-admin-access`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginData.session.access_token}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    const functionBody = await functionRes.json().catch(() => ({}));

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: roleRows, error: rolesError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", loginData.user.id);

    return json({
      loginOk: true,
      userId: loginData.user.id,
      verifyStatus: functionRes.status,
      verifyResponse: functionBody,
      roles: (roleRows ?? []).map((row) => row.role),
      rolesError: rolesError?.message ?? null,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "debug-admin-login failed" }, 500);
  }
});