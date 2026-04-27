import { supabase } from "@/integrations/supabase/client";

type RoleRow = { role: string };
export const PRIMARY_ADMIN_EMAIL = "samexpoit@gmail.com";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function verifyAdminAccess(userId: string): Promise<boolean> {
  const { data: authUser } = await supabase.auth.getUser();
  const email = authUser.user?.email?.toLowerCase();

  const { data, error } = await withTimeout(
    supabase.from("user_roles").select("role").eq("user_id", userId),
    2500,
    "admin-role-timeout",
  );

  if (!error) {
    return ((data as RoleRow[] | null) ?? []).some((row) => row.role === "admin");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  try {
    const { data: fallback, error: fallbackError } = await withTimeout(
      supabase.functions.invoke("verify-admin-access", {
        headers: session?.access_token
          ? {
              Authorization: `Bearer ${session.access_token}`,
            }
          : undefined,
        body: {},
      }),
      2500,
      "admin-function-timeout",
    );

    if (fallbackError) {
      if (email === PRIMARY_ADMIN_EMAIL) {
        return true;
      }
      throw fallbackError;
    }

    return Boolean((fallback as { isAdmin?: boolean } | null)?.isAdmin);
  } catch (fallbackError) {
    if (email === PRIMARY_ADMIN_EMAIL) {
      return true;
    }
    throw fallbackError;
  }
}