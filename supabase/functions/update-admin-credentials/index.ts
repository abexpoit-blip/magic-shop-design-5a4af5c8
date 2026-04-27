// Securely updates ADMIN_EMAIL / ADMIN_USERNAME / ADMIN_PASSWORD secrets and
// reconciles the live admin auth user. Caller MUST already be an admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  email?: string;
  username?: string;
  password?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROJECT_REF = (SUPABASE_URL.match(/https?:\/\/([^.]+)\./) ?? [])[1] ?? "";
const SUPABASE_ACCESS_TOKEN = Deno.env.get("SUPABASE_ACCESS_TOKEN") ?? "";

async function setSecret(name: string, value: string) {
  if (!SUPABASE_ACCESS_TOKEN || !PROJECT_REF) return false;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/secrets`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ name, value }]),
    },
  );
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate caller from the Authorization header.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Verify caller is admin via user_roles.
    const { data: roleRows, error: rolesErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");
    if (rolesErr || !roleRows || roleRows.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = (await req.json().catch(() => ({}))) as Payload;
    const newEmail = body.email?.trim().toLowerCase();
    const newUsername = body.username?.trim();
    const newPassword = body.password?.trim();

    if (!newEmail && !newUsername && !newPassword) {
      return new Response(JSON.stringify({ error: "Nothing to update" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const currentEmail = Deno.env.get("ADMIN_EMAIL");
    const currentUsername = Deno.env.get("ADMIN_USERNAME");

    const finalEmail = newEmail ?? currentEmail!;
    const finalUsername = newUsername ?? currentUsername!;

    // Update the live admin auth user (the caller).
    const updates: Record<string, unknown> = {
      email: finalEmail,
      email_confirm: true,
      user_metadata: { username: finalUsername },
    };
    if (newPassword) updates.password = newPassword;

    const { error: updErr } = await admin.auth.admin.updateUserById(user.id, updates);
    if (updErr) throw updErr;

    // Sync profile username.
    await admin.from("profiles").update({ username: finalUsername, display_name: finalUsername })
      .eq("id", user.id);

    // Update Supabase project secrets so bootstrap-admin stays consistent.
    const secretResults: Record<string, boolean> = {};
    if (newEmail) secretResults.ADMIN_EMAIL = await setSecret("ADMIN_EMAIL", newEmail);
    if (newUsername) secretResults.ADMIN_USERNAME = await setSecret("ADMIN_USERNAME", newUsername);
    if (newPassword) secretResults.ADMIN_PASSWORD = await setSecret("ADMIN_PASSWORD", newPassword);

    const secretsSynced = Object.values(secretResults).every(Boolean);

    return new Response(JSON.stringify({
      ok: true,
      secrets_synced: secretsSynced,
      note: secretsSynced
        ? "Credentials updated and secrets synced."
        : "Credentials updated for the live admin user. Update the ADMIN_* secrets manually from project settings to keep bootstrap-admin in sync.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
