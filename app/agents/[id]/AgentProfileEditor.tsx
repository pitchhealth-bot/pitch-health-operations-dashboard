"use client";

import { useEffect, useMemo, useState } from "react";

type AgentProfileValues = {
  name: string;
  email: string;
  personalEmail: string;
  phoneNumber: string;
  dateOfBirth: string;
  startDate: string;
  status: string;
  role: string;
  licensingStatus: string;
  currentStage: string;
  contractingDesignation: string;
  npn: string;
  ssn: string;
  discordUserId: string;
  residentState: string;
};

function display(value?: string) {
  return value?.trim() || "—";
}

function normalizeDateInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function AgentProfileEditor({
  agentId,
  initialValues,
}: {
  agentId: string;
  initialValues: AgentProfileValues;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [values, setValues] = useState(initialValues);
  const [savedValues, setSavedValues] = useState(initialValues);

  const pristine = useMemo(() => savedValues, [savedValues]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = window.setTimeout(() => {
      setSaveState("idle");
      setMessage("");
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [saveState]);

  function update<K extends keyof AgentProfileValues>(key: K, value: AgentProfileValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
  }

  function cancel() {
    setValues(pristine);
    setMessage("");
    setSaveState("idle");
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    setSaveState("saving");
    setMessage("");

    try {
      const response = await fetch(`/api/agents/${agentId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not save employee record.");
      }

      setSavedValues(values);
      setMessage(
        json.changed
          ? `${json.changed} field${json.changed === 1 ? "" : "s"} updated in Airtable.`
          : "No changes to save.",
      );
      setSaveState("saved");
      setEditing(false);
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Could not save employee record.");
    } finally {
      setSaving(false);
    }
  }

  const field = (
    label: string,
    key: keyof AgentProfileValues,
    options?: {
      type?: "text" | "email" | "tel" | "date" | "password";
      select?: string[];
      placeholder?: string;
    },
  ) => {
    const value = values[key];

    if (!editing) {
      return (
        <div className="record-field">
          <span>{label}</span>
          <strong>{display(value)}</strong>
        </div>
      );
    }

    if (options?.select) {
      const designationClass =
        key === "contractingDesignation"
          ? value === "Pitch Health"
            ? " designation-pitch-health"
            : value === "IFG"
              ? " designation-ifg"
              : value === "TrueCare"
                ? " designation-truecare"
                : ""
          : "";

      return (
        <label className="record-field record-field-editable record-field-select">
          <span>{label}</span>
          <select
            className={`profile-edit-input profile-edit-select${designationClass}`}
            value={value}
            onChange={event => update(key, event.target.value)}
          >
            <option value="">—</option>
            {options.select.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      );
    }

    return (
      <label className="record-field record-field-editable">
        <span>{label}</span>
        <input
          className="profile-edit-input"
          type={options?.type || "text"}
          value={
            options?.type === "date"
              ? normalizeDateInput(value)
              : value
          }
          placeholder={options?.placeholder}
          onChange={event => update(key, event.target.value)}
        />
      </label>
    );
  };

  return (
    <>
      {saveState !== "idle" ? (
        <div
          className={`profile-save-toast ${saveState}`}
          role={saveState === "error" ? "alert" : "status"}
          aria-live={saveState === "error" ? "assertive" : "polite"}
        >
          {saveState === "saving" ? (
            <>
              <span className="profile-save-spinner" aria-hidden="true" />
              <div>
                <strong>Saving to Airtable...</strong>
                <span>Main Company Directory</span>
              </div>
            </>
          ) : saveState === "saved" ? (
            <>
              <span className="profile-save-toast-icon">✓</span>
              <div>
                <strong>Saved to Airtable</strong>
                <span>Main Company Directory updated successfully.</span>
              </div>
            </>
          ) : (
            <>
              <span className="profile-save-toast-icon">!</span>
              <div>
                <strong>Save failed</strong>
                <span>{message || "Airtable did not accept the update."}</span>
              </div>
            </>
          )}
        </div>
      ) : null}
      <section className="panel employee-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">CONTACT & IDENTITY</div>
            <h2>Personal Information</h2>
          </div>

          <div className="profile-edit-actions">
            {saveState === "saving" ? (
              <div className="profile-save-status saving" aria-live="polite">
                <span className="profile-save-spinner" aria-hidden="true" />
                Saving to Airtable...
              </div>
            ) : saveState === "saved" ? (
              <div className="profile-save-status saved" aria-live="polite">
                <span aria-hidden="true">✓</span>
                Saved to Airtable
              </div>
            ) : saveState === "error" ? (
              <div className="profile-save-status error" aria-live="assertive">
                Save failed
              </div>
            ) : null}

            {!editing ? (
              <button
                type="button"
                className="profile-pencil-button"
                aria-label="Edit employee record"
                title="Edit employee record"
                onClick={() => setEditing(true)}
              >
                ✎
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="profile-cancel-button"
                  onClick={cancel}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="profile-save-button"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="record-grid">
          {field("Name", "name")}
          {field("Work Email", "email", { type: "email" })}
          {field("Personal Email", "personalEmail", { type: "email" })}
          {field("Phone Number", "phoneNumber", { type: "tel" })}
          {field("Date of Birth", "dateOfBirth", { type: "date" })}
          {field("Start Date", "startDate", { type: "date" })}
        </div>
      </section>

      <section className="panel employee-section required-profile-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">REQUIRED PROFILE</div>
            <h2>Profile Information</h2>
          </div>
          <div className="required-profile-note">Tracked in Missing Info</div>
        </div>

        <div className="record-grid">
          {field("SSN", "ssn", { type: editing ? "password" : "text", placeholder: "Enter SSN" })}
          {field("Date of Birth", "dateOfBirth", { type: "date" })}
          {field("NPN", "npn", { placeholder: "Enter NPN" })}
          {field("Discord User ID", "discordUserId", { placeholder: "Enter Discord User ID" })}
          {field("Resident State", "residentState", {
            select: [
              "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
              "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
              "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV",
              "WI","WY","DC"
            ],
          })}
        </div>
      </section>

      <section className="panel employee-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">EMPLOYMENT</div>
            <h2>Role & Contracting</h2>
          </div>
        </div>

        <div className="record-grid">
          {field("Status", "status")}
          {field("Role", "role", {
            select: ["ADMIN", "Medicare Agent", "Bootcamp Direct", "Fronter", "Hospital Indemnity"],
          })}
          {field("Licensing Status", "licensingStatus", {
            select: ["Licensed", "Non-licensed"],
          })}
          {field("Current Stage", "currentStage")}
          {field("Contracting Designation", "contractingDesignation", {
            select: ["Pitch Health", "IFG", "TrueCare"],
          })}
        </div>

        {message ? <div className="profile-edit-message">{message}</div> : null}
      </section>
    </>
  );
}
