export const dynamic = "force-dynamic";

import { getDashboardData } from "@/lib/airtable";
import { getContractingSources } from "@/lib/contracting";
import type { Agent, PipelineStage } from "@/lib/types";

const stages: PipelineStage[] = ["Pre-Licensing","Exam","Pre-Contracting","Contracting","RTS"];

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

export default async function Home() {
  const [{ agents, source, error }, contractingSources] = await Promise.all([getDashboardData(), getContractingSources()]);
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
      <header className="topbar">
        <div><div className="eyebrow">PITCH HEALTH SOLUTIONS</div><h1>Licensing & Contracting</h1></div>
        <div className="source"><span className={source === "airtable" ? "dot live" : "dot"} />{source === "airtable" ? "Live Airtable" : source === "error" ? "Airtable error" : "Sample data"}</div>
      </header>

      {source === "error" && <section className="panel"><strong>Airtable connection error</strong><div className="muted" style={{marginTop:8}}>{error}</div></section>}

      <section className="metric-grid">
        <div className="metric"><span>Active agents</span><strong>{agents.length}</strong></div>
        <div className="metric"><span>Licensed</span><strong>{licensed.length}</strong></div>
        <div className="metric"><span>Non-licensed</span><strong>{nonLicensed.length}</strong></div>
        <div className="metric"><span>Stuck 7+ days</span><strong>{stagnant.length}</strong><small>{agents.filter(a=>a.daysInStage>=14).length} critical</small></div>
        <div className="metric"><span>Active blockers</span><strong>{blocked.length}</strong></div>
        <div className="metric"><span>Missing info</span><strong>{missing.length}</strong></div>
        <div className="metric"><span>Licenses ≤30d</span><strong>{expiring.length}</strong></div>
      </section>

      <section className="panel">
        <div className="panel-title"><div><span className="eyebrow">CONTRACTING DATA</span><h2>Connected Airtable tables</h2></div></div>
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

      <section className="panel">
        <div className="panel-title"><div><span className="eyebrow">PIPELINE</span><h2>Agent journey</h2></div><span className="muted">Bottlenecks at a glance</span></div>
        <div className="pipeline">
          {stages.map(stage => {
            const list = agents.filter(a=>a.stage===stage);
            return <div className="stage" key={stage}>
              <div className="stage-head"><strong>{stage}</strong><span>{list.length}</span></div>
              <div className="stage-body">
                {list.length ? list.map(a=><div className="agent-card" key={a.id}>
                  <div className="card-top"><strong>{a.name}</strong><span className={a.daysInStage>=14?"age critical-text":a.daysInStage>=7?"age warning-text":"age"}>{a.daysInStage}d</span></div>
                  <div className="muted">{a.subStage || "—"}</div>
                  {a.blocker && <div className="blocker">⚑ {a.blocker}</div>}
                  <div className="card-foot"><span>{a.owner || "Unassigned"}</span>{a.missingFields.length>0 && <span>⚠ {a.missingFields.length} missing</span>}</div>
                </div>) : <div className="empty">No agents</div>}
              </div>
            </div>
          })}
        </div>
      </section>

      <div className="two-col">
        <section className="panel">
          <div className="panel-title"><div><span className="eyebrow">ACTION QUEUE</span><h2>Attention needed</h2></div></div>
          <div className="table-head"><span>Agent</span><span>Age</span><span>Blocker</span><span>Info</span><span>License</span></div>
          {attention.map(a=><AgentRow key={a.id} agent={a}/>)}
        </section>

        <section className="panel side">
          <div className="panel-title"><div><span className="eyebrow">HEALTH</span><h2>Operational checks</h2></div></div>
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
