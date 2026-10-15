"use client";

import { useMemo, useState } from "react";

type FieldOption = {
  name: string;
  color?: string;
};

type FieldConfig = {
  name: string;
  actualName: string;
  type: string;
  options: FieldOption[];
};

type Props = {
  agentId: string;
  agentName: string;
  trackerRecordId: string;
  initialValues: Record<string, string>;
  fieldConfig: FieldConfig[];
};

const FIELDS = {
  course: "Purchased Licensing Course?",
  exam: "Purchased Licensing Exam?",
  examDate: "Exam Date",
  passedExam: "Passed Licensing exam?",
  secondExamDate: "2nd Exam Date",
  fingerprints: "Completed FingerPrints?",
  resident: "Purchased Resident States?",
  nonResident: "Purchased Non-Resident States?",
  unresponsive: "Unresponsive??",
} as const;

function normalize(value?: string) {
  return (value || "").trim().toLowerCase();
}

function optionsFor(config: FieldConfig[], field: string, fallback: string[]) {
  const options = config.find(item => item.name === field)?.options || [];
  return options.length ? options.map(option => option.name) : fallback;
}

export default function LicensingJourneyEditor({
  agentId,
  agentName,
  trackerRecordId,
  initialValues,
  fieldConfig,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [savedValues, setSavedValues] = useState<Record<string, string>>(initialValues);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [unresponsiveOpen, setUnresponsiveOpen] = useState(false);

  const purchasedExam = normalize(values[FIELDS.exam]) === "yes";
  const failedExam = normalize(values[FIELDS.passedExam]) === "no";

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(savedValues),
    [values, savedValues],
  );

  function update(field: string, value: string) {
    setValues(current => {
      const next = { ...current, [field]: value };

      if (field === FIELDS.exam && normalize(value) !== "yes") {
        next[FIELDS.examDate] = "";
        next[FIELDS.passedExam] = "";
        next[FIELDS.secondExamDate] = "";
      }

      if (field === FIELDS.passedExam && normalize(value) !== "no") {
        next[FIELDS.secondExamDate] = "";
      }

      return next;
    });
    setMessage("");
  }

  async function save() {
    if (!dirty || saving) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/agent-journey/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackerRecordId,
          agentName,
          updates: values,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Save failed.");
      }

      setSavedValues(values);
      setMessage("Saved to Licensing Stages (Tracker).");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const courseOptions = optionsFor(fieldConfig, FIELDS.course, ["Yes", "No"]);
  const examOptions = optionsFor(fieldConfig, FIELDS.exam, ["Yes", "No"]);
  const passedOptions = optionsFor(fieldConfig, FIELDS.passedExam, ["Yes", "No"]);
  const fingerprintOptions = optionsFor(fieldConfig, FIELDS.fingerprints, [
    "Completed",
    "Didn't Schedule yet",
    "Pending Appointment Date",
    "Not Applicable",
  ]);
  const residentOptions = optionsFor(fieldConfig, FIELDS.resident, ["Completed"]);
  const nonResidentOptions = optionsFor(fieldConfig, FIELDS.nonResident, ["Completed"]);
  const unresponsiveOptions = optionsFor(fieldConfig, FIELDS.unresponsive, [
    "Unresponsive-Mel",
    "Unresponsive-Jos",
    "Spoke with Agent",
    "LVM",
  ]);

  function SelectField({
    label,
    field,
    options,
  }: {
    label: string;
    field: string;
    options: string[];
  }) {
    return (
      <label className="journey-form-field">
        <span>{label}</span>
        <select
          value={values[field] || ""}
          onChange={event => update(field, event.target.value)}
        >
          <option value="">Select...</option>
          {!options.includes(values[field] || "") && values[field] ? (
            <option value={values[field]}>{values[field]}</option>
          ) : null}
          {options.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <section className="panel journey-editor-panel">
      <div className="journey-editor-heading">
        <div>
          <span className="eyebrow">LICENSING STAGES TRACKER</span>
          <h2>Pre-Licensing Requirements</h2>
        </div>

        <div className="journey-editor-actions">
          {message ? (
            <span className={message.startsWith("Saved") ? "save-state success" : "save-state error"}>
              {message}
            </span>
          ) : null}
          <button
            type="button"
            className="primary-button"
            onClick={save}
            disabled={!dirty || saving}
          >
            {saving ? "Saving..." : dirty ? "Save Changes" : "Saved"}
          </button>
        </div>
      </div>

      <div className="journey-form-grid">
        <SelectField
          label="Purchased Licensing Course?"
          field={FIELDS.course}
          options={courseOptions}
        />

        <div className="journey-exam-group">
          <SelectField
            label="Purchased Licensing Exam?"
            field={FIELDS.exam}
            options={examOptions}
          />

          {purchasedExam ? (
            <div className="journey-exam-conditional">
              <label className="journey-form-field">
                <span>Exam Date</span>
                <input
                  type="date"
                  value={values[FIELDS.examDate] || ""}
                  onChange={event => update(FIELDS.examDate, event.target.value)}
                />
              </label>

              <SelectField
                label="Passed Licensing exam?"
                field={FIELDS.passedExam}
                options={passedOptions}
              />

              {failedExam ? (
                <label className="journey-form-field">
                  <span>2nd Exam Date</span>
                  <input
                    type="date"
                    value={values[FIELDS.secondExamDate] || ""}
                    onChange={event => update(FIELDS.secondExamDate, event.target.value)}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
        </div>

        <SelectField
          label="Completed FingerPrints?"
          field={FIELDS.fingerprints}
          options={fingerprintOptions}
        />

        <SelectField
          label="Purchased Resident States?"
          field={FIELDS.resident}
          options={residentOptions}
        />

        <SelectField
          label="Purchased Non-Resident States?"
          field={FIELDS.nonResident}
          options={nonResidentOptions}
        />
      </div>

      <div className="journey-unresponsive-section">
        <div>
          <strong>Agent follow-up</strong>
          <span>Use this only when you need to record an outreach status.</span>
        </div>

        <div className="journey-unresponsive-action">
          <button
            type="button"
            className="journey-unresponsive-button"
            onClick={() => setUnresponsiveOpen(open => !open)}
          >
            Mark as Unresponsive
          </button>

          {unresponsiveOpen ? (
            <select
              className="journey-unresponsive-select"
              value={values[FIELDS.unresponsive] || ""}
              onChange={event => update(FIELDS.unresponsive, event.target.value)}
            >
              <option value="">Select status...</option>
              {!unresponsiveOptions.includes(values[FIELDS.unresponsive] || "") && values[FIELDS.unresponsive] ? (
                <option value={values[FIELDS.unresponsive]}>
                  {values[FIELDS.unresponsive]}
                </option>
              ) : null}
              {unresponsiveOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>
    </section>
  );
}
