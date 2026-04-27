import { supabase } from "@/integrations/supabase/client";

export const PRIMARY_ADMIN_EMAIL = "samexpoit@gmail.com";

interface VerifyAdminAccessOptions {
  accessToken?: string | null;
  refreshToken?: string | null;
  email?: string | null;
}

// Simplified: admin access is granted purely by matching the primary admin email.
// No edge function calls, no role table lookups, no token verification.
export async function verifyAdminAccess(
  _userId: string,
  options: VerifyAdminAccessOptions = {},
): Promise<boolean> {
  let email = options.email?.toLowerCase() ?? null;
  if (!email) {
    try {
      const { data } = await supabase.auth.getUser();
      email = data.user?.email?.toLowerCase() ?? null;
    } catch {
      // ignore
    }
  }
  return email === PRIMARY_ADMIN_EMAIL;
}
