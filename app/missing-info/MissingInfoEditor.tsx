"use client";

import EditIcon from "@/app/components/EditIcon";
import { useState } from "react";

type Row = {
  id: string;
  name: string;
  email?: string;
  status?: string;
  role?: string;
  licensingStatus?: string;
  ssn?: string;
  dateOfBirth?: string;
  npn?: string;
  discordUserId?: string;
  residentState?: string;
  missingFields: string[];
};

function normalizeDateInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function MissingInfoEditor({ rows, roleOptions }: { rows: Row[]; roleOptions: string[] }) {
  const [localRows, setLocalRows] = useState(rows);
  const [editingId, setEditingId] = useState("");
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Partial<Row>>>({});

  function draftFor(row: Row) {
    return {
      ssn: row.ssn || "",
      dateOfBirth: normalizeDateInput(row.dateOfBirth),
      npn: row.npn || "",
      discordUserId: row.discordUserId || "",
      residentState: row.residentState || "",
      licensingStatus: row.licensingStatus || "",
      role: row.role || "",
      ...(drafts[row.id] || {}),
    };
  }

  function begin(row: Row) {
    setMessage("");
    setEditingId(row.id);
    setDrafts(current => ({
      ...current,
      [row.id]: draftFor(row),
    }));
  }

  function update(rowId: string, key: keyof Row, value: string) {
    setDrafts(current => ({
      ...current,
      [rowId]: {
        ...(current[rowId] || {}),
        [key]: value,
      },
    }));
  }

  async function save(row: Row) {
    const draft = draftFor(row);
    setSavingId(row.id);
    setMessage("");

    try {
      const response = await fetch(`/api/agents/${row.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ssn: draft.ssn || "",
          dateOfBirth: draft.dateOfBirth || "",
          npn: draft.npn || "",
          discordUserId: draft.discordUserId || "",
          residentState: draft.residentState || "",
          licensingStatus: draft.licensingStatus || "",
          role: draft.role || "",
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not update this agent.");
      }

      const updatedMissingFields: string[] = [];
      if (!String(draft.ssn || "").trim()) updatedMissingFields.push("SSN");
      if (!String(draft.dateOfBirth || "").trim()) updatedMissingFields.push("Date of Birth");
      if (!String(draft.npn || "").trim()) updatedMissingFields.push("NPN");
      if (!String(draft.discordUserId || "").trim()) updatedMissingFields.push("Discord User ID");
      if (!String(draft.residentState || "").trim()) updatedMissingFields.push("Resident State");

      setLocalRows(current =>
        current.map(item =>
          item.id === row.id
            ? {
                ...item,
                role: String(draft.role || ""),
                licensingStatus: String(draft.licensingStatus || ""),
                ssn: String(draft.ssn || ""),
                dateOfBirth: String(draft.dateOfBirth || ""),
                npn: String(draft.npn || ""),
                discordUserId: String(draft.discordUserId || ""),
                residentState: String(draft.residentState || ""),
                missingFields: updatedMissingFields,
              }
            : item,
        ),
      );

      setEditingId("");
      setMessage(`${row.name} updated in Airtable.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update this agent.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <>
      {message ? <div className="missing-info-save-message">{message}</div> : null}

      <div className="missing-info-table-head">
        <span>Agent</span>
        <span>Status</span>
        <span>Role</span>
        <span>Licensing Status</span>
        <span>SSN</span>
        <span>Date of Birth</span>
        <span>NPN</span>
        <span>Discord User ID</span>
        <span>Resident State</span>
        <span>Missing</span>
        <span></span>
      </div>

      {localRows.map(row => {
        const editing = editingId === row.id;
        const draft = draftFor(row);

        return (
          <div className={`missing-info-table-row${editing ? " editing" : ""}`} key={row.id}>
            <div>
              <a href={"/agents/" + row.id} className="agent-name-link">
                <strong>{row.name}</strong>
              </a>
              <div className="muted">{row.email || "No work email"}</div>
            </div>

            <div>
              <span className="pill success">{row.status || "Active"}</span>
            </div>

            <div>
              {editing ? (
                <select
                  className="missing-inline-input"
                  value={String(draft.role || "")}
                  onChange={event => update(row.id, "role", event.target.value)}
                >
                  <option value="">No Role</option>
                  {roleOptions.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              ) : (
                <span className={row.role ? "role-chip" : "role-chip role-chip-empty"}>
                  {row.role || "No Role"}
                </span>
              )}
            </div>

            <div>
              {editing ? (
                <select
                  className="missing-inline-input"
                  value={String(draft.licensingStatus || "")}
                  onChange={event => update(row.id, "licensingStatus", event.target.value)}
                >
                  <option value="">—</option>
                  <option value="Licensed">Licensed</option>
                  <option value="Non-licensed">Non-licensed</option>
                </select>
              ) : (
                <span
                  className={
                    row.licensingStatus === "Licensed"
                      ? "pill success"
                      : row.licensingStatus === "Non-licensed"
                        ? "pill warning"
                        : "pill"
                  }
                >
                  {row.licensingStatus || "—"}
                </span>
              )}
            </div>

            <div>
              {editing ? (
                <input
                  className="missing-inline-input"
                  type="password"
                  autoComplete="off"
                  placeholder={row.ssn ? "•••••••••" : "Enter SSN"}
                  value={String(draft.ssn || "")}
                  onChange={event => update(row.id, "ssn", event.target.value)}
                />
              ) : (
                <span className={row.missingFields.includes("SSN") ? "pill critical" : "pill success"}>
                  {row.missingFields.includes("SSN") ? "Missing" : "Complete"}
                </span>
              )}
            </div>

            <div>
              {editing ? (
                <input
                  className="missing-inline-input"
                  type="date"
                  value={String(draft.dateOfBirth || "")}
                  onChange={event => update(row.id, "dateOfBirth", event.target.value)}
                />
              ) : (
                <span className={row.missingFields.includes("Date of Birth") ? "pill critical" : "pill success"}>
                  {row.missingFields.includes("Date of Birth") ? "Missing" : "Complete"}
                </span>
              )}
            </div>

            <div>
              {editing ? (
                <input
                  className="missing-inline-input"
                  value={String(draft.npn || "")}
                  onChange={event => update(row.id, "npn", event.target.value)}
                />
              ) : (
                <span className={row.missingFields.includes("NPN") ? "pill critical" : "pill success"}>
                  {row.missingFields.includes("NPN") ? "Missing" : "Complete"}
                </span>
              )}
            </div>

            <div>
              {editing ? (
                <input
                  className="missing-inline-input"
                  value={String(draft.discordUserId || "")}
                  onChange={event => update(row.id, "discordUserId", event.target.value)}
                />
              ) : (
                <span className={row.missingFields.includes("Discord User ID") ? "pill critical" : "pill success"}>
                  {row.missingFields.includes("Discord User ID") ? "Missing" : "Complete"}
                </span>
              )}
            </div>

            <div>
              {editing ? (
                <input
                  className="missing-inline-input"
                  value={String(draft.residentState || "")}
                  onChange={event => update(row.id, "residentState", event.target.value)}
                />
              ) : (
                <span className={row.missingFields.includes("Resident State") ? "pill critical" : "pill success"}>
                  {row.missingFields.includes("Resident State") ? "Missing" : "Complete"}
                </span>
              )}
            </div>

            <div>
              <span className="pill warning">{row.missingFields.length}</span>
            </div>

            <div className="missing-info-actions">
              {editing ? (
                <>
                  <button
                    type="button"
                    className="missing-row-cancel"
                    disabled={savingId === row.id}
                    onClick={() => setEditingId("")}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="missing-row-save"
                    disabled={savingId === row.id}
                    onClick={() => save(row)}
                  >
                    {savingId === row.id ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="missing-row-edit"
                  aria-label={"Edit " + row.name}
                  title="Edit missing information"
                  onClick={() => begin(row)}
                >
                  <EditIcon />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
