import { redirect } from "next/navigation";
import type { AppRole } from "./access";
import { getSessionEmail } from "./app-session";
import {
  getDashboardUserByEmail,
  listDashboardUsers,
} from "./users";

export async function requireUser() {
  const email = await getSessionEmail();

  if (email) {
    const dashboardUser = await getDashboardUserByEmail(email);

    if (!dashboardUser || dashboardUser.status !== "active") {
      redirect("/login");
    }

    return {
      user: {
        name: dashboardUser.name || dashboardUser.email,
        email: dashboardUser.email,
      },
      role: dashboardUser.role,
      dashboardUser,
      authConfigured: true,
    };
  }

  const users = await listDashboardUsers().catch(() => []);
  const hasCompletedLogin = users.some(user => Boolean(user.lastLoginAt));

  if (!hasCompletedLogin) {
    return {
      user: { name: "Setup Admin", email: null },
      role: "super_admin" as AppRole,
      dashboardUser: null,
      authConfigured: false,
    };
  }

  redirect("/login");
}

export async function requireRole(roles: AppRole[]) {
  const current = await requireUser();

  if (!current.authConfigured) {
    return current;
  }

  if (!roles.includes(current.role)) {
    if (
      current.role === "agent" &&
      current.dashboardUser?.airtableAgentRecordId
    ) {
      redirect(`/agents/${current.dashboardUser.airtableAgentRecordId}`);
    }

    redirect("/");
  }

  return current;
}
