// Admin access is enforced server-side via the `user_roles` table and RLS.
// The frontend should rely solely on `roles.includes('admin')` from useAuth.
// This module is kept as a no-op shim for backwards compatibility.

export async function verifyAdminAccess(): Promise<boolean> {
  return false;
}
