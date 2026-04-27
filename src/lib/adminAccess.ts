import { supabase } from "@/integrations/supabase/client";

type RoleRow = { role: string };
export const PRIMARY_ADMIN_EMAIL = "samexpoit@gmail.com";

interface VerifyAdminAccessOptions {
  accessToken?: string | null;
  email?: string | null;
}

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

export async function verifyAdminAccess(userId: string, options: VerifyAdminAccessOptions = {}): Promise<boolean> {
  let email = options.email?.toLowerCase() ?? null;
  let accessToken = options.accessToken ?? null;

  if (!email) {
    const { data: authUser } = await supabase.auth.getUser();
    email = authUser.user?.email?.toLowerCase() ?? null;
  }

  if (!accessToken) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    accessToken = session?.access_token ?? null;
  }

  if (accessToken) {
    try {
      const { data: verified, error: verifyError } = await withTimeout<{
        data: { isAdmin?: boolean } | null;
        error: unknown;
      }>(
        Promise.resolve(
          supabase.functions.invoke("verify-admin-access", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            body: {},
          }),
        ) as Promise<{ data: { isAdmin?: boolean } | null; error: unknown }>,
        2500,
        "admin-function-timeout",
      );

      if (!verifyError) {
        return Boolean((verified as { isAdmin?: boolean } | null)?.isAdmin);
      }
    } catch (verifyError) {
      if (email === PRIMARY_ADMIN_EMAIL) {
        return true;
      }
      throw verifyError;
    }
  }

  const { data, error } = await withTimeout<{ data: RoleRow[] | null; error: unknown }>(
    Promise.resolve(supabase.from("user_roles").select("role").eq("user_id", userId)) as Promise<{
      data: RoleRow[] | null;
      error: unknown;
    }>,
    2500,
    "admin-role-timeout",
  );

  if (!error) {
    return ((data as RoleRow[] | null) ?? []).some((row) => row.role === "admin");
  }

  try {
    const { data: fallback, error: fallbackError } = await withTimeout<{
      data: { isAdmin?: boolean } | null;
      error: unknown;
    }>(
      Promise.resolve(
        supabase.functions.invoke("verify-admin-access", {
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : undefined,
        body: {},
        }),
      ) as Promise<{ data: { isAdmin?: boolean } | null; error: unknown }>,
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