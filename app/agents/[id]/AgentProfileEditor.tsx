"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [values, setValues] = useState(initialValues);

  const pristine = useMemo(() => initialValues, [initialValues]);

  function update<K extends keyof AgentProfileValues>(key: K, value: AgentProfileValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
  }

  function cancel() {
    setValues(pristine);
    setMessage("");
    setEditing(false);
  }

  async function save() {
    setSaving(true);
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

      setMessage(
        json.changed
          ? `${json.changed} field${json.changed === 1 ? "" : "s"} updated in Airtable.`
          : "No changes to save.",
      );
      setEditing(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save employee record.");
    } finally {
      setSaving(false);
    }
  }

  const field = (
    label: string,
    key: keyof AgentProfileValues,
    options?: {
      type?: "text" | "email" | "tel" | "date";
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
      <section className="panel employee-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">CONTACT & IDENTITY</div>
            <h2>Personal Information</h2>
          </div>

          <div className="profile-edit-actions">
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

      <section className="panel employee-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">EMPLOYMENT</div>
            <h2>Role & Contracting</h2>
          </div>
        </div>

        <div className="record-grid">
          {field("Status", "status")}
          {field("Role", "role")}
          {field("Licensing Status", "licensingStatus", {
            select: ["Licensed", "Non-licensed"],
          })}
          {field("Current Stage", "currentStage")}
          {field("Contracting Designation", "contractingDesignation", {
            select: ["Pitch Health", "IFG", "TrueCare"],
          })}
          {field("NPN", "npn")}
        </div>

        {message ? <div className="profile-edit-message">{message}</div> : null}
      </section>
    </>
  );
}
