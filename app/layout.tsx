import type { Metadata } from "next";
import "./globals.css";
import { auth } from "@/auth";
import { getRoleForEmail, isAuthConfigured } from "@/lib/access";
import AppShell from "./components/AppShell";

export const metadata: Metadata = {
  title: "Pitch Health Operations",
  description: "Licensing & Contracting operations dashboard",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = isAuthConfigured() ? await auth() : null;
  const user = session?.user?.email
    ? {
        name: session.user.name,
        email: session.user.email,
        role: getRoleForEmail(session.user.email),
      }
    : null;

  return (
    <html lang="en">
      <body>
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
