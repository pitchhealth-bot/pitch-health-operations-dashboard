import { getDashboardData } from "@/lib/airtable";
import { requireRole } from "@/lib/session";
import { listDashboardUsers } from "@/lib/users";
import UsersManager from "./UsersManager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireRole(["super_admin"]);

  const [users, { agents }] = await Promise.all([
    listDashboardUsers(),
    getDashboardData(),
  ]);

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">SECURITY & ACCESS</div>
          <h1>Users</h1>
          <p className="page-subtitle">
            Manage Super Admin, Admin, and Agent access to Pitch Health Operations.
          </p>
        </div>
      </header>

      <UsersManager
        initialUsers={users}
        agents={agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          email: agent.email,
        }))}
      />
    </main>
  );
}
