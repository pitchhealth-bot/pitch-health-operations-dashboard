import type { Metadata } from "next";
import "./globals.css";
import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/access";
import { getDashboardUserByEmail } from "@/lib/users";
import AppShell from "./components/AppShell";

export const metadata: Metadata = {
  title: "Pitch Health Operations",
  description: "Licensing & Contracting operations dashboard",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const authConfigured = isAuthConfigured();
  const session = authConfigured ? await auth() : null;
  const dashboardUser = session?.user?.email
    ? await getDashboardUserByEmail(session.user.email).catch(() => null)
    : null;

  const user = authConfigured
    ? (
        session?.user?.email && dashboardUser
          ? {
              name: session.user.name || dashboardUser.name,
              email: session.user.email,
              role: dashboardUser.role,
              airtableAgentRecordId: dashboardUser.airtableAgentRecordId,
            }
          : null
      )
    : {
        name: "Setup Admin",
        email: null,
        role: "super_admin" as const,
        airtableAgentRecordId: undefined,
      };

  return (
    <html lang="en">
      <body>
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
