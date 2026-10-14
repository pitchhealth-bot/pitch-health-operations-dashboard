import Link from "next/link";
import { getDashboardData } from "@/lib/airtable";
import { requireRole } from "@/lib/session";
import ActiveAgentsClient from "./ActiveAgentsClient";

export const dynamic = "force-dynamic";

type SortKey =
  | "name"
  | "status"
  | "role"
  | "licensingStatus"
  | "currentStage"
  | "contractingDesignation"
  | "startDate";

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    licensing?: string;
    sort?: string;
    dir?: string;
    filter?: string;
    roleView?: string;
  }>;
}) {
  await requireRole(["admin", "super_admin"]);

  const params = await searchParams;
  const { agents, source, error } = await getDashboardData();

  const safeSort: SortKey = [
    "name",
    "status",
    "role",
    "licensingStatus",
    "currentStage",
    "contractingDesignation",
    "startDate",
  ].includes(params.sort || "")
    ? (params.sort as SortKey)
    : "name";

  const safeDir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";

  const listAgents = agents.map(agent => ({
    id: agent.id,
    name: agent.name,
    status: agent.status,
    role: agent.role,
    licensingStatus: agent.licensingStatus,
    currentStage: agent.currentStage,
    contractingDesignation: agent.contractingDesignation,
    startDate: agent.startDate,
    email: agent.email,
    personalEmail: agent.personalEmail,
    daysInStage: agent.daysInStage,
    blocker: agent.blocker,
    missingCount: agent.missingFields.length,
    licenseExpiry: agent.licenseExpiry,
  }));

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">PITCH HEALTH SOLUTIONS</div>
          <h1>Active Agents</h1>
          <div className="muted">{agents.length} active agents</div>
        </div>
        <Link className="back-link" href="/">← Dashboard</Link>
      </header>

      {source === "error" && (
        <section className="panel">
          <strong>Airtable connection error</strong>
          <div className="muted" style={{ marginTop: 8 }}>{error}</div>
        </section>
      )}

      <ActiveAgentsClient
        agents={listAgents}
        initialQuery={params.q || ""}
        initialLicensing={params.licensing || ""}
        initialSpecialFilter={params.filter || ""}
        initialRoleView={params.roleView || ""}
        initialSort={safeSort}
        initialDir={safeDir}
      />
    </main>
  );
}
