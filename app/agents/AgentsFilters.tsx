"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export default function AgentsFilters({
  initialQuery,
  initialLicensing,
  sort,
  dir,
  specialFilter,
  roleView,
}: {
  initialQuery: string;
  initialLicensing: string;
  sort: string;
  dir: string;
  specialFilter: string;
  roleView: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [licensing, setLicensing] = useState(initialLicensing);
  const [isPending, startTransition] = useTransition();
  const firstRun = useRef(true);

  function navigate(nextQuery: string, nextLicensing: string) {
    const params = new URLSearchParams();

    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextLicensing) params.set("licensing", nextLicensing);
    if (sort) params.set("sort", sort);
    if (dir) params.set("dir", dir);
    if (specialFilter) params.set("filter", specialFilter);
    if (roleView) params.set("roleView", roleView);

    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/agents?${qs}` : "/agents", { scroll: false });
    });
  }

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      navigate(query, licensing);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
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
        onChange={event => {
          const next = event.target.value;
          setLicensing(next);
          navigate(query, next);
        }}
        className="filter-select"
      >
        <option value="">All licensing statuses</option>
        <option value="Licensed">Licensed</option>
        <option value="Non-licensed">Non-licensed</option>
      </select>

      <button
        type="button"
        className="filter-button"
        onClick={() => navigate(query, licensing)}
      >
        Filter
      </button>

      {(query || licensing || specialFilter || roleView) && (
        <Link href="/agents" className="clear-link">
          Clear
        </Link>
      )}
      </div>

      <div className={`agents-filter-loading${isPending ? " visible" : ""}`} aria-live="polite">
        <span className="agents-loading-spinner" aria-hidden="true" />
        <span>Updating agents...</span>
      </div>
    </div>
  );
}
