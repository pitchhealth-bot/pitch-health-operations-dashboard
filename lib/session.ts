import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRoleForEmail, isAuthConfigured, type AppRole } from "./access";

export async function requireUser() {
  if (!isAuthConfigured()) {
    return {
      user: { name: "Authentication not configured", email: null },
      role: "viewer" as AppRole,
      authConfigured: false,
    };
  }

  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  return {
    user: session.user,
    role: getRoleForEmail(session.user.email),
    authConfigured: true,
  };
}

export async function requireRole(roles: AppRole[]) {
  if (!isAuthConfigured()) {
    redirect("/");
  }

  const current = await requireUser();

  if (!roles.includes(current.role)) {
    redirect("/");
  }

  return current;
}
