"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { AppRole } from "@/lib/access";

export default function Sidebar({
  user,
}: {
  user?: { name?: string | null; email?: string | null; role: AppRole } | null;
}) {
  const pathname = usePathname();

  const items = [
    { href: "/", label: "Dashboard", icon: "⌂" },
    { href: "/agents", label: "Active Agents", icon: "◎" },
    { href: "/licenses", label: "License Expirations", icon: "◷" },
    ...(user?.role === "superadmin"
      ? [{ href: "/audit", label: "Audit Log", icon: "≡" }]
      : []),
  ];

  return (
    <aside className="app-sidebar">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div className="brand-copy">
          <strong>Pitch Health</strong>
          <span>Operations</span>
        </div>
      </div>

      <nav className="side-nav">
        <div className="nav-label">Workspace</div>
        {items.map(item => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              href={item.href}
              key={item.href}
              className={active ? "nav-item active" : "nav-item"}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-card">
        <div className="sidebar-card-icon">✓</div>
        <strong>Live Operations</strong>
        <span>Connected to Airtable</span>
      </div>

      {user && (
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="sidebar-user-copy">
            <strong>{user.name || user.email}</strong>
            <span>{user.role}</span>
          </div>
          <button
            className="sidebar-signout"
            onClick={() => signOut({ redirectTo: "/login" })}
            title="Sign out"
          >
            ↗
          </button>
        </div>
      )}
    </aside>
  );
}
