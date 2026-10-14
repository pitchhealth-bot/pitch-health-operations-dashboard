"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AgentListItem = {
  id: string;
  name: string;
  status?: string;
  role?: string;
  licensingStatus?: string;
  currentStage?: string;
  contractingDesignation?: string;
  startDate?: string;
  email?: string;
  personalEmail?: string;
  daysInStage: number;
  blocker?: string;
  missingCount: number;
  licenseExpiry?: string;
};

type SortKey =
  | "name"
  | "status"
  | "role"
  | "licensingStatus"
  | "currentStage"
  | "contractingDesignation"
  | "startDate";

const columns: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "role", label: "Role" },
  { key: "licensingStatus", label: "Licensing Status" },
  { key: "currentStage", label: "Current Stage" },
  { key: "contractingDesignation", label: "Contracting Designation" },
  { key: "startDate", label: "Start Date" },
];

function valueForSort(agent: AgentListItem, key: SortKey) {
  return String(agent[key] || "").trim();
}

function sortAgents(agents: AgentListItem[], key: SortKey, dir: "asc" | "desc") {
  return [...agents].sort((a, b) => {
    const av = valueForSort(a, key);
    const bv = valueForSort(b, key);

    if (key === "startDate") {
      const at = av ? new Date(av).getTime() : 0;
      const bt = bv ? new Date(bv).getTime() : 0;
      return dir === "asc" ? at - bt : bt - at;
    }

    const result = av.localeCompare(bv, undefined, {
      numeric: true,
      sensitivity: "base",
    });

    return dir === "asc" ? result : -result;
  });
}

function licenseDays(expiry?: string) {
  if (!expiry) return null;
  const date = new Date(expiry);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

export default function ActiveAgentsClient({
  agents,
  initialQuery = "",
  initialLicensing = "",
  initialSpecialFilter = "",
  initialRoleView = "",
  initialSort = "name",
  initialDir = "asc",
}: {
  agents: AgentListItem[];
  initialQuery?: string;
  initialLicensing?: string;
  initialSpecialFilter?: string;
  initialRoleView?: string;
  initialSort?: SortKey;
  initialDir?: "asc" | "desc";
}) {
  const [query, setQuery] = useState(initialQuery);
  const [licensing, setLicensing] = useState(initialLicensing);
  const [specialFilter, setSpecialFilter] = useState(initialSpecialFilter);
  const [roleView, setRoleView] = useState(initialRoleView);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [dir, setDir] = useState<"asc" | "desc">(initialDir);

  const sorted = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = agents.filter(agent => {
      const matchesQuery =
        !normalizedQuery ||
        [
          agent.name,
          agent.status,
          agent.role,
          agent.licensingStatus,
          agent.currentStage,
          agent.contractingDesignation,
          agent.startDate,
          agent.email,
          agent.personalEmail,
        ]
          .filter(Boolean)
          .some(value =>
            String(value).toLowerCase().includes(normalizedQuery),
          );

      const matchesLicensing =
        !licensing ||
        (agent.licensingStatus || "").toLowerCase() === licensing.toLowerCase();

      const normalizedRole = (agent.role || "").trim().toLowerCase();
      const matchesRole =
        !roleView ||
        (roleView === "admin" && normalizedRole === "admin") ||
        (roleView === "bootcamp-direct" && normalizedRole === "bootcamp direct") ||
        (roleView === "medicare-agent" && normalizedRole === "medicare agent") ||
        (roleView === "no-role" && !normalizedRole);

      const days = licenseDays(agent.licenseExpiry);
      const matchesSpecial =
        !specialFilter ||
        (specialFilter === "stuck" && agent.daysInStage >= 7) ||
        (specialFilter === "blocked" && Boolean(agent.blocker)) ||
        (specialFilter === "missing" && agent.missingCount > 0) ||
        (specialFilter === "expiring" && days !== null && days <= 30);

      return matchesQuery && matchesLicensing && matchesRole && matchesSpecial;
    });

    return sortAgents(filtered, sort, dir);
  }, [agents, query, licensing, roleView, specialFilter, sort, dir]);

  function clear() {
    setQuery("");
    setLicensing("");
    setSpecialFilter("");
    setRoleView("");
    setSort("name");
    setDir("asc");
  }

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setDir(current => current === "asc" ? "desc" : "asc");
    } else {
      setSort(key);
      setDir("asc");
    }
  }

  return (
    <>
      <section className="panel">
        <div className="agent-role-tabs">
          {[
            ["", "All"],
            ["admin", "ADMIN"],
            ["bootcamp-direct", "Bootcamp Direct"],
            ["medicare-agent", "Medicare Agent"],
            ["no-role", "No Role"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={label}
              className={`agent-role-tab${roleView === value ? " active" : ""}`}
              onClick={() => setRoleView(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="agents-filters-wrap">
          <div className="agents-filters">
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search active agents..."
              className="search-input"
              autoComplete="off"
            />

            <select
              value={licensing}
              onChange={event => setLicensing(event.target.value)}
              className="filter-select"
            >
              <option value="">All licensing statuses</option>
              <option value="Licensed">Licensed</option>
              <option value="Non-licensed">Non-licensed</option>
            </select>

            <button
              type="button"
              className="filter-button"
              onClick={() => undefined}
            >
              {sorted.length} shown
            </button>

            {(query || licensing || specialFilter || roleView) && (
              <button type="button" className="clear-link" onClick={clear}>
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="panel agents-list-panel">
        <div className="agents-table-head active-agents-seven">
          {columns.map(column => (
            <button
              type="button"
              key={column.key}
              onClick={() => toggleSort(column.key)}
              className="sort-header sort-header-button"
            >
              <span>{column.label}</span>
              {sort === column.key && (
                <span className="sort-arrow">{dir === "asc" ? "↑" : "↓"}</span>
              )}
            </button>
          ))}
        </div>

        {sorted.length ? sorted.map(agent => (
          <div className="agents-table-row active-agents-seven" key={agent.id}>
            <div>
              <Link href={`/agents/${agent.id}`} className="agent-name-link">
                <strong>{agent.name}</strong>
              </Link>
            </div>
            <div><span className="pill success">{agent.status || "Active"}</span></div>
            <div>{agent.role || "—"}</div>
            <div>
              <span className={
                agent.licensingStatus === "Licensed"
                  ? "pill success"
                  : agent.licensingStatus === "Non-licensed"
                    ? "pill warning"
                    : "pill"
              }>
                {agent.licensingStatus || "—"}
              </span>
            </div>
            <div>{agent.currentStage || "—"}</div>
            <div>{agent.contractingDesignation || "—"}</div>
            <div>{agent.startDate || "—"}</div>
          </div>
        )) : (
          <div className="empty" style={{ minHeight: 140 }}>
            No active agents match these filters.
          </div>
        )}
      </section>
    </>
  );
}
