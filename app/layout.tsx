import type { Metadata } from "next";
import "./globals.css";
import { getSessionEmail } from "@/lib/app-session";
import { getDashboardUserByEmail, listDashboardUsers } from "@/lib/users";
import AppShell from "./components/AppShell";

export const metadata: Metadata = {
  title: "Pitch Health Operations",
  description: "Licensing & Contracting operations dashboard",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const email = await getSessionEmail();
  const dashboardUser = email
    ? await getDashboardUserByEmail(email).catch(() => null)
    : null;

  let user:
    | {
        name?: string | null;
        email?: string | null;
        role: "super_admin" | "admin" | "agent";
        airtableAgentRecordId?: string;
      }
    | null = null;

  if (dashboardUser?.status === "active") {
    user = {
      name: dashboardUser.name || dashboardUser.email,
      email: dashboardUser.email,
      role: dashboardUser.role,
      airtableAgentRecordId: dashboardUser.airtableAgentRecordId,
    };
  } else if (!email) {
    const users = await listDashboardUsers().catch(() => []);
    const hasCompletedLogin = users.some(item => Boolean(item.lastLoginAt));

    if (!hasCompletedLogin) {
      user = {
        name: "Setup Admin",
        email: null,
        role: "super_admin",
      };
    }
  }

  return (
    <html lang="en">
      <body>
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
