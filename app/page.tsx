export const dynamic = "force-dynamic";

import Link from "next/link";
import { Suspense } from "react";
import { getDashboardData, getWorkforceMovementData, getJourneyDirectoryData } from "@/lib/airtable";
import { getContractingSources, getLicensingStageMilestones } from "@/lib/contracting";
import { getLicenseRecords, daysUntil } from "@/lib/licenses";
import type { Agent } from "@/lib/types";
import { requireRole } from "@/lib/session";
import AgentJourneySearch from "@/app/components/AgentJourneySearch";


const journeyStages = [
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

type JourneyStage = (typeof journeyStages)[number];

function expiringInDays(date?: string) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function AgentRow({ agent }: { agent: Agent }) {
  const exp = expiringInDays(agent.licenseExpiry);
  const severity = agent.daysInStage >= 14 ? "critical" : agent.daysInStage >= 7 ? "warning" : "normal";
  return (
    <div className="agent-row">
      <div>
        <strong>{agent.name}</strong>
        <div className="muted">{agent.subStage || agent.stage} · {agent.owner || "Unassigned"}</div>
      </div>
      <div className={`pill ${severity}`}>{agent.daysInStage}d</div>
      <div className="muted">{agent.blocker || "No blocker"}</div>
      <div>{agent.missingFields.length ? <span className="pill warning">{agent.missingFields.length} missing</span> : <span className="pill success">Complete</span>}</div>
      <div>{exp !== null && exp <= 30 ? <span className={`pill ${exp <= 7 ? "critical":"warning"}`}>{exp < 0 ? "Expired" : `${exp}d license`}</span> : <span className="muted">—</span>}</div>
    </div>
  );
}

async function ContractingSourcesPanel() {
  const contractingSources = await getContractingSources();

  return (
    <section className="panel dashboard-panel connected-panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">CONTRACTING DATA</span>
          <h2>Connected Airtable tables</h2>
        </div>
      </div>
      <div className="contracting-grid">
        {contractingSources.map(source => (
          <div className="contracting-source" key={source.key}>
            <div>
              <strong>{source.key}</strong>
              <div className="muted">{source.ok ? "Connected" : source.error}</div>
            </div>
            <div className={source.ok ? "pill success" : "pill critical"}>
              {source.ok ? `${source.count} records` : "Error"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


export default async function Home() {
  await requireRole(["admin", "super_admin"]);

  const [
    { agents, source, error },
    licenseData,
    workforceData,
    journeyDirectory,
    licensingMilestones,
  ] = await Promise.all([
    getDashboardData(),
    getLicenseRecords(),
    getWorkforceMovementData(),
    getJourneyDirectoryData(),
    getLicensingStageMilestones(),
  ]);

  if (licenseData.records.length) {
    const byNpn = new Map<string, string[]>();
    const byEmail = new Map<string, string[]>();
    const byName = new Map<string, string[]>();

    for (const license of licenseData.records) {
      if (!license.expirationDate) continue;
      if (license.npn) {
        const key = license.npn.trim();
        byNpn.set(key, [...(byNpn.get(key) || []), license.expirationDate]);
      }
      if (license.email) {
        const key = license.email.trim().toLowerCase();
        byEmail.set(key, [...(byEmail.get(key) || []), license.expirationDate]);
      }
      if (license.agentName) {
        const key = license.agentName.trim().toLowerCase();
        byName.set(key, [...(byName.get(key) || []), license.expirationDate]);
      }
    }

    for (const agent of agents) {
      const expirations =
        (agent.npn && byNpn.get(agent.npn.trim())) ||
        (agent.email && byEmail.get(agent.email.trim().toLowerCase())) ||
        byName.get(agent.name.trim().toLowerCase()) ||
        [];

      const upcoming = expirations
        .map(value => ({ value, days: daysUntil(value) }))
        .filter(item => item.days !== null && item.days >= 0)
        .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));

      if (upcoming.length) agent.licenseExpiry = upcoming[0].value;
    }
  }
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const parseDateOnly = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const daysAgo = (value?: string) => {
    const date = parseDateOnly(value);
    if (!date) return null;
    return Math.floor((startOfToday.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000);
  };

  const newlyActive = workforceData.records.filter(record => {
    const d = daysAgo(record.startDate);
    return d !== null && d >= 0 && d <= 6 && (record.status || "").trim().toLowerCase() === "active";
  });

  const recentlyTerminated = workforceData.records.filter(record => {
    const d = daysAgo(record.terminationDate);
    return d !== null && d >= 0 && d <= 6;
  });

  const recentMovement = workforceData.records
    .filter(record => {
      const startAge = daysAgo(record.startDate);
      const terminationAge = daysAgo(record.terminationDate);
      return (startAge !== null && startAge >= 0 && startAge <= 13) ||
        (terminationAge !== null && terminationAge >= 0 && terminationAge <= 13);
    })
    .sort((a, b) => {
      const ad = Math.max(
        parseDateOnly(a.startDate)?.getTime() || 0,
        parseDateOnly(a.terminationDate)?.getTime() || 0,
      );
      const bd = Math.max(
        parseDateOnly(b.startDate)?.getTime() || 0,
        parseDateOnly(b.terminationDate)?.getTime() || 0,
      );
      return bd - ad;
    })
    .slice(0, 8);

  const movementByDay = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(startOfToday);
    date.setDate(startOfToday.getDate() - (6 - offset));
    const key = date.toISOString().slice(0, 10);

    const starts = workforceData.records.filter(record => {
      const d = parseDateOnly(record.startDate);
      return d ? d.toISOString().slice(0, 10) === key : false;
    }).length;

    const terminations = workforceData.records.filter(record => {
      const d = parseDateOnly(record.terminationDate);
      return d ? d.toISOString().slice(0, 10) === key : false;
    }).length;

    return {
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      date: key,
      starts,
      terminations,
    };
  });

  const normalizeJourneyKey = (value?: string) =>
    (value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  const milestoneByNpn = new Map(
    licensingMilestones
      .filter(item => item.npn)
      .map(item => [normalizeJourneyKey(item.npn), item]),
  );
  const milestoneByEmail = new Map(
    licensingMilestones
      .filter(item => item.email)
      .map(item => [normalizeJourneyKey(item.email), item]),
  );
  const milestoneByName = new Map(
    licensingMilestones
      .filter(item => item.name)
      .map(item => [normalizeJourneyKey(item.name), item]),
  );

  const journeyAgents = journeyDirectory.records
    .filter(agent => normalizeJourneyKey(agent.status) === "active")
    .flatMap(agent => {
    const milestone =
      (agent.npn ? milestoneByNpn.get(normalizeJourneyKey(agent.npn)) : undefined) ||
      (agent.email ? milestoneByEmail.get(normalizeJourneyKey(agent.email)) : undefined) ||
      (agent.personalEmail ? milestoneByEmail.get(normalizeJourneyKey(agent.personalEmail)) : undefined) ||
      milestoneByName.get(normalizeJourneyKey(agent.name));

    const status = normalizeJourneyKey(agent.status);
    const role = normalizeJourneyKey(agent.role);
    const licensing = normalizeJourneyKey(agent.licensingStatus);
    const bootcamp = normalizeJourneyKey(agent.bootcampUpdate);
    const npnValue = (agent.npn || "").trim();
    const hasNpn = Boolean(npnValue) && npnValue !== "0" && Number(npnValue) > 0;

    const coursePurchased =
      normalizeJourneyKey(milestone?.purchasedLicensingCourse) === "yes";
    const examPurchased =
      normalizeJourneyKey(milestone?.purchasedLicensingExam) === "yes";
    const residentPurchased =
      normalizeJourneyKey(milestone?.purchasedResidentStates) === "completed";
    const nonResidentPurchased =
      normalizeJourneyKey(milestone?.purchasedNonResidentStates) === "completed";

    let stage: JourneyStage | null = null;

    // Furthest applicable stage wins so an agent only appears once.
    if (status === "active" && role === "medicareagent") {
      stage = "Active Medicare Agents";
    } else if (bootcamp === "bootcampready") {
      stage = "Bootcamp Ready";
    } else if (bootcamp === "inbootcamp") {
      stage = "In Bootcamp";
    } else if (hasNpn) {
      stage = "Contracting";
    } else if (nonResidentPurchased) {
      stage = "Purchased Non-resident States";
    } else if (residentPurchased) {
      stage = "Purchased Resident States";
    } else if (examPurchased) {
      stage = "Purchased Licensing Exam";
    } else if (coursePurchased) {
      stage = "Purchased Licensing Course";
    } else if (licensing === "nonlicensed") {
      stage = "Pre-Licensing";
    }

    return stage ? [{ ...agent, journeyStage: stage }] : [];
  });

  const licensed = agents.filter(a => a.licensingStatus === "Licensed");
  const nonLicensed = agents.filter(a => a.licensingStatus === "Non-licensed");
  const stagnant = agents.filter(a => a.daysInStage >= 7);
  const blocked = agents.filter(a => a.blocker);
  const missing = agents.filter(a => a.missingFields.length);
  const expiring = agents.filter(a => {
    const n = expiringInDays(a.licenseExpiry);
    return n !== null && n <= 30;
  });
  const attention = [...agents].sort((a,b) => {
    const score = (x:Agent) => (x.daysInStage>=14?4:x.daysInStage>=7?2:0) + (x.blocker?2:0) + x.missingFields.length + ((expiringInDays(x.licenseExpiry) ?? 999)<=7?4:0);
    return score(b)-score(a);
  }).slice(0,8);

  return (
    <main>
      <header className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="eyebrow dashboard-hero-eyebrow">OPERATIONS DASHBOARD</div>
          <h1>Licensing & Contracting</h1>
          <p className="page-subtitle">
            Track agent readiness, licensing progress, blockers, and contracting health.
          </p>
          <div className="dashboard-hero-meta">
            <span>{agents.length} active agents</span>
            <span>{licensed.length} licensed</span>
            <span>{missing.length} incomplete profiles</span>
          </div>
        </div>

        <div className="dashboard-hero-status">
          <div className="source source-hero">
            <span className={source === "airtable" ? "dot live" : "dot"} />
            {source === "airtable" ? "Live Airtable" : source === "error" ? "Airtable error" : "Sample data"}
          </div>
          <div className="hero-orbit hero-orbit-one" />
          <div className="hero-orbit hero-orbit-two" />
          <div className="hero-monogram">P</div>
        </div>
      </header>

      {source === "error" && <section className="panel"><strong>Airtable connection error</strong><div className="muted" style={{marginTop:8}}>{error}</div></section>}

      <section className="executive-metrics">
        <Link href="/agents" className="executive-metric-card">
          <div className="executive-metric-head"><span>Active Agents</span><i>↗</i></div>
          <strong>{agents.length}</strong>
          <small>Current workforce</small>
          <div className="mini-bars" aria-hidden="true">
            {[38,52,46,64,58,72,68].map((h,i)=><span key={i} style={{height:`${h}%`}} />)}
          </div>
        </Link>

        <Link href="/workforce-movement?type=start&days=7&status=active" className="executive-metric-card">
          <div className="executive-metric-head"><span>Newly Active</span><i>＋</i></div>
          <strong>{newlyActive.length}</strong>
          <small>Started in the last 7 days</small>
          <div className="metric-delta positive">↑ workforce growth</div>
        </Link>

        <Link href="/workforce-movement?type=termination&days=7" className="executive-metric-card">
          <div className="executive-metric-head"><span>Terminated</span><i>−</i></div>
          <strong>{recentlyTerminated.length}</strong>
          <small>Last 7 days</small>
          <div className="metric-delta negative">Recent exits</div>
        </Link>

        <Link href="/agents?licensing=Licensed" className="executive-metric-card">
          <div className="executive-metric-head"><span>Licensed</span><i>✓</i></div>
          <strong>{licensed.length}</strong>
          <small>{agents.length ? Math.round((licensed.length / agents.length) * 100) : 0}% of active agents</small>
          <svg className="metric-sparkline" viewBox="0 0 220 42" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="licensedSparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity=".18" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M2 31 L35 18 L68 24 L101 10 L134 20 L167 14 L218 11 L218 42 L2 42 Z"
              fill="url(#licensedSparkFill)"
            />
            <polyline
              points="2,31 35,18 68,24 101,10 134,20 167,14 218,11"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        <Link href="/licenses" className="executive-metric-card">
          <div className="executive-metric-head"><span>Licenses ≤30d</span><i>◷</i></div>
          <strong>{expiring.length}</strong>
          <small>Upcoming expirations</small>
          <div className="metric-delta warning">Needs monitoring</div>
        </Link>
      </section>

      <section className="dashboard-insights-grid">
        <div className="panel dashboard-panel movement-chart-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">WORKFORCE TREND</span>
              <h2>Starts vs Terminations</h2>
            </div>
            <span className="panel-kicker">Last 7 days</span>
          </div>

          <div className="movement-chart-legend">
            <span><i className="movement-dot starts" /> Starts</span>
            <span><i className="movement-dot terms" /> Terminations</span>
          </div>

          <div className="movement-bar-chart">
            {movementByDay.map(day => {
              const maxValue = Math.max(...movementByDay.flatMap(item => [item.starts, item.terminations]), 1);
              return (
                <div className="movement-day" key={day.label}>
                  <div className="movement-bars-pair">
                    <Link
                      href={`/workforce-movement?type=start&date=${day.date}`}
                      className="movement-bar starts movement-bar-link"
                      style={{height:`${Math.max(8,(day.starts/maxValue)*100)}%`}}
                      aria-label={`${day.label}: ${day.starts} starts`}
                    >
                      <span className="movement-hover-tooltip">
                        <strong>{day.starts}</strong>
                        <small>{day.label} starts</small>
                      </span>
                    </Link>
                    <Link
                      href={`/workforce-movement?type=termination&date=${day.date}`}
                      className="movement-bar terms movement-bar-link"
                      style={{height:`${Math.max(8,(day.terminations/maxValue)*100)}%`}}
                      aria-label={`${day.label}: ${day.terminations} terminations`}
                    >
                      <span className="movement-hover-tooltip">
                        <strong>{day.terminations}</strong>
                        <small>{day.label} terminations</small>
                      </span>
                    </Link>
                  </div>
                  <small>{day.label}</small>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel dashboard-panel recent-movement-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">RECENT MOVEMENT</span>
              <h2>Starts & Terminations</h2>
            </div>
            <Link href="/workforce-movement?days=14" className="panel-kicker panel-kicker-link">View all · Last 14 days</Link>
          </div>

          <div className="movement-table-head">
            <span>Agent</span><span>Status</span><span>Start Date</span><span>Termination</span>
          </div>

          {recentMovement.length ? recentMovement.map(record => (
            <Link
              href={`/workforce-movement?record=${record.id}`}
              className="movement-table-row movement-table-row-link"
              key={record.id}
            >
              <div>
                <strong>{record.name}</strong>
                <span>{record.role || "No role"}</span>
              </div>
              <div><span className={`pill ${(record.status || "").toLowerCase() === "active" ? "success" : "critical"}`}>{record.status || "—"}</span></div>
              <div>{record.startDate || "—"}</div>
              <div>{record.terminationDate || "—"}</div>
            </Link>
          )) : <div className="empty">No recent starts or terminations.</div>}
        </div>
      </section>

      <Suspense
        fallback={
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">CONTRACTING DATA</span>
                <h2>Connected Airtable tables</h2>
              </div>
            </div>
            <div className="muted">Loading contracting connections...</div>
          </section>
        }
      >
        <ContractingSourcesPanel />
      </Suspense>

      <AgentJourneySearch
        agents={journeyAgents.map(agent => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          status: agent.status,
          npn: agent.npn,
          journeyStage: agent.journeyStage,
        }))}
      />

      <div className="two-col">
        <section className="panel dashboard-panel action-panel">
          <div className="panel-title"><div><span className="eyebrow">ACTION QUEUE</span><h2>Attention needed</h2></div><span className="panel-count">{attention.length}</span></div>
          <div className="table-head"><span>Agent</span><span>Age</span><span>Blocker</span><span>Info</span><span>License</span></div>
          {attention.map(a=><AgentRow key={a.id} agent={a}/>)}
        </section>

        <section className="panel side dashboard-panel health-panel">
          <div className="panel-title"><div><span className="eyebrow">HEALTH</span><h2>Operational checks</h2></div><span className="health-pulse"><i /> Live</span></div>
          <div className="check"><span>Hierarchy not verified</span><strong>{agents.filter(a=>!a.hierarchyVerified && a.stage!=="Pre-Licensing" && a.stage!=="Exam").length}</strong></div>
          <div className="check"><span>Carrier delays</span><strong>{agents.filter(a=>a.blockerType==="Carrier Delay").length}</strong></div>
          <div className="check"><span>Agent action required</span><strong>{agents.filter(a=>a.blockerType==="Agent Action Required").length}</strong></div>
          <div className="check"><span>14+ days stagnant</span><strong>{agents.filter(a=>a.daysInStage>=14).length}</strong></div>
          <div className="legend"><b>Stagnation</b><span><i className="lg normal-bg"/> 0–6d</span><span><i className="lg warning-bg"/> 7–13d</span><span><i className="lg critical-bg"/> 14+d</span></div>
        </section>
      </div>
    </main>
  );
}
