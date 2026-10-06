import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAuthConfigured, type AppRole } from "./access";
import { getDashboardUserByEmail } from "./users";

export async function requireUser() {
  if (!isAuthConfigured()) {
    return {
      user: { name: "Authentication not configured", email: null },
      role: "agent" as AppRole,
      dashboardUser: null,
      authConfigured: false,
    };
  }

  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const dashboardUser = await getDashboardUserByEmail(session.user.email);

  if (!dashboardUser || dashboardUser.status !== "active") {
    redirect("/login");
  }

  return {
    user: session.user,
    role: dashboardUser.role,
    dashboardUser,
    authConfigured: true,
  };
}

export async function requireRole(roles: AppRole[]) {
  if (!isAuthConfigured()) {
    redirect("/");
  }

  const current = await requireUser();

  if (!roles.includes(current.role)) {
    if (current.role === "agent" && current.dashboardUser?.airtableAgentRecordId) {
      redirect(`/agents/${current.dashboardUser.airtableAgentRecordId}`);
    }
    redirect("/");
  }

  return current;
}
