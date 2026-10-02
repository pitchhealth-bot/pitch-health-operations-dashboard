"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Dashboard", icon: "⌂" },
  { href: "/agents", label: "Active Agents", icon: "◎" },
];

export default function Sidebar() {
  const pathname = usePathname();

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

      <div className="sidebar-footer">
        <span className="sidebar-dot" />
        <div>
          <strong>Pitch Health Solutions</strong>
          <span>Licensing & Contracting</span>
        </div>
      </div>
    </aside>
  );
}
