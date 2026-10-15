"use client";

import { useMemo, useState } from "react";

const stages = [
  "Pre-Licensing",
  "Purchased Licensing Course",
  "Purchased Licensing Exam",
  "Purchased Resident States",
  "Purchased Non-resident States",
  "Contracting",
  "In Bootcamp",
  "Bootcamp Ready",
  "Active Medicare Agents",
] as const;

type JourneyStage = (typeof stages)[number];

type JourneyAgent = {
  id: string;
  name: string;
  role?: string;
  status?: string;
  npn?: string;
  journeyStage: JourneyStage;
};

export default function AgentJourneySearch({
  agents,
}: {
  agents: JourneyAgent[];
}) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!normalizedQuery) return [];
    return agents.filter(agent =>
      agent.name.toLowerCase().includes(normalizedQuery),
    );
  }, [agents, normalizedQuery]);

  const matchedStage = matches.length === 1 ? matches[0].journeyStage : null;

  return (
    <section className="panel dashboard-panel pipeline-panel journey-panel">
      <div className="panel-title journey-panel-title">
        <div>
          <span className="eyebrow">PIPELINE</span>
          <h2>Agent journey</h2>
        </div>
        <span className="panel-kicker">{agents.length} agents mapped</span>
      </div>

      <div className="journey-search-wrap">
        <div className="journey-search-box">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search agent name..."
            aria-label="Search agent in pipeline"
          />
          {query ? (
            <button
              type="button"
              className="journey-search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear agent search"
            >
              ×
            </button>
          ) : null}
        </div>

        {normalizedQuery ? (
          <div className="journey-search-result">
            {matches.length === 0 ? (
              <span>No active agent found.</span>
            ) : matches.length === 1 ? (
              <>
                <strong>{matches[0].name}</strong>
                <span>is currently in</span>
                <b>{matches[0].journeyStage}</b>
              </>
            ) : (
              <span>{matches.length} matching agents found. Refine the name to see the exact stage.</span>
            )}
          </div>
        ) : null}
      </div>

      <div className="pipeline journey-pipeline">
        {stages.map(stage => {
          const list = agents.filter(agent => agent.journeyStage === stage);
          const visibleList = normalizedQuery
            ? list.filter(agent => agent.name.toLowerCase().includes(normalizedQuery))
            : list;
          const isMatchedStage = matchedStage === stage;

          return (
            <div
              className={`stage journey-stage${isMatchedStage ? " journey-stage-match" : ""}`}
              key={stage}
            >
              <div className="stage-head">
                <strong>{stage}</strong>
                <span>{visibleList.length}</span>
              </div>

              <div className="stage-body">
                {visibleList.length ? visibleList.map(agent => (
                  <div
                    className={`agent-card journey-agent-card${normalizedQuery ? " journey-agent-match" : ""}`}
                    key={agent.id}
                  >
                    <div className="card-top">
                      <strong>{agent.name}</strong>
                    </div>
                    <div className="muted">
                      {agent.role || "—"}
                    </div>
                    <div className="card-foot">
                      <span>{agent.status || "No status"}</span>
                      {agent.npn && agent.npn !== "0" ? <span>NPN ✓</span> : null}
                    </div>
                  </div>
                )) : (
                  <div className="empty">
                    {normalizedQuery ? "No match" : "No agents"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
