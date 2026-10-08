"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function AgentsFilters({
  initialQuery,
  initialLicensing,
  sort,
  dir,
  specialFilter,
}: {
  initialQuery: string;
  initialLicensing: string;
  sort: string;
  dir: string;
  specialFilter: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [licensing, setLicensing] = useState(initialLicensing);
  const firstRun = useRef(true);

  function navigate(nextQuery: string, nextLicensing: string) {
    const params = new URLSearchParams();

    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextLicensing) params.set("licensing", nextLicensing);
    if (sort) params.set("sort", sort);
    if (dir) params.set("dir", dir);
    if (specialFilter) params.set("filter", specialFilter);

    const qs = params.toString();
    router.replace(qs ? `/agents?${qs}` : "/agents", { scroll: false });
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

      {(query || licensing || specialFilter) && (
        <Link href="/agents" className="clear-link">
          Clear
        </Link>
      )}
    </div>
  );
}
