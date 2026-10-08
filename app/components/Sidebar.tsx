"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/access";

export default function Sidebar({
  user,
}: {
  user?: {
    name?: string | null;
    email?: string | null;
    role: AppRole;
    airtableAgentRecordId?: string;
  } | null;
}) {
  const pathname = usePathname();

  const adminItems = [
    { href: "/", label: "Dashboard", icon: "⌂" },
    { href: "/agents", label: "Active Agents", icon: "◎" },
    { href: "/licenses", label: "License Expirations", icon: "◷" },
  ];

  const agentItems = user?.airtableAgentRecordId
    ? [{ href: `/agents/${user.airtableAgentRecordId}`, label: "My Record", icon: "◎" }]
    : [];

  const items = user?.role === "agent"
    ? agentItems
    : [
        ...adminItems,
        ...(user?.role === "super_admin"
          ? [
              { href: "/users", label: "Users", icon: "♙" },
              { href: "/audit", label: "Audit Log", icon: "≡" },
            ]
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
        <Link href="/account" className="sidebar-user" title="My Account">
          <div className="sidebar-user-avatar">
            {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="sidebar-user-copy">
            <strong>{user.name || user.email}</strong>
            <span>{user.role.replace("_", " ")}</span>
          </div>
          <span className="sidebar-signout" aria-hidden="true">↗</span>
        </Link>
      )}
    </aside>
  );
}
