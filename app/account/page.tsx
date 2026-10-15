import Link from "next/link";
import { requireUser } from "@/lib/session";
import AccountActions from "./AccountActions";

function formatRole(role: string) {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatDateTime(value?: string) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AccountPage() {
  const current = await requireUser();
  const dashboardUser = current.dashboardUser;
  const initials = (current.user.name || current.user.email || "U")
    .split(/\s+/)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const roleLabel = formatRole(current.role);
  const statusLabel = dashboardUser?.status
    ? dashboardUser.status.charAt(0).toUpperCase() + dashboardUser.status.slice(1)
    : "Active";

  return (
    <div className="page-shell account-page">
      <div className="account-page-heading">
        <div>
          <div className="eyebrow">ACCOUNT</div>
          <h1>My Account</h1>
          <p className="page-subtitle">
            Manage your Pitch Health Operations profile, access, and security.
          </p>
        </div>
        <span className="account-status-chip">
          <i aria-hidden="true" />
          {statusLabel}
        </span>
      </div>

      <section className="account-hero-card">
        <div className="account-avatar-large">{initials}</div>

        <div className="account-hero-copy">
          <span className="eyebrow">PITCH HEALTH OPERATIONS</span>
          <h2>{current.user.name || "Dashboard User"}</h2>
          <p>{current.user.email || "No email available"}</p>

          <div className="account-hero-tags">
            <span>{roleLabel}</span>
            <span>{statusLabel} access</span>
            {dashboardUser?.airtableAgentRecordId ? <span>Employee record linked</span> : null}
          </div>
        </div>

        <div className="account-hero-mark" aria-hidden="true">P</div>
      </section>

      <div className="account-dashboard-grid">
        <section className="panel account-section-card">
          <div className="account-section-heading">
            <div>
              <span className="eyebrow">PROFILE</span>
              <h2>Account Details</h2>
            </div>
          </div>

          <div className="account-detail-grid">
            <div className="account-detail-item">
              <span>Name</span>
              <strong>{current.user.name || "—"}</strong>
            </div>
            <div className="account-detail-item">
              <span>Email</span>
              <strong>{current.user.email || "—"}</strong>
            </div>
            <div className="account-detail-item">
              <span>Access Level</span>
              <strong>{roleLabel}</strong>
            </div>
            <div className="account-detail-item">
              <span>Account Status</span>
              <strong>{statusLabel}</strong>
            </div>
          </div>
        </section>

        <section className="panel account-section-card">
          <div className="account-section-heading">
            <div>
              <span className="eyebrow">SECURITY & ACCESS</span>
              <h2>Sign-In Activity</h2>
            </div>
            <span className="account-security-icon" aria-hidden="true">✓</span>
          </div>

          <div className="account-security-list">
            <div>
              <span>Last Login</span>
              <strong>{formatDateTime(dashboardUser?.lastLoginAt)}</strong>
            </div>
            <div>
              <span>Account Created</span>
              <strong>{formatDate(dashboardUser?.createdAt)}</strong>
            </div>
            <div>
              <span>Authentication</span>
              <strong>Password protected</strong>
            </div>
          </div>
        </section>

        <section className="panel account-section-card account-linked-card">
          <div className="account-section-heading">
            <div>
              <span className="eyebrow">EMPLOYEE RECORD</span>
              <h2>Linked Record</h2>
            </div>
          </div>

          {dashboardUser?.airtableAgentRecordId ? (
            <div className="account-linked-content">
              <div className="account-linked-icon" aria-hidden="true">◎</div>
              <div>
                <strong>Connected to Main Company Directory</strong>
                <p>Your dashboard account is linked to your employee record.</p>
              </div>
              <Link
                href={`/agents/${dashboardUser.airtableAgentRecordId}`}
                className="account-linked-button"
              >
                Open Record →
              </Link>
            </div>
          ) : (
            <div className="account-linked-content">
              <div className="account-linked-icon muted" aria-hidden="true">—</div>
              <div>
                <strong>No employee record linked</strong>
                <p>Your account currently has dashboard access only.</p>
              </div>
            </div>
          )}
        </section>

        <section className="panel account-section-card account-actions-card">
          <div className="account-section-heading">
            <div>
              <span className="eyebrow">ACCOUNT ACTIONS</span>
              <h2>Session</h2>
            </div>
          </div>

          <div className="account-action-copy">
            <div>
              <strong>Sign out of Pitch Health Operations</strong>
              <p>This ends your current dashboard session on this browser.</p>
            </div>
            <AccountActions />
          </div>
        </section>
      </div>
    </div>
  );
}
