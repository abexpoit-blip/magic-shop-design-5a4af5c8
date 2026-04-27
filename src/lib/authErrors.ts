// Friendly mapping for Supabase auth / DB errors so login screens can show
// clearer copy when the backend is degraded (e.g. 503 from the auth API or
// "Database error querying schema" during role lookups).

export interface FriendlyAuthError {
  title: string;
  hint?: string;
}

export function isTransientAuthServiceError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const msg = raw.toLowerCase();

  return (
    msg.includes("503") ||
    msg.includes("500") ||
    msg.includes("service unavailable") ||
    msg.includes("database error") ||
    msg.includes("querying schema") ||
    msg.includes("unexpected eof") ||
    msg.includes("upstream") ||
    msg.includes("bad gateway") ||
    msg.includes("502")
  );
}

export function describeAuthError(err: unknown): FriendlyAuthError {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const msg = raw.toLowerCase();

  // Backend / database outage signals
  if (isTransientAuthServiceError(err)) {
    return {
      title: "Login is temporarily unavailable",
      hint: "The backend could not verify your account just now. Wait 10–30 seconds and try again — your role has not been changed.",
    };
  }

  // Network / offline
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network error")) {
    return {
      title: "Can't reach the authentication server",
      hint: "Check your internet connection, then retry.",
    };
  }

  // Bad credentials
  if (msg.includes("invalid login") || msg.includes("invalid credentials") || msg.includes("invalid_grant")) {
    return {
      title: "Email or password is incorrect",
      hint: "Double-check your credentials. Caps lock?",
    };
  }

  if (msg.includes("email not confirmed")) {
    return { title: "Email not confirmed", hint: "Check your inbox for the verification link." };
  }

  if (msg.includes("rate limit") || msg.includes("too many")) {
    return { title: "Too many attempts", hint: "Please wait a minute before trying again." };
  }

  return { title: raw || "Login failed" };
}
