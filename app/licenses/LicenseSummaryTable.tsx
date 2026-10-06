"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type LicenseSummaryRow = {
  key: string;
  agentId?: string;
  name: string;
  status?: string;
  role?: string;
  npn?: string;
  email?: string;
  licenseCount: number;
  residentState?: string;
  states: string[];
  nearestExpiration?: string;
  nearestDays: number;
  expiredCount: number;
};

type SortKey =
  | "name"
  | "status"
  | "role"
  | "count"
  | "resident"
  | "states"
  | "expiration"
  | "expired";

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export default function LicenseSummaryTable({ rows }: { rows: LicenseSummaryRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("expiration");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = q
      ? rows.filter(row =>
          [
            row.name,
            row.status,
            row.role,
            row.npn,
            row.email,
            row.residentState,
            ...row.states,
          ]
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(q)),
        )
      : rows;

    return [...filtered].sort((a, b) => {
      const direction = dir === "desc" ? -1 : 1;

      const av =
        sort === "status" ? (a.status || "") :
        sort === "role" ? (a.role || "") :
        sort === "count" ? a.licenseCount :
        sort === "resident" ? (a.residentState || "") :
        sort === "states" ? a.states.join(",") :
        sort === "expiration" ? a.nearestDays :
        sort === "expired" ? a.expiredCount :
        a.name;

      const bv =
        sort === "status" ? (b.status || "") :
        sort === "role" ? (b.role || "") :
        sort === "count" ? b.licenseCount :
        sort === "resident" ? (b.residentState || "") :
        sort === "states" ? b.states.join(",") :
        sort === "expiration" ? b.nearestDays :
        sort === "expired" ? b.expiredCount :
        b.name;

      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * direction;
      }

      return String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * direction;
    });
  }, [rows, query, sort, dir]);

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setDir(current => current === "asc" ? "desc" : "asc");
    } else {
      setSort(key);
      setDir("asc");
    }
  }

  function Header({ sortKey, children }: { sortKey: SortKey; children: React.ReactNode }) {
    return (
      <button type="button" className="sort-header sort-button" onClick={() => toggleSort(sortKey)}>
        <span>{children}</span>
        {sort === sortKey && <span className="sort-arrow">{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="agents-filters">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search name, role, state, NPN..."
            className="search-input"
            autoComplete="off"
          />
          {query && (
            <button type="button" className="clear-live-search" onClick={() => setQuery("")}>
              Clear
            </button>
          )}
          <span className="live-result-count">{visible.length} agents</span>
        </div>
      </section>

      <section className="panel agents-list-panel">
        <div className="license-summary-head">
          <Header sortKey="name">Name</Header>
          <Header sortKey="status">Status</Header>
          <Header sortKey="role">Role</Header>
          <Header sortKey="count">Licenses Expiring</Header>
          <Header sortKey="resident">Resident State</Header>
          <Header sortKey="states">States</Header>
          <Header sortKey="expiration">Nearest Expiration</Header>
          <Header sortKey="expired">Expired?</Header>
        </div>

        {visible.length ? visible.map(group => {
          const params = new URLSearchParams();
          if (group.agentId) params.set("agentId", group.agentId);
          if (group.npn) params.set("npn", group.npn);
          if (group.email) params.set("email", group.email);
          params.set("name", group.name);

          return (
            <div className="license-summary-row" key={group.key}>
              <div>
                <Link className="agent-name-link" href={`/licenses/detail?${params.toString()}`}>
                  <strong>{group.name}</strong>
                </Link>
              </div>
              <div>
                <span className={group.status === "Active" ? "pill success" : "pill"}>
                  {group.status || "—"}
                </span>
              </div>
              <div>{group.role || "—"}</div>
              <div><span className="license-count-pill">{group.licenseCount}</span></div>
              <div><strong>{group.residentState || "—"}</strong></div>
              <div className="state-badges">
                {group.states.slice(0, 5).map(state => <span key={state}>{state}</span>)}
                {group.states.length > 5 && <span>+{group.states.length - 5}</span>}
              </div>
              <div>
                <strong>{formatDate(group.nearestExpiration)}</strong>
                <div className="muted">
                  {group.nearestDays < 0
                    ? `${Math.abs(group.nearestDays)}d expired`
                    : `${group.nearestDays}d remaining`}
                </div>
              </div>
              <div>
                <span className={group.expiredCount ? "pill critical" : "pill warning"}>
                  {group.expiredCount ? `Yes · ${group.expiredCount}` : "No"}
                </span>
              </div>
            </div>
          );
        }) : (
          <div className="empty" style={{ minHeight: 180 }}>
            No matching license records.
          </div>
        )}
      </section>
    </>
  );
}
