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
  states: string;
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
  const [editingSection, setEditingSection] = useState<"personal" | "required" | "employment" | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [values, setValues] = useState(initialValues);
  const [savedValues, setSavedValues] = useState(initialValues);

  const pristine = useMemo(() => savedValues, [savedValues]);

  const sectionKeys = {
    personal: ["name", "email", "personalEmail", "phoneNumber", "dateOfBirth", "startDate"],
    required: ["ssn", "dateOfBirth", "npn", "discordUserId", "residentState"],
    employment: ["status", "role", "licensingStatus", "currentStage", "contractingDesignation", "states"],
  } as const;

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

  function cancel(section: "personal" | "required" | "employment") {
    setValues(current => {
      const next = { ...current };
      for (const key of sectionKeys[section]) {
        next[key] = pristine[key];
      }
      return next;
    });
    setMessage("");
    setSaveState("idle");
    setEditingSection(null);
  }

  async function save(section: "personal" | "required" | "employment") {
    setSaving(true);
    setSaveState("saving");
    setMessage("");

    try {
      const response = await fetch(`/api/agents/${agentId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(sectionKeys[section].map(key => [key, values[key]])),
        ),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not save employee record.");
      }

      setSavedValues(current => {
        const next = { ...current };
        for (const key of sectionKeys[section]) {
          next[key] = values[key];
        }
        return next;
      });
      setMessage(
        json.changed
          ? `${json.changed} field${json.changed === 1 ? "" : "s"} updated in Airtable.`
          : "No changes to save.",
      );
      setSaveState("saved");
      setEditingSection(null);
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
    isEditing = false,
  ) => {
    const value = values[key];

    if (!isEditing) {
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

  function PencilIcon() {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          d="M4 20h4.25L19.3 8.95a2.1 2.1 0 0 0 0-2.97L18.02 4.7a2.1 2.1 0 0 0-2.97 0L4 15.75V20Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m13.8 5.95 4.25 4.25M4 20l4.8-1.15"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  function SectionActions({ section }: { section: "personal" | "required" | "employment" }) {
    const isEditing = editingSection === section;

    if (!isEditing) {
      return (
        <button
          type="button"
          className="profile-pencil-button minimal-pencil-button"
          aria-label={`Edit ${section} information`}
          title="Edit"
          onClick={() => setEditingSection(section)}
          disabled={saving}
        >
          <PencilIcon />
        </button>
      );
    }

    return (
      <div className="profile-edit-actions">
        <button
          type="button"
          className="profile-cancel-button"
          onClick={() => cancel(section)}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="profile-save-button"
          onClick={() => save(section)}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    );
  }

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

          <SectionActions section="personal" />
        </div>

        <div className="record-grid">
          {field("Name", "name", undefined, editingSection === "personal")}
          {field("Work Email", "email", { type: "email" }, editingSection === "personal")}
          {field("Personal Email", "personalEmail", { type: "email" }, editingSection === "personal")}
          {field("Phone Number", "phoneNumber", { type: "tel" }, editingSection === "personal")}
          {field("Date of Birth", "dateOfBirth", { type: "date" }, editingSection === "personal")}
          {field("Start Date", "startDate", { type: "date" }, editingSection === "personal")}
        </div>
      </section>

      <section className="panel employee-section required-profile-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">REQUIRED PROFILE</div>
            <h2>Profile Information</h2>
          </div>
          <div className="section-heading-actions">
            <div className="required-profile-note">Tracked in Missing Info</div>
            <SectionActions section="required" />
          </div>
        </div>

        <div className="record-grid">
          {field("SSN", "ssn", { type: editingSection === "required" ? "password" : "text", placeholder: "Enter SSN" }, editingSection === "required")}
          {field("Date of Birth", "dateOfBirth", { type: "date" }, editingSection === "required")}
          {field("NPN", "npn", { placeholder: "Enter NPN" }, editingSection === "required")}
          {field("Discord User ID", "discordUserId", { placeholder: "Enter Discord User ID" }, editingSection === "required")}
          {field("Resident State", "residentState", {
            select: [
              "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
              "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
              "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV",
              "WI","WY","DC"
            ],
          }, editingSection === "required")}
        </div>
      </section>

      <section className="panel employee-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">EMPLOYMENT</div>
            <h2>Role & Contracting</h2>
          </div>
          <SectionActions section="employment" />
        </div>

        <div className="record-grid">
          {field("Status", "status", undefined, editingSection === "employment")}
          {field("Role", "role", {
            select: ["ADMIN", "Medicare Agent", "Bootcamp Direct", "Fronter", "Hospital Indemnity"],
          }, editingSection === "employment")}
          {field("Licensing Status", "licensingStatus", {
            select: ["Licensed", "Non-licensed"],
          }, editingSection === "employment")}
          {field("Current Stage", "currentStage", undefined, editingSection === "employment")}
          {field("Contracting Designation", "contractingDesignation", {
            select: ["Pitch Health", "IFG", "TrueCare"],
          }, editingSection === "employment")}
          {field("States", "states", { placeholder: "Enter number of states" }, editingSection === "employment")}
        </div>

        {message ? <div className="profile-edit-message">{message}</div> : null}
      </section>
    </>
  );
}
