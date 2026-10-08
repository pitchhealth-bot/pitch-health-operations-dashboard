import { requireUser } from "@/lib/session";
import AccountActions from "./AccountActions";

export default async function AccountPage() {
  const current = await requireUser();

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ACCOUNT</div>
          <h1>My Account</h1>
          <p className="page-subtitle">Manage your Pitch Health Operations access.</p>
        </div>
      </div>

      <section className="panel account-panel">
        <div className="account-grid">
          <div className="record-field">
            <span>Name</span>
            <strong>{current.user.name || "—"}</strong>
          </div>
          <div className="record-field">
            <span>Email</span>
            <strong>{current.user.email || "—"}</strong>
          </div>
          <div className="record-field">
            <span>Role</span>
            <strong>{current.role.replace("_", " ")}</strong>
          </div>
        </div>

        <AccountActions />
      </section>
    </div>
  );
}
