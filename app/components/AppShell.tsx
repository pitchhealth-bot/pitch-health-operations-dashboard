"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import type { AppRole } from "@/lib/access";

export default function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: { name?: string | null; email?: string | null; role: AppRole } | null;
}) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <div className="auth-shell">{children}</div>;
  }

  return (
    <div className="app-shell">
      <Sidebar user={user || null} />
      <div className="app-content">{children}</div>
    </div>
  );
}
