import type { DashboardRole } from "./users";

export type AppRole = DashboardRole;

export function canEdit(role: AppRole) {
  return role === "admin" || role === "super_admin";
}

export function isSuperadmin(role: AppRole) {
  return role === "super_admin";
}

export function isAuthConfigured() {
  return Boolean(
    process.env.AUTH_SECRET &&
    process.env.AUTH_GOOGLE_ID &&
    process.env.AUTH_GOOGLE_SECRET
  );
}
