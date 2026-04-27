import { supabase } from "@/integrations/supabase/client";

type RoleRow = { role: string };
const ADMIN_EMAIL = "samexpoit@gmail.com";

export async function verifyAdminAccess(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (!error) {
    return ((data as RoleRow[] | null) ?? []).some((row) => row.role === "admin");
  }

  const { data: fallback, error: fallbackError } = await supabase.functions.invoke("verify-admin-access", {
    body: {},
  });

  if (fallbackError) {
    const { data: authUser } = await supabase.auth.getUser();
    const email = authUser.user?.email?.toLowerCase();
    if (email === ADMIN_EMAIL) {
      return true;
    }
    throw fallbackError;
  }

  return Boolean((fallback as { isAdmin?: boolean } | null)?.isAdmin);
}