export type AppRole = "viewer" | "editor" | "superadmin";

function list(name: string) {
  return (process.env[name] || "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

export function getRoleForEmail(email?: string | null): AppRole {
  const normalized = (email || "").trim().toLowerCase();

  if (list("SUPERADMIN_EMAILS").includes(normalized)) return "superadmin";
  if (list("EDITOR_EMAILS").includes(normalized)) return "editor";
  return "viewer";
}

export function isAllowedEmail(email?: string | null) {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return false;

  const explicitlyAllowed = new Set([
    ...list("SUPERADMIN_EMAILS"),
    ...list("EDITOR_EMAILS"),
    ...list("VIEWER_EMAILS"),
  ]);

  if (explicitlyAllowed.has(normalized)) return true;

  const domain = (process.env.ALLOWED_EMAIL_DOMAIN || "pitchhealthsolutions.com")
    .trim()
    .toLowerCase();

  return Boolean(domain && normalized.endsWith("@" + domain));
}

export function canEdit(role: AppRole) {
  return role === "editor" || role === "superadmin";
}

export function isSuperadmin(role: AppRole) {
  return role === "superadmin";
}


export function isAuthConfigured() {
  return Boolean(
    process.env.AUTH_SECRET &&
    process.env.AUTH_GOOGLE_ID &&
    process.env.AUTH_GOOGLE_SECRET
  );
}
