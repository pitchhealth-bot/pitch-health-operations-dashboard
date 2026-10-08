"use client";

import { useState } from "react";
import type { DashboardUser } from "@/lib/users";

type AgentOption = {
  id: string;
  name: string;
  email?: string;
};

const ROLE_OPTIONS = [
  ["super_admin", "Super Admin"],
  ["admin", "Admin"],
  ["agent", "Agent"],
] as const;

const STATUS_OPTIONS = [
  ["active", "Active"],
  ["inactive", "Inactive"],
  ["invited", "Invited"],
] as const;

export default function UsersManager({
  initialUsers,
  agents,
}: {
  initialUsers: DashboardUser[];
  agents: AgentOption[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState("");
  const [adding, setAdding] = useState(false);
  const [invitingEmail, setInvitingEmail] = useState("");
  const [accessActionId, setAccessActionId] = useState("");
  const [openMenuId, setOpenMenuId] = useState("");

  async function saveUser(user: DashboardUser) {
    setSavingId(user.id);
    setMessage("");

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name || "",
          role: user.role,
          status: user.status,
          airtableAgentRecordId: user.airtableAgentRecordId || null,
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not save user.");

      setUsers(current => current.map(item => item.id === user.id ? json.user : item));
      setMessage("User updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save user.");
    } finally {
      setSavingId("");
    }
  }

  async function sendInvite(email: string) {
    setInvitingEmail(email);
    setMessage("");

    try {
      const response = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not send invite.");

      setMessage(`Invite sent to ${email}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send invite.");
    } finally {
      setInvitingEmail("");
    }
  }

  async function changeAccess(user: DashboardUser, mode: "revoke" | "delete") {
    const actionLabel = mode === "revoke" ? "revoke access for" : "delete";
    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} ${user.name || user.email}?`,
    );

    if (!confirmed) return;

    setAccessActionId(user.id);
    setMessage("");

    try {
      const response = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, mode }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not update access.");

      if (mode === "delete") {
        setUsers(current => current.filter(item => item.id !== user.id));
        setMessage("User deleted.");
      } else {
        setUsers(current => current.map(item => item.id === user.id ? json.user : item));
        setMessage("Access revoked.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update access.");
    } finally {
      setAccessActionId("");
    }
  }

  async function addUser(form: HTMLFormElement) {
    const data = new FormData(form);
    setAdding(true);
    setMessage("");

    try {
      const role = String(data.get("role") || "agent");
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") || ""),
          email: String(data.get("email") || ""),
          role,
          status: String(data.get("status") || "active"),
          airtableAgentRecordId: role === "agent"
            ? String(data.get("airtableAgentRecordId") || "")
            : undefined,
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not add user.");

      setUsers(current => [...current, json.user].sort((a,b) => (a.name || a.email).localeCompare(b.name || b.email)));
      form.reset();
      setMessage("User added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add user.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <section className="panel users-create-panel">
        <div className="panel-title">
          <div>
            <div className="eyebrow">ACCESS CONTROL</div>
            <h2>Add User</h2>
          </div>
        </div>

        <form
          className="user-create-grid"
          onSubmit={event => {
            event.preventDefault();
            addUser(event.currentTarget);
          }}
        >
          <input name="name" className="user-input" placeholder="Name" />
          <input name="email" className="user-input" placeholder="Email" type="email" required />
          <select name="role" className="user-input" defaultValue="agent">
            {ROLE_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select name="status" className="user-input" defaultValue="active">
            {STATUS_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select name="airtableAgentRecordId" className="user-input" defaultValue="">
            <option value="">Link agent record (optional)</option>
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.name}{agent.email ? ` · ${agent.email}` : ""}
              </option>
            ))}
          </select>
          <button className="filter-button" type="submit" disabled={adding}>
            {adding ? "Adding..." : "Add User"}
          </button>
        </form>

        {message && <div className="user-message">{message}</div>}
      </section>

      <section className="panel users-table-panel">
        <div className="users-head">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span>Linked Agent</span>
          <span>Last Login</span>
          <span></span>
        </div>

        {users.map(user => (
          <div className="users-row" key={user.id}>
            <input
              className="user-cell-input"
              value={user.name || ""}
              onChange={event =>
                setUsers(current => current.map(item =>
                  item.id === user.id ? { ...item, name: event.target.value } : item
                ))
              }
            />
            <strong>{user.email}</strong>
            <select
              className="user-cell-input"
              value={user.role}
              onChange={event =>
                setUsers(current => current.map(item =>
                  item.id === user.id ? { ...item, role: event.target.value as DashboardUser["role"] } : item
                ))
              }
            >
              {ROLE_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select
              className="user-cell-input"
              value={user.status}
              onChange={event =>
                setUsers(current => current.map(item =>
                  item.id === user.id ? { ...item, status: event.target.value as DashboardUser["status"] } : item
                ))
              }
            >
              {STATUS_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select
              className="user-cell-input"
              value={user.airtableAgentRecordId || ""}
              disabled={user.role !== "agent"}
              onChange={event =>
                setUsers(current => current.map(item =>
                  item.id === user.id ? { ...item, airtableAgentRecordId: event.target.value || undefined } : item
                ))
              }
            >
              <option value="">Not linked</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
            <span className="muted">
              {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
            </span>
            <div className="user-row-actions">
              <button
                className="user-save-button"
                type="button"
                disabled={savingId === user.id}
                onClick={() => saveUser(user)}
              >
                {savingId === user.id ? "Saving..." : "Save"}
              </button>

              <div className="user-more-wrap">
                <button
                  className="user-more-button"
                  type="button"
                  aria-label="More user actions"
                  aria-expanded={openMenuId === user.id}
                  onClick={() => setOpenMenuId(current => current === user.id ? "" : user.id)}
                >
                  ⋯
                </button>

                {openMenuId === user.id && (
                  <div className="user-more-menu">
                    <button
                      type="button"
                      disabled={invitingEmail === user.email}
                      onClick={async () => {
                        setOpenMenuId("");
                        await sendInvite(user.email);
                      }}
                    >
                      {invitingEmail === user.email ? "Sending..." : "Send Invite"}
                    </button>

                    <button
                      type="button"
                      disabled={accessActionId === user.id || user.status === "inactive"}
                      onClick={async () => {
                        setOpenMenuId("");
                        await changeAccess(user, "revoke");
                      }}
                    >
                      {user.status === "inactive" ? "Access Revoked" : "Revoke Access"}
                    </button>

                    <button
                      type="button"
                      className="danger"
                      disabled={accessActionId === user.id}
                      onClick={async () => {
                        setOpenMenuId("");
                        await changeAccess(user, "delete");
                      }}
                    >
                      Delete User
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
