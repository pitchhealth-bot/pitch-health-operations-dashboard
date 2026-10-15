"use client";

import EditIcon from "@/app/components/EditIcon";
import { useState } from "react";

const REQUIRED_FIELDS = [
  "SSN",
  "Date of Birth",
  "NPN",
  "Discord User ID",
  "Resident State",
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

const RESIDENT_STATE_OPTIONS = [
  "Alabama - AL",
  "Alaska - AK",
  "Arizona - AZ",
  "Arkansas - AR",
  "California - CA",
  "Colorado - CO",
  "Connecticut - CT",
  "Delaware - DE",
  "District of Columbia - DC",
  "Florida - FL",
  "Georgia - GA",
  "Hawaii - HI",
  "Idaho - ID",
  "Illinois - IL",
  "Indiana - IN",
  "Iowa - IA",
  "Kansas - KS",
  "Kentucky - KY",
  "Louisiana - LA",
  "Maine - ME",
  "Maryland - MD",
  "Massachusetts - MA",
  "Michigan - MI",
  "Minnesota - MN",
  "Mississippi - MS",
  "Missouri - MO",
  "Montana - MT",
  "Nebraska - NE",
  "Nevada - NV",
  "New Hampshire - NH",
  "New Jersey - NJ",
  "New Mexico - NM",
  "New York - NY",
  "North Carolina - NC",
  "North Dakota - ND",
  "Ohio - OH",
  "Oklahoma - OK",
  "Oregon - OR",
  "Pennsylvania - PA",
  "Rhode Island - RI",
  "South Carolina - SC",
  "South Dakota - SD",
  "Tennessee - TN",
  "Texas - TX",
  "Utah - UT",
  "Vermont - VT",
  "Virginia - VA",
  "Washington - WA",
  "West Virginia - WV",
  "Wisconsin - WI",
  "Wyoming - WY"
] as const;

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
  const [activeFilter, setActiveFilter] = useState<RequiredField | null>(null);

  const filteredRows = activeFilter
    ? localRows.filter(row => row.missingFields.includes(activeFilter))
    : localRows;

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
      <section className="panel missing-info-summary">
        <div className="panel-title">
          <div>
            <span className="eyebrow">REQUIRED FIELDS</span>
            <h2>Profile completeness</h2>
          </div>

          {activeFilter ? (
            <button
              type="button"
              className="missing-filter-clear"
              onClick={() => setActiveFilter(null)}
            >
              Show all missing
            </button>
          ) : null}
        </div>

        <div className="missing-required-grid">
          {REQUIRED_FIELDS.map(field => {
            const count = localRows.filter(row =>
              row.missingFields.includes(field),
            ).length;
            const active = activeFilter === field;

            return (
              <button
                type="button"
                className={`missing-required-card missing-required-card-button${active ? " active" : ""}`}
                key={field}
                onClick={() => setActiveFilter(current => current === field ? null : field)}
                aria-pressed={active}
              >
                <span>{field}</span>
                <strong>{count}</strong>
                <small>{active ? "showing agents" : "missing"}</small>
                <i aria-hidden="true">→</i>
              </button>
            );
          })}
        </div>

        <div className="missing-filter-status">
          {activeFilter
            ? `Showing ${filteredRows.length} agent${filteredRows.length === 1 ? "" : "s"} missing ${activeFilter}`
            : `Showing all ${localRows.length} agents with missing information`}
        </div>
      </section>

      <section className="panel agents-list-panel missing-info-panel">
        <div className="missing-info-scroll">
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

      {filteredRows.map((row, index) => {
        const editing = editingId === row.id;
        const draft = draftFor(row);

        return (
          <div className={`missing-info-table-row${editing ? " editing" : ""}`} key={row.id}>
            <div className="missing-agent-sticky-cell">
              <span className="missing-row-number">{index + 1}</span>
              <div className="missing-agent-identity">
                <a href={"/agents/" + row.id} className="agent-name-link">
                  <strong>{row.name}</strong>
                </a>
                <div className="muted">{row.email || "No work email"}</div>
              </div>
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
                <select
                  className="missing-inline-input"
                  value={String(draft.residentState || "")}
                  onChange={event => update(row.id, "residentState", event.target.value)}
                >
                  <option value="">Select resident state</option>
                  {!RESIDENT_STATE_OPTIONS.includes(
                    String(draft.residentState || "") as (typeof RESIDENT_STATE_OPTIONS)[number],
                  ) && String(draft.residentState || "") ? (
                    <option value={String(draft.residentState || "")}>
                      {String(draft.residentState || "")}
                    </option>
                  ) : null}
                  {RESIDENT_STATE_OPTIONS.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
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

      {!filteredRows.length ? (
        <div className="empty" style={{ minHeight: 150 }}>
          No active agents are missing {activeFilter || "required information"}.
        </div>
      ) : null}
        </div>
      </section>
    </>
  );
}
