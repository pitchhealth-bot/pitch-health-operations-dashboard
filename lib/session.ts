import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRoleForEmail, type AppRole } from "./access";

export async function requireUser() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  return {
    user: session.user,
    role: getRoleForEmail(session.user.email),
  };
}

export async function requireRole(roles: AppRole[]) {
  const current = await requireUser();

  if (!roles.includes(current.role)) {
    redirect("/");
  }

  return current;
}
